const express = require("express");
const libraryRepository = require("../repositories/libraryRepository");

const router = express.Router();

function requireUser(req, res, next) {
  if (!res.locals.currentUser) {
    return res.status(401).json({ error: "Необходимо войти в аккаунт." });
  }
  next();
}

function handleLibraryError(error, req, res, next) {
  if (error?.statusCode === 400) {
    return res.status(400).json({ error: error.message });
  }
  next(error);
}

router.use(requireUser);

router.post("/favorites/:trackId", (req, res, next) => {
  try {
    if (typeof req.body.favorite !== "boolean") {
      return res.status(400).json({ error: "Не указано состояние избранного." });
    }
    const favorite = libraryRepository.setFavorite(
      res.locals.currentUser.id,
      String(req.params.trackId),
      req.body.favorite,
    );
    res.json({ trackId: req.params.trackId, favorite });
  } catch (error) {
    handleLibraryError(error, req, res, next);
  }
});

router.post("/playlists", (req, res, next) => {
  try {
    const playlist = libraryRepository.createPlaylist(
      res.locals.currentUser.id,
      req.body,
    );
    res.status(201).json({ playlist });
  } catch (error) {
    handleLibraryError(error, req, res, next);
  }
});

router.put("/playlists/:id", (req, res, next) => {
  try {
    const playlist = libraryRepository.updatePlaylist(
      res.locals.currentUser.id,
      String(req.params.id),
      req.body,
    );
    if (!playlist) {
      return res.status(404).json({ error: "Плейлист не найден." });
    }
    res.json({ playlist });
  } catch (error) {
    handleLibraryError(error, req, res, next);
  }
});

router.put("/playlists/:id/tracks", (req, res, next) => {
  try {
    const trackIds = libraryRepository.setPlaylistTracks(
      res.locals.currentUser.id,
      String(req.params.id),
      req.body.trackIds,
    );
    if (!trackIds) {
      return res.status(404).json({ error: "Плейлист не найден." });
    }
    res.json({ playlistId: req.params.id, trackIds });
  } catch (error) {
    handleLibraryError(error, req, res, next);
  }
});

router.delete("/playlists/:id", (req, res, next) => {
  try {
    const deleted = libraryRepository.deletePlaylist(
      res.locals.currentUser.id,
      String(req.params.id),
    );
    if (!deleted) {
      return res.status(404).json({ error: "Плейлист не найден." });
    }
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

module.exports = router;
