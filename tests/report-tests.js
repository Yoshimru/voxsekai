const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { after, before, test } = require("node:test");

const temporaryDirectory = fs.mkdtempSync(
  path.join(os.tmpdir(), "voxsekai-report-tests-"),
);
process.env.VOXSEKAI_DB = path.join(temporaryDirectory, "test.db");

const app = require("../server");
const db = require("../db").getDb();

db.prepare(`
  INSERT INTO artists
    (id, name, alias, initials, card_class, genre_label, genres,
     track_count, listeners_label, country, image_url)
  VALUES
    ('report-artist', 'Тестовый исполнитель', '', 'ТИ', 'performer-miku',
     'Электроника', '["Электроника"]', 1, '1 слушатель', 'Россия', '')
`).run();

db.prepare(`
  INSERT INTO tracks
    (id, title, display_title, artist, artist_name, duration, genre,
     artwork_class, artwork_glyph, rating, album, release_year,
     description, audio_url, image_url)
  VALUES
    ('report-track', 'Report Track', 'Отчётный трек', 'Тестовый исполнитель',
     'Тестовый исполнитель', 180, 'Электроника', 'artwork-cyan', '♪', '4.5',
     'Тестовый альбом', 2026, 'Трек для интеграционного тестирования.', '', '')
`).run();

db.prepare(
  "INSERT INTO artist_tracks (artist_id, track_id, position) VALUES (?, ?, ?)",
).run("report-artist", "report-track", 0);

let server;
let baseUrl;

let userCookie = "";
let adminCookie = "";
let secondUserCookie = "";
let userPlaylistId = "";
let adminCollectionId = "";
let adminPlaylistId = "";
let adminEventId = "";

before(async () => {
  server = await new Promise((resolve, reject) => {
    const instance = app.listen(0, "127.0.0.1", () => resolve(instance));
    instance.once("error", reject);
  });
  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
});

function cookieFrom(response) {
  return (response.headers.get("set-cookie") || "").split(";", 1)[0];
}

async function request(pathname, options = {}) {
  return fetch(`${baseUrl}${pathname}`, {
    redirect: "manual",
    ...options,
    headers: {
      ...(options.headers || {}),
    },
  });
}

function form(body) {
  return {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body),
  };
}

