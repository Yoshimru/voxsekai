const express = require("express");
const contentRepository = require("../repositories/contentRepository");
const authRepository = require("../repositories/authRepository");
const adminRepository = require("../repositories/adminRepository");

const router = express.Router();

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
      error:
        req.query.error === "artist"
          ? "Выберите исполнителя из списка добавленных."
          : "",
    });
  } catch (error) {
    next(error);
  }
});

router.post("/tracks", (req, res, next) => {
  try {
    const artist = req.body.artistId
      ? contentRepository.getArtistById(String(req.body.artistId))
      : null;
    if (!artist) {
      return res.redirect("/admin/tracks?error=artist");
    }
    adminRepository.createTrack({ ...req.body, artistId: artist.id });
    res.redirect("/admin/tracks");
  } catch (error) {
    next(error);
  }
});

router.post("/tracks/:id/delete", (req, res, next) => {
  try {
    adminRepository.deleteTrack(req.params.id);
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
    });
  } catch (error) {
    next(error);
  }
});

router.post("/artists", (req, res, next) => {
  try {
    adminRepository.createArtist(req.body);
    res.redirect("/admin/artists");
  } catch (error) {
    next(error);
  }
});

router.post("/artists/:id/delete", (req, res, next) => {
  try {
    adminRepository.deleteArtist(req.params.id);
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
