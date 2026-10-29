const express = require("express");
const contentRepository = require("../repositories/contentRepository");
const authRepository = require("../repositories/authRepository");
const adminRepository = require("../repositories/adminRepository");
const {
  uploadImage,
  resolveImageUrl,
  cleanupImage,
} = require("../middleware/imageUpload");

const router = express.Router();

const artistCardStyles = [
  { value: "performer-miku", label: "Miku", hint: "Мятный", initials: "MI" },
  { value: "performer-rin", label: "Rin", hint: "Золотой", initials: "RN" },
  { value: "performer-luka", label: "Luka", hint: "Розовый", initials: "LU" },
  { value: "performer-kaito", label: "Kaito", hint: "Синий", initials: "KA" },
  { value: "performer-mira", label: "Mira", hint: "Индиго", initials: "MK" },
  { value: "performer-meiko", label: "Meiko", hint: "Терракотовый", initials: "ME" },
  { value: "performer-gumi", label: "Gumi", hint: "Зелёный", initials: "GU" },
  { value: "performer-ia", label: "IA", hint: "Фиолетовый", initials: "IA" },
];

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
      selectedArtistId: linkedArtist ? linkedArtist.id : "",
      error: pageError(req.query.error),
    });
  } catch (error) {
    next(error);
  }
});

router.post("/tracks", uploadImage, (req, res, next) => {
  try {
    if (req.imageUploadError) {
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
    });
    res.redirect("/admin/tracks");
  } catch (error) {
    next(error);
  }
});

router.post("/tracks/:id/edit", uploadImage, (req, res, next) => {
  try {
    const track = contentRepository.getTrackById(req.params.id);
    if (!track) return res.redirect("/admin/tracks?error=notfound");
    if (req.imageUploadError) {
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
    adminRepository.updateTrack(track.id, {
      ...req.body,
      artistId: artist.id,
      imageUrl,
    });
    cleanupImage(track.imageUrl, imageUrl);
    res.redirect("/admin/tracks");
  } catch (error) {
    next(error);
  }
});

router.post("/tracks/:id/delete", (req, res, next) => {
  try {
    const track = contentRepository.getTrackById(req.params.id);
    adminRepository.deleteTrack(req.params.id);
    if (track) cleanupImage(track.imageUrl, "");
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
      cardStyles: artistCardStyles,
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
      cardStyles: artistCardStyles,
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

// --- Подборки ---
router.get("/collections", (req, res, next) => {
  try {
    render(res, "pages/admin/collections", {
      title: "Подборки — админпанель",
      section: "collections",
      collections: contentRepository.getCollections(),
      tracks: contentRepository.getTracks(),
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
