const express = require("express");
const path = require("node:path");
const session = require("express-session");
const contentRepository = require("./repositories/contentRepository");
const authRepository = require("./repositories/authRepository");
const ratingRepository = require("./repositories/ratingRepository");
const adminRouter = require("./routes/admin");

const app = express();
const port = Number(process.env.PORT) || 3001;
const viewsDirectory = path.join(__dirname, "views");
const pages = {
  "/": { view: "index", title: "VoxSekai \u2014 \u0413\u043b\u0430\u0432\u043d\u0430\u044f" },
  "/artists": {
    view: "pages/artists",
    title: "\u0418\u0441\u043f\u043e\u043b\u043d\u0438\u0442\u0435\u043b\u0438 \u2014 VoxSekai",
  },
  "/catalog": {
    view: "pages/catalog",
    title: "\u041a\u0430\u0442\u0430\u043b\u043e\u0433 \u043c\u0443\u0437\u044b\u043a\u0438 \u2014 VoxSekai",
  },
  "/collections": {
    view: "pages/collections",
    title: "\u041f\u043e\u0434\u0431\u043e\u0440\u043a\u0438 \u2014 VoxSekai",
  },
  "/create-playlist": {
    view: "pages/create-playlist",
    title: "\u0421\u043e\u0437\u0434\u0430\u0442\u044c \u043f\u043b\u0435\u0439\u043b\u0438\u0441\u0442 \u2014 VoxSekai",
  },
  "/events": {
    view: "pages/events",
    title: "\u0421\u043e\u0431\u044b\u0442\u0438\u044f \u2014 VoxSekai",
  },
  "/favorites": {
    view: "pages/favorites",
    title: "\u0418\u0437\u0431\u0440\u0430\u043d\u043d\u043e\u0435 \u2014 VoxSekai",
  },
  "/login": {
    view: "pages/login",
    title: "\u0412\u0445\u043e\u0434 \u2014 VoxSekai",
  },
  "/playlists": {
    view: "pages/playlists",
    title: "\u041c\u043e\u0438 \u043f\u043b\u0435\u0439\u043b\u0438\u0441\u0442\u044b \u2014 VoxSekai",
  },
  "/profile": {
    view: "pages/profile",
    title: "\u041f\u0440\u043e\u0444\u0438\u043b\u044c \u2014 VoxSekai",
  },
  "/public-playlists": {
    view: "pages/public-playlists",
    title: "\u041e\u0442\u043a\u0440\u044b\u0442\u044b\u0435 \u043f\u043b\u0435\u0439\u043b\u0438\u0441\u0442\u044b \u2014 VoxSekai",
  },
  "/register": {
    view: "pages/register",
    title: "\u0420\u0435\u0433\u0438\u0441\u0442\u0440\u0430\u0446\u0438\u044f \u2014 VoxSekai",
  },
};

const protectedPaths = new Set([
  "/playlists",
  "/favorites",
  "/profile",
  "/create-playlist",
]);

const loginTitle = "Вход — VoxSekai";
const registerTitle = "Регистрация — VoxSekai";
const loginView = "pages/login";
const registerView = "pages/register";

/** Разрешаем только внутренние пути, чтобы не открыть редирект на чужой сайт. */
function safeNext(value) {
  const target = typeof value === "string" ? value.trim() : "";
  if (!target.startsWith("/") || target.startsWith("//")) return "";
  return target;
}

function renderLogin(res, { error = "", values = {}, next = "" } = {}) {
  return res.status(error ? 400 : 200).render(loginView, {
    title: loginTitle,
    error,
    values,
    next,
  });
}

function renderRegister(res, { error = "", values = {}, next = "" } = {}) {
  return res.status(error ? 400 : 200).render(registerView, {
    title: registerTitle,
    error,
    values,
    next,
  });
}

/** Считает жанр недели по каталогу; на клиенте он уточняется по избранному. */
function buildTaste(tracks) {
  const counts = new Map();
  tracks.forEach((track) => {
    if (!track.genre) return;
    const current = counts.get(track.genre) || {
      count: 0,
      filter: track.filterGenre || "all",
    };
    current.count += 1;
    if (track.filterGenre && track.filterGenre !== "all") {
      current.filter = track.filterGenre;
    }
    counts.set(track.genre, current);
  });

  const sorted = [...counts.entries()].sort(
    (first, second) =>
      second[1].count - first[1].count ||
      first[0].localeCompare(second[0], "ru"),
  );

  if (!sorted.length) {
    return {
      genre: "Электроника",
      count: 0,
      percent: 0,
      filter: "electronic",
      hasData: false,
      description: "Добавь треки в избранное — и мы определим твой жанр.",
    };
  }

  const [genre, data] = sorted[0];
  return {
    genre,
    count: data.count,
    percent: Math.round((data.count / tracks.length) * 100),
    filter: data.filter,
    hasData: true,
    description: "Тебе особенно близко",
  };
}

