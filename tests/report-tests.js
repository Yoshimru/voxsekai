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
