const express = require("express");
const contentRepository = require("../repositories/contentRepository");
const authRepository = require("../repositories/authRepository");
const adminRepository = require("../repositories/adminRepository");
const {
  uploadImage,
  uploadTrackMedia,
  resolveImageUrl,
  resolveAudioUrl,
  cleanupImage,
} = require("../middleware/imageUpload");

const router = express.Router();

function normalizeColor(value, fallback) {
  const color = String(value || "").trim();
  if (/^#[0-9a-f]{6}$/i.test(color)) return color.toLowerCase();
  if (/^#[0-9a-f]{3}$/i.test(color)) {
    return `#${color
      .slice(1)
      .split("")
      .map((character) => character + character)
      .join("")}`.toLowerCase();
  }
  return fallback;
}

function pageError(queryError) {
  if (queryError === "artist") {
    return "Выберите исполнителя из списка добавленных.";
  }
  if (queryError === "upload") {
    return "Не удалось загрузить картинку. Проверьте формат (JPG, PNG, WEBP, GIF, AVIF) и размер до 6 МБ.";
  }
  if (queryError === "notfound") {
    return "Запись не найдена.";
  }
  if (queryError === "inuse") {
    return "Нельзя удалить стиль, который используется в карточках или треках.";
  }
  if (queryError === "style") {
    return "Не удалось сохранить стиль. Проверьте название и цвета.";
  }
  return "";
}

// --- Гарантия наличия админского аккаунта (Yoshimru / adminadmin) ---
authRepository.ensureAdmin("Yoshimru", "adminadmin");

function isAuthed(req) {
  if (!req.session || !req.session.userId) return false;
  const user = authRepository.getUserById(req.session.userId);
  return Boolean(user && user.role === "admin");
}

function requireAdmin(req, res, next) {
  if (!isAuthed(req)) return res.redirect("/admin/login");
  const user = authRepository.getUserById(req.session.userId);
  if (!user) {
    delete req.session.userId;
    return res.redirect("/admin/login");
  }
  res.locals.adminUser = user;
  next();
}

const adminLayoutBase = {
  basePath: "/admin",
  section: "",
};

function render(res, view, data = {}) {
  res.render(view, { ...adminLayoutBase, ...data });
}

// --- Вход / выход ---
router.get("/login", (req, res) => {
  if (isAuthed(req)) return res.redirect("/admin");
  render(res, "pages/admin/login", { title: "Вход в админпанель — VoxSekai", error: null });
});

router.post("/login", (req, res, next) => {
  try {
    const { username, password } = req.body;
    const user = authRepository.getUserByUsername(String(username || ""));
    if (!user || !authRepository.verifyPassword(String(password || ""), user.passwordHash)) {
      return render(res, "pages/admin/login", {
        title: "Вход в админпанель — VoxSekai",
        error: "Неверный логин или пароль.",
      });
    }
    if (user.role !== "admin") {
      return render(res, "pages/admin/login", {
        title: "Вход в админпанель — VoxSekai",
        error: "Этому аккаунту нельзя входить в админпанель.",
      });
    }
    req.session.userId = user.id;
    res.redirect("/admin");
  } catch (error) {
    next(error);
  }
});

router.post("/logout", (req, res, next) => {
  delete req.session.userId;
  res.redirect("/admin/login");
});

router.use(requireAdmin);

// --- Дашборд ---
router.get("/", (req, res, next) => {
  try {
    const db = require("../db").getDb();
    const counts = {
      tracks: db.prepare("SELECT COUNT(*) n FROM tracks").get().n,
      artists: db.prepare("SELECT COUNT(*) n FROM artists").get().n,
      collections: db.prepare("SELECT COUNT(*) n FROM collections").get().n,
      playlists: db.prepare("SELECT COUNT(*) n FROM playlists").get().n,
      events: db.prepare("SELECT COUNT(*) n FROM events").get().n,
      users: authRepository.countUsers(),
    };
    render(res, "pages/admin/dashboard", {
      title: "Админпанель — VoxSekai",
      section: "",
      counts,
    });
  } catch (error) {
    next(error);
  }
});

// --- Треки ---
router.get("/tracks", (req, res, next) => {
  try {
    render(res, "pages/admin/tracks", {
      title: "Треки — админпанель",
      section: "tracks",
      tracks: contentRepository.getTracks(),
      artists: contentRepository.getArtists(),
      trackStyles: contentRepository.getTrackStyles(),
      error: pageError(req.query.error),
    });
  } catch (error) {
    next(error);
  }
});

router.get("/tracks/:id/edit", (req, res, next) => {
  try {
    const track = contentRepository.getTrackById(req.params.id);
    if (!track) return res.redirect("/admin/tracks?error=notfound");
    const artists = contentRepository.getArtists();
    const linkedArtist = artists.find((artist) =>
      artist.trackIds.includes(track.id),
    );
    render(res, "pages/admin/track-edit", {
      title: `Редактирование «${track.displayTitle}» — админпанель`,
      section: "tracks",
      track,
      artists,
      trackStyles: contentRepository.getTrackStyles(),
      selectedArtistId: linkedArtist ? linkedArtist.id : "",
      error: pageError(req.query.error),
    });
  } catch (error) {
    next(error);
  }
});

router.post("/tracks", uploadTrackMedia, (req, res, next) => {
  try {
    if (
      req.mediaUploadError ||
      req.imageUploadError ||
      req.audioUploadError
    ) {
      return res.redirect("/admin/tracks?error=upload");
    }
    const artist = req.body.artistId
      ? contentRepository.getArtistById(String(req.body.artistId))
      : null;
    if (!artist) {
      return res.redirect("/admin/tracks?error=artist");
    }
    adminRepository.createTrack({
      ...req.body,
      artistId: artist.id,
      imageUrl: resolveImageUrl(req),
      audioUrl: resolveAudioUrl(req),
    });
    res.redirect("/admin/tracks");
  } catch (error) {
    next(error);
  }
});

router.post("/tracks/:id/edit", uploadTrackMedia, (req, res, next) => {
  try {
    const track = contentRepository.getTrackById(req.params.id);
    if (!track) return res.redirect("/admin/tracks?error=notfound");
    if (
      req.mediaUploadError ||
      req.imageUploadError ||
      req.audioUploadError
    ) {
      return res.redirect(
        `/admin/tracks/${encodeURIComponent(track.id)}/edit?error=upload`,
      );
    }
    const artist = req.body.artistId
      ? contentRepository.getArtistById(String(req.body.artistId))
      : null;
    if (!artist) {
      return res.redirect(
        `/admin/tracks/${encodeURIComponent(track.id)}/edit?error=artist`,
      );
    }

    const imageUrl = resolveImageUrl(req, track.imageUrl);
    const audioUrl = resolveAudioUrl(req, track.audioUrl);
    adminRepository.updateTrack(track.id, {
      ...req.body,
      artistId: artist.id,
      imageUrl,
      audioUrl,
    });
    cleanupImage(track.imageUrl, imageUrl);
    cleanupImage(track.audioUrl, audioUrl);
    res.redirect("/admin/tracks");
  } catch (error) {
    next(error);
  }
});

router.post("/tracks/:id/delete", (req, res, next) => {
  try {
    const track = contentRepository.getTrackById(req.params.id);
    adminRepository.deleteTrack(req.params.id);
    if (track) {
      cleanupImage(track.imageUrl, "");
      cleanupImage(track.audioUrl, "");
    }
    res.redirect("/admin/tracks");
  } catch (error) {
    next(error);
  }
});

// --- Исполнители ---
router.get("/artists", (req, res, next) => {
  try {
    render(res, "pages/admin/artists", {
      title: "Исполнители — админпанель",
      section: "artists",
      artists: contentRepository.getArtists(),
      cardStyles: contentRepository.getArtistStyles(),
      error: pageError(req.query.error),
    });
  } catch (error) {
    next(error);
  }
});

router.get("/artists/:id/edit", (req, res, next) => {
  try {
    const artist = contentRepository.getArtistById(req.params.id);
    if (!artist) return res.redirect("/admin/artists?error=notfound");
    render(res, "pages/admin/artist-edit", {
      title: `Редактирование «${artist.name}» — админпанель`,
      section: "artists",
      artist,
      cardStyles: contentRepository.getArtistStyles(),
      error: pageError(req.query.error),
    });
  } catch (error) {
    next(error);
  }
});

router.post("/artists", uploadImage, (req, res, next) => {
  try {
    if (req.imageUploadError) {
      return res.redirect("/admin/artists?error=upload");
    }
    adminRepository.createArtist({
      ...req.body,
      imageUrl: resolveImageUrl(req),
    });
    res.redirect("/admin/artists");
  } catch (error) {
    next(error);
  }
});

router.post("/artists/:id/edit", uploadImage, (req, res, next) => {
  try {
    const artist = contentRepository.getArtistById(req.params.id);
    if (!artist) return res.redirect("/admin/artists?error=notfound");
    if (req.imageUploadError) {
      return res.redirect(
        `/admin/artists/${encodeURIComponent(artist.id)}/edit?error=upload`,
      );
    }
    const imageUrl = resolveImageUrl(req, artist.imageUrl);
    adminRepository.updateArtist(artist.id, {
      ...req.body,
      imageUrl,
    });
    cleanupImage(artist.imageUrl, imageUrl);
    res.redirect("/admin/artists");
  } catch (error) {
    next(error);
  }
});

router.post("/artists/:id/delete", (req, res, next) => {
  try {
    const artist = contentRepository.getArtistById(req.params.id);
    adminRepository.deleteArtist(req.params.id);
    if (artist) cleanupImage(artist.imageUrl, "");
    res.redirect("/admin/artists");
  } catch (error) {
    next(error);
  }
});

// --- Стили карточек и обложек ---
router.get("/styles", (req, res, next) => {
  try {
    const artistUsage = adminRepository.getArtistStyleUsage();
    const trackUsage = adminRepository.getTrackStyleUsage();
    const collectionUsage = adminRepository.getCollectionStyleUsage();
    const playlistUsage = adminRepository.getPlaylistStyleUsage();
    const eventUsage = adminRepository.getEventStyleUsage();
    const withUsage = (styles, usage) =>
      styles.map((style) => ({
        ...style,
        usage: usage.get(style.id) || 0,
      }));
    render(res, "pages/admin/styles", {
      title: "Стили — админпанель",
      section: "styles",
      artistStyles: withUsage(
        contentRepository.getArtistStyles(),
        artistUsage,
      ),
      trackStyles: withUsage(contentRepository.getTrackStyles(), trackUsage),
      cardStyleGroups: [
        {
          key: "collections",
          title: "Стили карточек подборок",
          hint: "Градиент и акцент используются в карточках подборок и на странице подборки.",
          glyph: "≋",
          styles: withUsage(
            contentRepository.getCollectionStyles(),
            collectionUsage,
          ),
        },
        {
          key: "playlists",
          title: "Стили карточек плейлистов",
          hint: "Цвета применяются к обложкам плейлистов в библиотеке и публичных плейлистах.",
          glyph: "☷",
          styles: withUsage(
            contentRepository.getPlaylistStyles(),
            playlistUsage,
          ),
        },
        {
          key: "events",
          title: "Стили карточек событий",
          hint: "Цвета применяются к карточкам и странице события.",
          glyph: "✦",
          styles: withUsage(contentRepository.getEventStyles(), eventUsage),
        },
      ],
      error: pageError(req.query.error),
    });
  } catch (error) {
    next(error);
  }
});

router.post("/styles/artists", (req, res, next) => {
  try {
    const name = String(req.body.name || "").trim();
    if (!name) return res.redirect("/admin/styles?error=style");
    adminRepository.createArtistStyle({
      name: name.slice(0, 48),
      accent: normalizeColor(req.body.accent, "#80e8cd"),
      backgroundStart: normalizeColor(req.body.backgroundStart, "#172d39"),
      backgroundEnd: normalizeColor(req.body.backgroundEnd, "#1c5b5b"),
    });
    res.redirect("/admin/styles");
  } catch (error) {
    next(error);
  }
});

router.post("/styles/artists/:id", (req, res, next) => {
  try {
    const current = contentRepository
      .getArtistStyles()
      .find((style) => style.id === req.params.id);
    if (!current) return res.redirect("/admin/styles?error=notfound");
    const name = String(req.body.name || "").trim();
    if (!name) return res.redirect("/admin/styles?error=style");
    adminRepository.updateArtistStyle(current.id, {
      name: name.slice(0, 48),
      accent: normalizeColor(req.body.accent, current.accent),
      backgroundStart: normalizeColor(
        req.body.backgroundStart,
        current.backgroundStart,
      ),
      backgroundEnd: normalizeColor(req.body.backgroundEnd, current.backgroundEnd),
    });
    res.redirect("/admin/styles");
  } catch (error) {
    next(error);
  }
});

router.post("/styles/artists/:id/delete", (req, res, next) => {
  try {
    const deleted = adminRepository.deleteArtistStyle(req.params.id);
    res.redirect(deleted ? "/admin/styles" : "/admin/styles?error=inuse");
  } catch (error) {
    next(error);
  }
});

router.post("/styles/tracks", (req, res, next) => {
  try {
    const name = String(req.body.name || "").trim();
    if (!name) return res.redirect("/admin/styles?error=style");
    adminRepository.createTrackStyle({
      name: name.slice(0, 48),
      colorOne: normalizeColor(req.body.colorOne, "#b6fff0"),
      colorTwo: normalizeColor(req.body.colorTwo, "#217c83"),
      colorThree: normalizeColor(req.body.colorThree, "#182d45"),
    });
    res.redirect("/admin/styles");
  } catch (error) {
    next(error);
  }
});

router.post("/styles/tracks/:id", (req, res, next) => {
  try {
    const current = contentRepository
      .getTrackStyles()
      .find((style) => style.id === req.params.id);
    if (!current) return res.redirect("/admin/styles?error=notfound");
    const name = String(req.body.name || "").trim();
    if (!name) return res.redirect("/admin/styles?error=style");
    adminRepository.updateTrackStyle(current.id, {
      name: name.slice(0, 48),
      colorOne: normalizeColor(req.body.colorOne, current.colorOne),
      colorTwo: normalizeColor(req.body.colorTwo, current.colorTwo),
      colorThree: normalizeColor(req.body.colorThree, current.colorThree),
    });
    res.redirect("/admin/styles");
  } catch (error) {
    next(error);
  }
});

router.post("/styles/tracks/:id/delete", (req, res, next) => {
  try {
    const deleted = adminRepository.deleteTrackStyle(req.params.id);
    res.redirect(deleted ? "/admin/styles" : "/admin/styles?error=inuse");
  } catch (error) {
    next(error);
  }
});

// --- Стили подборок, плейлистов и событий ---
function cardStyleFields(body, current, fallback) {
  const name = String(body.name || "").trim();
  if (!name) return null;
  return {
    name: name.slice(0, 48),
    accent: normalizeColor(body.accent, current?.accent || fallback.accent),
    backgroundStart: normalizeColor(
      body.backgroundStart,
      current?.backgroundStart || fallback.backgroundStart,
    ),
    backgroundEnd: normalizeColor(
      body.backgroundEnd,
      current?.backgroundEnd || fallback.backgroundEnd,
    ),
  };
}

router.post("/styles/collections", (req, res, next) => {
  try {
    const fields = cardStyleFields(req.body, null, {
      accent: "#83c5ed",
      backgroundStart: "#21415c",
      backgroundEnd: "#1f5663",
    });
    if (!fields) return res.redirect("/admin/styles?error=style");
    adminRepository.createCollectionStyle(fields);
    res.redirect("/admin/styles");
  } catch (error) {
    next(error);
  }
});

router.post("/styles/collections/:id", (req, res, next) => {
  try {
    const current = contentRepository
      .getCollectionStyles()
      .find((style) => style.id === req.params.id);
    if (!current) return res.redirect("/admin/styles?error=notfound");
    const fields = cardStyleFields(req.body, current, current);
    if (!fields) return res.redirect("/admin/styles?error=style");
    adminRepository.updateCollectionStyle(current.id, fields);
    res.redirect("/admin/styles");
  } catch (error) {
    next(error);
  }
});

router.post("/styles/collections/:id/delete", (req, res, next) => {
  try {
    const deleted = adminRepository.deleteCollectionStyle(req.params.id);
    res.redirect(deleted ? "/admin/styles" : "/admin/styles?error=inuse");
  } catch (error) {
    next(error);
  }
});

router.post("/styles/playlists", (req, res, next) => {
  try {
    const fields = cardStyleFields(req.body, null, {
      accent: "#ee987d",
      backgroundStart: "#54352f",
      backgroundEnd: "#77443a",
    });
    if (!fields) return res.redirect("/admin/styles?error=style");
    adminRepository.createPlaylistStyle(fields);
    res.redirect("/admin/styles");
  } catch (error) {
    next(error);
  }
});

router.post("/styles/playlists/:id", (req, res, next) => {
  try {
    const current = contentRepository
      .getPlaylistStyles()
      .find((style) => style.id === req.params.id);
    if (!current) return res.redirect("/admin/styles?error=notfound");
    const fields = cardStyleFields(req.body, current, current);
    if (!fields) return res.redirect("/admin/styles?error=style");
    adminRepository.updatePlaylistStyle(current.id, fields);
    res.redirect("/admin/styles");
  } catch (error) {
    next(error);
  }
});

router.post("/styles/playlists/:id/delete", (req, res, next) => {
  try {
    const deleted = adminRepository.deletePlaylistStyle(req.params.id);
    res.redirect(deleted ? "/admin/styles" : "/admin/styles?error=inuse");
  } catch (error) {
    next(error);
  }
});

router.post("/styles/events", (req, res, next) => {
  try {
    const fields = cardStyleFields(req.body, null, {
      accent: "#d586d4",
      backgroundStart: "#492d44",
      backgroundEnd: "#6b3d62",
    });
    if (!fields) return res.redirect("/admin/styles?error=style");
    adminRepository.createEventStyle(fields);
    res.redirect("/admin/styles");
  } catch (error) {
    next(error);
  }
});

router.post("/styles/events/:id", (req, res, next) => {
  try {
    const current = contentRepository
      .getEventStyles()
      .find((style) => style.id === req.params.id);
    if (!current) return res.redirect("/admin/styles?error=notfound");
    const fields = cardStyleFields(req.body, current, current);
    if (!fields) return res.redirect("/admin/styles?error=style");
    adminRepository.updateEventStyle(current.id, fields);
    res.redirect("/admin/styles");
  } catch (error) {
    next(error);
  }
});

router.post("/styles/events/:id/delete", (req, res, next) => {
  try {
    const deleted = adminRepository.deleteEventStyle(req.params.id);
    res.redirect(deleted ? "/admin/styles" : "/admin/styles?error=inuse");
  } catch (error) {
    next(error);
  }
});

// --- Подборки ---
router.get("/collections", (req, res, next) => {
  try {
    render(res, "pages/admin/collections", {
      title: "Подборки — админпанель",
      section: "collections",
      collections: contentRepository.getCollections(),
      tracks: contentRepository.getTracks(),
      cardStyles: contentRepository.getCollectionStyles(),
    });
  } catch (error) {
    next(error);
  }
});

router.post("/collections", (req, res, next) => {
  try {
    adminRepository.createCollection(req.body);
    res.redirect("/admin/collections");
  } catch (error) {
    next(error);
  }
});

router.post("/collections/:id/tracks", (req, res, next) => {
  try {
    adminRepository.setCollectionTracks(req.params.id, req.body.trackIds);
    res.redirect("/admin/collections");
  } catch (error) {
    next(error);
  }
});

router.post("/collections/:id/delete", (req, res, next) => {
  try {
    adminRepository.deleteCollection(req.params.id);
    res.redirect("/admin/collections");
  } catch (error) {
    next(error);
  }
});

// --- Плейлисты ---
router.get("/playlists", (req, res, next) => {
  try {
    render(res, "pages/admin/playlists", {
      title: "Плейлисты — админпанель",
      section: "playlists",
      playlists: contentRepository.getPlaylists(),
      tracks: contentRepository.getTracks(),
      cardStyles: contentRepository.getPlaylistStyles(),
    });
  } catch (error) {
    next(error);
  }
});

router.post("/playlists", (req, res, next) => {
  try {
    adminRepository.createPlaylist(req.body);
    res.redirect("/admin/playlists");
  } catch (error) {
    next(error);
  }
});

router.post("/playlists/:id/tracks", (req, res, next) => {
  try {
    adminRepository.setPlaylistTracks(req.params.id, req.body.trackIds);
    res.redirect("/admin/playlists");
  } catch (error) {
    next(error);
  }
});

router.post("/playlists/:id/delete", (req, res, next) => {
  try {
    adminRepository.deletePlaylist(req.params.id);
    res.redirect("/admin/playlists");
  } catch (error) {
    next(error);
  }
});

// --- События ---
router.get("/events", (req, res, next) => {
  try {
    render(res, "pages/admin/events", {
      title: "События — админпанель",
      section: "events",
      events: contentRepository.getEvents(),
      cardStyles: contentRepository.getEventStyles(),
    });
  } catch (error) {
    next(error);
  }
});

router.post("/events", (req, res, next) => {
  try {
    adminRepository.createEvent(req.body);
    res.redirect("/admin/events");
  } catch (error) {
    next(error);
  }
});

router.post("/events/:id/delete", (req, res, next) => {
  try {
    adminRepository.deleteEvent(req.params.id);
    res.redirect("/admin/events");
  } catch (error) {
    next(error);
  }
});

// --- Пользователи ---
router.get("/users", (req, res, next) => {
  try {
    render(res, "pages/admin/users", {
      title: "Пользователи — админпанель",
      section: "users",
      users: authRepository.getUsers(),
    });
  } catch (error) {
    next(error);
  }
});

router.post("/users", (req, res, next) => {
  try {
    const { username, password, role } = req.body;
    if (username && password) {
      const existing = authRepository.getUserByUsername(String(username).trim());
      if (!existing) {
        authRepository.createUser({
          username: String(username).trim(),
          password: String(password),
          role: role === "admin" ? "admin" : "user",
        });
      }
    }
    res.redirect("/admin/users");
  } catch (error) {
    next(error);
  }
});

router.post("/users/:id/delete", (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (id !== req.session.userId) {
      authRepository.deleteUser(id);
    }
    res.redirect("/admin/users");
  } catch (error) {
    next(error);
  }
});

module.exports = router;
