const express = require("express");
const path = require("node:path");
const tracks = require("./data/tracks");

const app = express();
const port = Number(process.env.PORT) || 3000;
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
  "/register": {
    view: "pages/register",
    title: "\u0420\u0435\u0433\u0438\u0441\u0442\u0440\u0430\u0446\u0438\u044f \u2014 VoxSekai",
  },
};

app.disable("x-powered-by");
app.set("views", viewsDirectory);
app.set("view engine", "ejs");
app.locals.trackCatalog = tracks;
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use("/assets", express.static(path.join(__dirname, "assets")));

app.get("/index.html", (req, res) => res.redirect(301, "/"));

app.get("/track/:slug", (req, res, next) => {
  const track = tracks.find((item) => item.id === req.params.slug);
  if (!track) {
    return res.status(404).render(
      "pages/404",
      {
        title:
          "404 \u2014 \u0421\u0442\u0440\u0430\u043d\u0438\u0446\u0430 \u043d\u0435 \u043d\u0430\u0439\u0434\u0435\u043d\u0430 | VoxSekai",
      },
      (error, html) => {
        if (error) return next(error);
        res.type("html").send(html);
      },
    );
  }

  res.render(
    "pages/track",
    { title: `${track.displayTitle} — VoxSekai`, track, tracks },
    (error, html) => {
      if (error) return next(error);
      res.type("html").send(html);
    },
  );
});

for (const [route, page] of Object.entries(pages)) {
  app.get(route, (req, res, next) => {
    res.render(page.view, { title: page.title }, (error, html) => {
      if (error) return next(error);
      res.type("html").send(html);
    });
  });
}

for (const [legacyRoute, route] of Object.entries({
  "/pages/artists.html": "/artists",
  "/pages/catalog.html": "/catalog",
  "/pages/collections.html": "/collections",
  "/pages/create-playlist.html": "/create-playlist",
  "/pages/events.html": "/events",
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
    {
      title:
        "404 \u2014 \u0421\u0442\u0440\u0430\u043d\u0438\u0446\u0430 \u043d\u0435 \u043d\u0430\u0439\u0434\u0435\u043d\u0430 | VoxSekai",
    },
    (error, html) => {
      if (error) return next(error);
      res.type("html").send(html);
    },
  );
});

app.use((req, res, next) => {
  res.status(404).render(
    "pages/404",
    {
      title:
        "404 \u2014 \u0421\u0442\u0440\u0430\u043d\u0438\u0446\u0430 \u043d\u0435 \u043d\u0430\u0439\u0434\u0435\u043d\u0430 | VoxSekai",
    },
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
