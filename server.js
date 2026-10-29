const express = require("express");
const path = require("node:path");
const session = require("express-session");
const contentRepository = require("./repositories/contentRepository");
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

app.disable("x-powered-by");
app.set("views", viewsDirectory);
app.set("view engine", "ejs");
app.locals.contentRepository = contentRepository;
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use("/assets", express.static(path.join(__dirname, "assets")));
app.use("/admin/assets", express.static(path.join(__dirname, "assets")));
// Сессии нужны админпанели: cookie выделяется и для обычных страниц, но их содержимое пустое.
app.use(
  session({
    secret: "voxsekai-admin-secret-dev",
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: "lax", maxAge: 1000 * 60 * 60 * 8 },
  }),
);
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
    });
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
      const viewData = { title: page.title };
      if (route === "/" || route === "/favorites" || route === "/artists") {
        viewData.tracks = res.locals.trackCatalog;
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