app.disable("x-powered-by");
app.set("views", viewsDirectory);
app.set("view engine", "ejs");
app.locals.contentRepository = contentRepository;
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use("/assets", express.static(path.join(__dirname, "assets")));
app.use("/admin/assets", express.static(path.join(__dirname, "assets")));
// Сессии общие для сайта и админпанели: в них хранится id текущего пользователя.
app.use(
  session({
    secret: "voxsekai-admin-secret-dev",
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: "lax", maxAge: 1000 * 60 * 60 * 8 },
  }),
);
// Пользователь из сессии доступен всем публичным шаблонам.
app.use((req, res, next) => {
  const userId = req.session?.userId;
  const user = userId ? authRepository.getUserById(userId) : null;
  if (userId && !user) delete req.session.userId;
  res.locals.currentUser = user;
  next();
});
app.use("/admin", adminRouter);
app.use((req, res, next) => {
  Promise.resolve()
    .then(() => contentRepository.getTracks())
    .then((tracks) => {
      res.locals.trackCatalog = tracks;
      next();
    }, next);
});

app.get("/index.html", (req, res) => res.redirect(301, "/"));

// --- Авторизация пользователей ---
app.post("/login", (req, res, next) => {
  try {
    const login = String(req.body.login || "").trim();
    const password = String(req.body.password || "");
    const nextPath = safeNext(req.body.next);

    const user = login ? authRepository.getUserByLogin(login) : null;
    if (!user || !authRepository.verifyPassword(password, user.passwordHash)) {
      return renderLogin(res, {
        error: "Неверный логин или пароль.",
        values: { login },
        next: nextPath,
      });
    }

    req.session.userId = user.id;
    req.session.save((error) => {
      if (error) return next(error);
      res.redirect(nextPath || "/");
    });
  } catch (error) {
    next(error);
  }
});

app.post("/register", (req, res, next) => {
  try {
    const username = String(req.body.name || "").trim();
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");
    const nextPath = safeNext(req.body.next);

    const errors = [];
    if (username.length < 2 || username.length > 32) {
      errors.push("Имя должно содержать от 2 до 32 символов.");
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      errors.push("Укажи корректный e-mail.");
    }
    if (password.length < 8) {
      errors.push("Пароль должен содержать не менее 8 символов.");
    }
    if (authRepository.getUserByUsername(username)) {
      errors.push("Пользователь с таким именем уже существует.");
    }
    if (email && authRepository.getUserByEmail(email)) {
      errors.push("Этот e-mail уже привязан к аккаунту.");
    }

    if (errors.length) {
      return renderRegister(res, {
        error: errors.join(" "),
        values: { name: username, email },
        next: nextPath,
      });
    }

    const user = authRepository.createUser({ username, email, password });
    req.session.userId = user.id;
    req.session.save((error) => {
      if (error) return next(error);
      res.redirect(nextPath || "/profile");
    });
  } catch (error) {
    next(error);
  }
});

app.post("/logout", (req, res, next) => {
  req.session.destroy((error) => {
    if (error) return next(error);
    res.clearCookie("connect.sid");
    res.redirect("/");
  });
});

const notFoundTitle =
  "404 \u2014 \u0421\u0442\u0440\u0430\u043d\u0438\u0446\u0430 \u043d\u0435 \u043d\u0430\u0439\u0434\u0435\u043d\u0430 | VoxSekai";

app.get("/track/:slug", async (req, res, next) => {
  try {
    const track = await contentRepository.getTrackById(req.params.slug);
    if (!track) return res.status(404).render("pages/404", { title: notFoundTitle });
    res.render("pages/track", {
      title: `${track.displayTitle} — VoxSekai`,
      track,
      tracks: res.locals.trackCatalog,
      ratingSummary: ratingRepository.getSummary(track.id),
      userRating: res.locals.currentUser
        ? ratingRepository.getUserRating(res.locals.currentUser.id, track.id)
        : null,
    });
  } catch (error) {
    next(error);
  }
});

app.post("/track/:slug/rate", (req, res, next) => {
  try {
    const track = contentRepository.getTrackById(req.params.slug);
    if (!track) return res.status(404).render("pages/404", { title: notFoundTitle });
    if (!res.locals.currentUser) {
      return res.redirect(
        `/login?next=${encodeURIComponent(`/track/${track.id}`)}`,
      );
    }
    const value = Number(req.body.value);
    if (Number.isInteger(value) && value >= 1 && value <= 5) {
      ratingRepository.rate(res.locals.currentUser.id, track.id, value);
    }
    res.redirect(`/track/${encodeURIComponent(track.id)}#rating`);
  } catch (error) {
    next(error);
  }
});

app.get("/artists/:slug", async (req, res, next) => {
  try {
    const artist = await contentRepository.getArtistById(req.params.slug);
    if (!artist) return res.status(404).render("pages/404", { title: notFoundTitle });
    const tracks = res.locals.trackCatalog.filter((track) =>
      artist.trackIds.includes(track.id),
    );
    res.render("pages/artist", {
      title: `${artist.name} — VoxSekai`,
      artist,
      tracks,
    });
  } catch (error) {
    next(error);
  }
});