function json(method, body, cookie = "") {
  return {
    method,
    headers: {
      "content-type": "application/json",
      ...(cookie ? { cookie } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  };
}

function authenticatedForm(body, cookie) {
  const options = form(body);
  options.headers.cookie = cookie;
  return options;
}

after(async () => {
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
  db.close();
  fs.rmSync(temporaryDirectory, { recursive: true, force: true });
});

test("TC-01: главная страница открывается", async () => {
  const response = await request("/");
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.match(html, /VoxSekai/);
});

test("TC-02: каталог показывает треки из SQLite", async () => {
  const response = await request("/catalog");
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.match(html, /Каталог музыки/);
  assert.match(html, /Отчётный трек/);
});

test("TC-03: страница существующего трека открывается", async () => {
  const response = await request("/track/report-track");
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.match(html, /Отчётный трек/);
  assert.match(html, /Тестовый исполнитель/);
});

test("TC-04: неизвестный адрес возвращает страницу 404", async () => {
  const response = await request("/route-that-does-not-exist");
  const html = await response.text();
  assert.equal(response.status, 404);
  assert.match(html, /Страница не найдена/);
});

test("TC-05: гостя перенаправляет с защищённой страницы на вход", async () => {
  const response = await request("/profile");
  assert.equal(response.status, 302);
  assert.equal(response.headers.get("location"), "/login?next=%2Fprofile");
});

test("TC-06: новый пользователь может зарегистрироваться", async () => {
  const response = await request(
    "/register",
    form({
      name: "report_user",
      email: "report@example.test",
      password: "report-password",
      next: "",
    }),
  );
  userCookie = cookieFrom(response);
  assert.equal(response.status, 302);
  assert.equal(response.headers.get("location"), "/profile");
  assert.match(userCookie, /^connect\.sid=/);
  assert.equal(
    db.prepare("SELECT COUNT(*) AS n FROM users WHERE username = ?").get(
      "report_user",
    ).n,
    1,
  );
});

test("TC-07: повторное имя пользователя отклоняется", async () => {
  const response = await request(
    "/register",
    form({
      name: "report_user",
      email: "another@example.test",
      password: "another-password",
      next: "",
    }),
  );
  const html = await response.text();
  assert.equal(response.status, 400);
  assert.match(html, /Пользователь с таким именем уже существует/);
});

test("TC-08: пользователь может выйти из аккаунта", async () => {
  const response = await request("/logout", {
    ...form({}),
    headers: {
      ...form({}).headers,
      cookie: userCookie,
    },
  });
  assert.equal(response.status, 302);
  assert.equal(response.headers.get("location"), "/");
  assert.match(response.headers.get("set-cookie") || "", /connect\.sid=;/);
  userCookie = "";
});

test("TC-09: неверный пароль не даёт войти", async () => {
  const response = await request(
    "/login",
    form({
      login: "report@example.test",
      password: "wrong-password",
      next: "",
    }),
  );
  const html = await response.text();
  assert.equal(response.status, 400);
  assert.match(html, /Неверный логин или пароль/);
});

test("TC-10: пользователь может войти по e-mail", async () => {
  const response = await request(
    "/login",
    form({
      login: "report@example.test",
      password: "report-password",
      next: "",
    }),
  );
  userCookie = cookieFrom(response);
  assert.equal(response.status, 302);
  assert.equal(response.headers.get("location"), "/");
  assert.match(userCookie, /^connect\.sid=/);
});

test("TC-11: авторизованный пользователь открывает профиль", async () => {
  const response = await request("/profile", {
    headers: { cookie: userCookie },
  });
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.match(html, /report_user/);
});

test("TC-12: гостя перенаправляет на вход при оценке трека", async () => {
  const response = await request(
    "/track/report-track/rate",
    form({ value: "5" }),
  );
  assert.equal(response.status, 302);
  assert.equal(
    response.headers.get("location"),
    "/login?next=%2Ftrack%2Freport-track",
  );
});

test("TC-13: оценка авторизованного пользователя сохраняется", async () => {
  const options = form({ value: "5" });
  options.headers.cookie = userCookie;
  const response = await request("/track/report-track/rate", options);
  const rating = db
    .prepare(`
      SELECT tr.value
      FROM track_ratings tr
      JOIN users u ON u.id = tr.user_id
      WHERE u.username = ? AND tr.track_id = ?
    `)
    .get("report_user", "report-track");
  assert.equal(response.status, 302);
  assert.equal(response.headers.get("location"), "/track/report-track#rating");
  assert.equal(rating.value, 5);
});

test("TC-14: обычный пользователь не входит в админ-панель", async () => {
  const response = await request(
    "/admin/login",
    form({ username: "report_user", password: "report-password" }),
  );
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.match(html, /Этому аккаунту нельзя входить в админпанель/);
});

test("TC-15: администратор входит и открывает дашборд", async () => {
  const loginResponse = await request(
    "/admin/login",
    form({ username: "Yoshimru", password: "adminadmin" }),
  );
  adminCookie = cookieFrom(loginResponse);
  assert.equal(loginResponse.status, 302);
  assert.equal(loginResponse.headers.get("location"), "/admin");
  assert.match(adminCookie, /^connect\.sid=/);

  const dashboardResponse = await request("/admin", {
    headers: { cookie: adminCookie },
  });
  const html = await dashboardResponse.text();
  assert.equal(dashboardResponse.status, 200);
  assert.match(html, /Админпанель/);
  assert.match(html, /Треки/);
  assert.match(html, /Пользователи/);
});

test("TC-16: пользователь создаёт плейлист в базе данных", async () => {
  const response = await request(
    "/api/library/playlists",
    json(
      "POST",
      {
        title: "Серверный плейлист",
        description: "Проверка пользовательской библиотеки",
        trackIds: ["report-track"],
        isPublic: true,
      },
      userCookie,
    ),
  );
  const payload = await response.json();
  userPlaylistId = payload.playlist.id;
  const user = db
    .prepare("SELECT id FROM users WHERE username = ?")
    .get("report_user");
  const playlist = db
    .prepare("SELECT owner_id, title, is_public FROM playlists WHERE id = ?")
    .get(userPlaylistId);
  const tracks = db
    .prepare("SELECT track_id FROM playlist_tracks WHERE playlist_id = ?")
    .all(userPlaylistId);

  assert.equal(response.status, 201);
  assert.equal(playlist.owner_id, user.id);
  assert.equal(playlist.title, "Серверный плейлист");
  assert.equal(playlist.is_public, 1);
  assert.deepEqual(tracks, [{ track_id: "report-track" }]);
});

test("TC-17: сервер отклоняет плейлист без названия", async () => {
  const response = await request(
    "/api/library/playlists",
    json(
      "POST",
      {
        title: " ",
        description: "Некорректный плейлист",
        trackIds: ["report-track"],
        isPublic: false,
      },
      userCookie,
    ),
  );
  const payload = await response.json();
  assert.equal(response.status, 400);
  assert.match(payload.error, /Название/);
});

test("TC-18: избранное пользователя сохраняется в базе данных", async () => {
  const response = await request(
    "/api/library/favorites/report-track",
    json("POST", { favorite: true }, userCookie),
  );
  const user = db
    .prepare("SELECT id FROM users WHERE username = ?")
    .get("report_user");
  const favorite = db
    .prepare("SELECT track_id FROM favorites WHERE user_id = ? AND track_id = ?")
    .get(user.id, "report-track");
  assert.equal(response.status, 200);
  assert.equal(favorite.track_id, "report-track");
});

test("TC-19: публичный пользовательский плейлист доступен гостю", async () => {
  const listResponse = await request("/public-playlists");
  const listHtml = await listResponse.text();
  const detailResponse = await request(`/playlists/${userPlaylistId}`);
  const detailHtml = await detailResponse.text();

  assert.equal(listResponse.status, 200);
  assert.match(listHtml, /Серверный плейлист/);
  assert.equal(detailResponse.status, 200);
  assert.match(detailHtml, /Отчётный трек/);
});

test("TC-20: второй пользователь регистрируется с отдельной библиотекой", async () => {
  const response = await request(
    "/register",
    form({
      name: "second_user",
      email: "second@example.test",
      password: "second-password",
      next: "",
    }),
  );
  secondUserCookie = cookieFrom(response);
  assert.equal(response.status, 302);
  assert.match(secondUserCookie, /^connect\.sid=/);
});

test("TC-21: другой пользователь не может изменить чужой плейлист", async () => {
  const response = await request(
    `/api/library/playlists/${userPlaylistId}`,
    json(
      "PUT",
      {
        title: "Чужое изменение",
        description: "",
        trackIds: [],
        isPublic: false,
      },
      secondUserCookie,
    ),
  );
  const playlist = db
    .prepare("SELECT title, is_public FROM playlists WHERE id = ?")
    .get(userPlaylistId);
  assert.equal(response.status, 404);
  assert.equal(playlist.title, "Серверный плейлист");
  assert.equal(playlist.is_public, 1);
});

test("TC-22: библиотеки двух пользователей изолированы", async () => {
  const response = await request("/playlists", {
    headers: { cookie: secondUserCookie },
  });
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.doesNotMatch(html, /Серверный плейлист/);
  assert.match(html, /id="favorite-track-ids">\[\]<\/script>/);
});

test("TC-23: владелец редактирует и удаляет свой плейлист", async () => {
  const updateResponse = await request(
    `/api/library/playlists/${userPlaylistId}`,
    json(
      "PUT",
      {
        title: "Обновлённый плейлист",
        description: "Новое описание",
        trackIds: ["report-track"],
        isPublic: false,
      },
      userCookie,
    ),
  );
  assert.equal(updateResponse.status, 200);
  assert.deepEqual(
    db.prepare("SELECT title, is_public FROM playlists WHERE id = ?").get(
      userPlaylistId,
    ),
    { title: "Обновлённый плейлист", is_public: 0 },
  );

  const deleteResponse = await request(
    `/api/library/playlists/${userPlaylistId}`,
    json("DELETE", undefined, userCookie),
  );
  assert.equal(deleteResponse.status, 204);
  assert.equal(
    db.prepare("SELECT COUNT(*) AS n FROM playlists WHERE id = ?").get(
      userPlaylistId,
    ).n,
    0,
  );
});

test("TC-24: администратор создаёт подборку с треком", async () => {
  const style = db.prepare("SELECT id FROM collection_styles ORDER BY id LIMIT 1").get();
  const response = await request(
    "/admin/collections",
    authenticatedForm(
      {
        title: "Административная подборка",
        tagline: "ADMIN PICKS",
        description: "Создана интеграционным тестом",
        cardClass: style.id,
        featured: "on",
        trackIds: "report-track",
      },
      adminCookie,
    ),
  );
  const collection = db
    .prepare("SELECT id, title, featured FROM collections WHERE title = ?")
    .get("Административная подборка");
  adminCollectionId = collection.id;
  assert.equal(response.status, 302);
  assert.equal(response.headers.get("location"), "/admin/collections");
  assert.equal(collection.featured, 1);
  assert.equal(
    db.prepare("SELECT COUNT(*) AS n FROM collection_tracks WHERE collection_id = ? AND track_id = ?").get(
      adminCollectionId,
      "report-track",
    ).n,
    1,
  );
});

test("TC-25: администратор редактирует все поля подборки", async () => {
  const style = db.prepare("SELECT id FROM collection_styles ORDER BY id DESC LIMIT 1").get();
  const editPage = await request(`/admin/collections/${adminCollectionId}/edit`, {
    headers: { cookie: adminCookie },
  });
  const editHtml = await editPage.text();
  assert.equal(editPage.status, 200);
  assert.match(editHtml, /Редактирование подборки/);

  const response = await request(
    `/admin/collections/${adminCollectionId}/edit`,
    authenticatedForm(
      {
        title: "Обновлённая подборка",
        tagline: "UPDATED",
        description: "Новое описание подборки",
        cardClass: style.id,
        trackIds: "report-track",
      },
      adminCookie,
    ),
  );
  const collection = db
    .prepare("SELECT title, tagline, description, card_class, featured FROM collections WHERE id = ?")
    .get(adminCollectionId);
  assert.equal(response.status, 302);
  assert.deepEqual(collection, {
    title: "Обновлённая подборка",
    tagline: "UPDATED",
    description: "Новое описание подборки",
    card_class: style.id,
    featured: 0,
  });
});

test("TC-26: администратор создаёт и редактирует серверный плейлист", async () => {
  const styles = db.prepare("SELECT id FROM playlist_styles ORDER BY id").all();
  const createResponse = await request(
    "/admin/playlists",
    authenticatedForm(
      {
        title: "Административный плейлист",
        label: "ADMIN MIX",
        description: "Исходное описание",
        artworkClass: styles[0].id,
        isPublic: "on",
        trackIds: "report-track",
      },
      adminCookie,
    ),
  );
  adminPlaylistId = db
    .prepare("SELECT id FROM playlists WHERE title = ?")
    .get("Административный плейлист").id;
  assert.equal(createResponse.status, 302);

  const editPage = await request(`/admin/playlists/${adminPlaylistId}/edit`, {
    headers: { cookie: adminCookie },
  });
  assert.equal(editPage.status, 200);

  const updateResponse = await request(
    `/admin/playlists/${adminPlaylistId}/edit`,
    authenticatedForm(
      {
        title: "Обновлённый серверный плейлист",
        label: "UPDATED MIX",
        description: "Обновлённое описание",
        artworkClass: styles.at(-1).id,
        trackIds: "report-track",
      },
      adminCookie,
    ),
  );
  const playlist = db
    .prepare("SELECT owner_id, title, label, description, artwork_class, is_public FROM playlists WHERE id = ?")
    .get(adminPlaylistId);
  assert.equal(updateResponse.status, 302);
  assert.deepEqual(playlist, {
    owner_id: null,
    title: "Обновлённый серверный плейлист",
    label: "UPDATED MIX",
    description: "Обновлённое описание",
    artwork_class: styles.at(-1).id,
    is_public: 0,
  });
});

test("TC-27: администратор создаёт и редактирует событие", async () => {
  const styles = db.prepare("SELECT id FROM event_styles ORDER BY id").all();
  const createResponse = await request(
    "/admin/events",
    authenticatedForm(
      {
        title: "Административное событие",
        type: "offline",
        venue: "Тестовая сцена",
        location: "Астрахань",
        date: "2026-12-20",
        time: "20:00",
        category: "Концерт",
        tag: "LIVE",
        artworkClass: styles[0].id,
        artworkGlyph: "VS",
        description: "Исходное описание",
      },
      adminCookie,
    ),
  );
  adminEventId = db
    .prepare("SELECT id FROM events WHERE title = ?")
    .get("Административное событие").id;
  assert.equal(createResponse.status, 302);

  const editPage = await request(`/admin/events/${adminEventId}/edit`, {
    headers: { cookie: adminCookie },
  });
  assert.equal(editPage.status, 200);

  const updateResponse = await request(
    `/admin/events/${adminEventId}/edit`,
    authenticatedForm(
      {
        title: "Обновлённое событие",
        type: "online",
        venue: "Онлайн",
        location: "Интернет",
        date: "2027-01-15",
        time: "19:30",
        category: "Трансляция",
        tag: "ONLINE",
        artworkClass: styles.at(-1).id,
        artworkGlyph: "ON",
        description: "Новое описание",
      },
      adminCookie,
    ),
  );
  const event = db
    .prepare("SELECT title, type, venue, location, date, time, category, artwork_class, artwork_glyph, tag, description FROM events WHERE id = ?")
    .get(adminEventId);
  assert.equal(updateResponse.status, 302);
  assert.deepEqual(event, {
    title: "Обновлённое событие",
    type: "online",
    venue: "Онлайн",
    location: "Интернет",
    date: "2027-01-15",
    time: "19:30",
    category: "Трансляция",
    artwork_class: styles.at(-1).id,
    artwork_glyph: "ON",
    tag: "ONLINE",
    description: "Новое описание",
  });
});

test("TC-28: административная валидация отклоняет пустое название", async () => {
  const style = db.prepare("SELECT id FROM collection_styles LIMIT 1").get();
  const response = await request(
    "/admin/collections",
    authenticatedForm(
      {
        title: " ",
        cardClass: style.id,
      },
      adminCookie,
    ),
  );
  assert.equal(response.status, 302);
  assert.match(response.headers.get("location"), /^\/admin\/collections\?error=validation/);
});

test("TC-29: административная валидация отклоняет неверные числа", async () => {
  const style = db.prepare("SELECT id FROM track_styles LIMIT 1").get();
  const response = await request(
    "/admin/tracks",
    authenticatedForm(
      {
        title: "Некорректный трек",
        displayTitle: "Некорректный трек",
        artistId: "report-artist",
        duration: "-1",
        rating: "9",
        artworkClass: style.id,
      },
      adminCookie,
    ),
  );
  assert.equal(response.status, 302);
  assert.match(response.headers.get("location"), /^\/admin\/tracks\?error=validation/);
  assert.equal(
    db.prepare("SELECT COUNT(*) AS n FROM tracks WHERE title = ?").get(
      "Некорректный трек",
    ).n,
    0,
  );
});

test("TC-30: административная валидация отклоняет невозможную дату", async () => {
  const style = db.prepare("SELECT id FROM event_styles LIMIT 1").get();
  const response = await request(
    "/admin/events",
    authenticatedForm(
      {
        title: "Событие с ошибкой",
        type: "offline",
        date: "2026-02-31",
        artworkClass: style.id,
      },
      adminCookie,
    ),
  );
  assert.equal(response.status, 302);
  assert.match(response.headers.get("location"), /^\/admin\/events\?error=validation/);
});

test("TC-31: администратор удаляет созданные сущности", async () => {
  for (const [route, id] of [
    ["collections", adminCollectionId],
    ["playlists", adminPlaylistId],
    ["events", adminEventId],
  ]) {
    const response = await request(
      `/admin/${route}/${id}/delete`,
      authenticatedForm({}, adminCookie),
    );
    assert.equal(response.status, 302);
  }
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM collections WHERE id = ?").get(adminCollectionId).n, 0);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM playlists WHERE id = ?").get(adminPlaylistId).n, 0);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM events WHERE id = ?").get(adminEventId).n, 0);
});