app.get("/collections/:slug", async (req, res, next) => {
  try {
    const collection = await contentRepository.getCollectionById(req.params.slug);
    if (!collection) return res.status(404).render("pages/404", { title: notFoundTitle });
    const tracks = res.locals.trackCatalog.filter((track) =>
      collection.trackIds.includes(track.id),
    );
    res.render("pages/collection", {
      title: `${collection.title} — VoxSekai`,
      collection,
      tracks,
    });
  } catch (error) {
    next(error);
  }
});

app.get("/playlists/:slug", async (req, res, next) => {
  try {
    const playlist = await contentRepository.getPublicPlaylistById(req.params.slug);
    if (!playlist) return res.status(404).render("pages/404", { title: notFoundTitle });
    const tracks = res.locals.trackCatalog.filter((track) =>
      playlist.trackIds.includes(track.id),
    );
    res.render("pages/public-playlist", {
      title: `${playlist.title} — VoxSekai`,
      playlist,
      tracks,
    });
  } catch (error) {
    next(error);
  }
});

app.get("/events/:slug", async (req, res, next) => {
  try {
    const event = await contentRepository.getEventById(req.params.slug);
    if (!event) return res.status(404).render("pages/404", { title: notFoundTitle });
    res.render("pages/event", { title: `${event.title} — VoxSekai`, event });
  } catch (error) {
    next(error);
  }
});

for (const [route, page] of Object.entries(pages)) {
  app.get(route, async (req, res, next) => {
    try {
      if (
        (route === "/login" || route === "/register") &&
        res.locals.currentUser
      ) {
        return res.redirect("/");
      }
      if (protectedPaths.has(route) && !res.locals.currentUser) {
        return res.redirect(
          `/login?next=${encodeURIComponent(req.originalUrl)}`,
        );
      }

      const viewData = { title: page.title };
      if (route === "/login" || route === "/register") {
        viewData.error = "";
        viewData.values = {};
        viewData.next = safeNext(req.query.next);
      }
      if (route === "/" || route === "/favorites" || route === "/artists") {
        viewData.tracks = res.locals.trackCatalog;
      }
      if (route === "/") {
        viewData.taste = buildTaste(res.locals.trackCatalog);
      }
      if (route === "/catalog") {
        const collectionId = req.query.collection;
        const collection = collectionId
          ? await contentRepository.getCollectionById(String(collectionId))
          : null;
        if (collectionId && !collection) {
          return res.status(404).render("pages/404", { title: notFoundTitle });
        }
        const featuredCollection = (await contentRepository.getCollections())
          .find((item) => item.featured) || null;
        viewData.featuredCollection = featuredCollection;
        viewData.collection = collection;
        if (collection) viewData.title = `${collection.title} — VoxSekai`;
        viewData.tracks = collection
          ? res.locals.trackCatalog.filter((track) => collection.trackIds.includes(track.id))
          : res.locals.trackCatalog;
      }
      if (route === "/" || route === "/events") {
        viewData.events = await contentRepository.getEvents();
      }
      if (route === "/artists") {
        viewData.artists = await contentRepository.getArtists();
      }
      if (route === "/collections") {
        viewData.collections = await contentRepository.getCollections();
      }
      if (route === "/playlists") {
        viewData.playlists = await contentRepository.getPlaylists();
        viewData.tracks = res.locals.trackCatalog;
      }
      if (route === "/public-playlists") {
        viewData.playlists = await contentRepository.getPublicPlaylists();
        viewData.tracks = res.locals.trackCatalog;
      }
      if (route === "/profile" || route === "/create-playlist") {
        viewData.tracks = res.locals.trackCatalog;
        viewData.playlists = await contentRepository.getPlaylists();
      }
      res.render(page.view, viewData);
    } catch (error) {
      next(error);
    }
  });
}

for (const [legacyRoute, route] of Object.entries({
  "/pages/artists.html": "/artists",
  "/pages/catalog.html": "/catalog",
  "/pages/collections.html": "/collections",
  "/pages/create-playlist.html": "/create-playlist",
  "/pages/events.html": "/events",
  "/pages/favorites.html": "/favorites",
  "/pages/login.html": "/login",
  "/pages/playlists.html": "/playlists",
  "/pages/profile.html": "/profile",
  "/pages/register.html": "/register",
})) {
  app.get(legacyRoute, (req, res) => res.redirect(301, route));
}

app.get("/pages/404.html", (req, res, next) => {
  res.status(404).render(
    "pages/404",
    { title: notFoundTitle },
    (error, html) => {
      if (error) return next(error);
      res.type("html").send(html);
    },
  );
});

app.use((req, res, next) => {
  res.status(404).render(
    "pages/404",
    { title: notFoundTitle },
    (error, html) => {
      if (error) return next(error);
      res.type("html").send(html);
    },
  );
});

app.use((error, req, res, next) => {
  console.error(error);
  if (res.headersSent) return next(error);
  res.status(500).send("Internal Server Error");
});

if (require.main === module) {
  app.listen(port, () => {
    console.log(`VoxSekai: http://localhost:${port}`);
  });
}

module.exports = app;
