const crypto = require("node:crypto");
const { getDb } = require("../db");

class LibraryValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "LibraryValidationError";
    this.statusCode = 400;
  }
}

function asTrackIds(value) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) {
    throw new LibraryValidationError("Список треков имеет неверный формат.");
  }
  if (value.length > 200) {
    throw new LibraryValidationError("В одном плейлисте может быть не более 200 треков.");
  }
  return [...new Set(value.map((id) => String(id).trim()).filter(Boolean))];
}

function validatePlaylistInput(input, knownTrackIds) {
  const title = String(input?.title || "").trim();
  const description = String(input?.description || "").trim();
  const trackIds = asTrackIds(input?.trackIds);

  if (!title || title.length > 48) {
    throw new LibraryValidationError("Название должно содержать от 1 до 48 символов.");
  }
  if (description.length > 180) {
    throw new LibraryValidationError("Описание не должно превышать 180 символов.");
  }
  const unknownTrack = trackIds.find((id) => !knownTrackIds.has(id));
  if (unknownTrack) {
    throw new LibraryValidationError("Один из выбранных треков больше не существует.");
  }

  return {
    title,
    description,
    trackIds,
    isPublic: input?.isPublic === true,
  };
}

function createLibraryRepository(db = getDb()) {
  const statements = {
    allTrackIds: db.prepare("SELECT id FROM tracks"),
    trackById: db.prepare("SELECT id FROM tracks WHERE id = ?"),
    playlistById: db.prepare("SELECT id, owner_id FROM playlists WHERE id = ?"),
    insertPlaylist: db.prepare(`
      INSERT INTO playlists
        (id, owner_id, title, description, label, artwork_class, is_public,
         created_at, updated_at)
      VALUES
        (@id, @ownerId, @title, @description, @label, @artworkClass, @isPublic,
         datetime('now'), datetime('now'))
    `),
    updatePlaylist: db.prepare(`
      UPDATE playlists
      SET title = @title,
          description = @description,
          label = @label,
          is_public = @isPublic,
          updated_at = datetime('now')
      WHERE id = @id AND owner_id = @ownerId
    `),
    deletePlaylist: db.prepare(
      "DELETE FROM playlists WHERE id = ? AND owner_id = ?",
    ),
    clearPlaylistTracks: db.prepare(
      "DELETE FROM playlist_tracks WHERE playlist_id = ?",
    ),
    insertPlaylistTrack: db.prepare(`
      INSERT INTO playlist_tracks (playlist_id, track_id, position)
      VALUES (?, ?, ?)
    `),
    touchPlaylist: db.prepare(
      "UPDATE playlists SET updated_at = datetime('now') WHERE id = ?",
    ),
    favoriteIds: db.prepare(
      "SELECT track_id FROM favorites WHERE user_id = ? ORDER BY created_at, track_id",
    ),
    addFavorite: db.prepare(
      "INSERT OR IGNORE INTO favorites (user_id, track_id) VALUES (?, ?)",
    ),
    removeFavorite: db.prepare(
      "DELETE FROM favorites WHERE user_id = ? AND track_id = ?",
    ),
  };

  function knownTrackIds() {
    return new Set(statements.allTrackIds.all().map((row) => row.id));
  }

  function assertOwner(playlistId, userId) {
    const playlist = statements.playlistById.get(playlistId);
    if (!playlist || playlist.owner_id !== userId) return false;
    return true;
  }

  function replaceTracks(playlistId, trackIds) {
    statements.clearPlaylistTracks.run(playlistId);
    trackIds.forEach((trackId, position) => {
      statements.insertPlaylistTrack.run(playlistId, trackId, position);
    });
    statements.touchPlaylist.run(playlistId);
  }

  return {
    getFavoriteTrackIds(userId) {
      return statements.favoriteIds.all(userId).map((row) => row.track_id);
    },

    setFavorite(userId, trackId, favorite) {
      if (!statements.trackById.get(trackId)) {
        throw new LibraryValidationError("Трек не найден.");
      }
      if (favorite) statements.addFavorite.run(userId, trackId);
      else statements.removeFavorite.run(userId, trackId);
      return favorite;
    },

    createPlaylist(userId, input) {
      const fields = validatePlaylistInput(input, knownTrackIds());
      const id = `user-${userId}-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
      const playlist = {
        id,
        ownerId: userId,
        title: fields.title,
        description: fields.description,
        label: fields.title.toLocaleUpperCase("ru").slice(0, 20),
        artworkClass: "playlist-card-custom",
        isPublic: fields.isPublic ? 1 : 0,
      };

      db.transaction(() => {
        statements.insertPlaylist.run(playlist);
        replaceTracks(id, fields.trackIds);
      })();
      return { id, ...fields };
    },

    updatePlaylist(userId, playlistId, input) {
      if (!assertOwner(playlistId, userId)) return null;
      const fields = validatePlaylistInput(input, knownTrackIds());
      db.transaction(() => {
        statements.updatePlaylist.run({
          id: playlistId,
          ownerId: userId,
          title: fields.title,
          description: fields.description,
          label: fields.title.toLocaleUpperCase("ru").slice(0, 20),
          isPublic: fields.isPublic ? 1 : 0,
        });
        replaceTracks(playlistId, fields.trackIds);
      })();
      return { id: playlistId, ...fields };
    },

    setPlaylistTracks(userId, playlistId, rawTrackIds) {
      if (!assertOwner(playlistId, userId)) return null;
      const trackIds = asTrackIds(rawTrackIds);
      const knownIds = knownTrackIds();
      if (trackIds.some((id) => !knownIds.has(id))) {
        throw new LibraryValidationError("Один из выбранных треков больше не существует.");
      }
      db.transaction(() => replaceTracks(playlistId, trackIds))();
      return trackIds;
    },

    deletePlaylist(userId, playlistId) {
      return statements.deletePlaylist.run(playlistId, userId).changes > 0;
    },
  };
}

module.exports = createLibraryRepository();
module.exports.createLibraryRepository = createLibraryRepository;
module.exports.LibraryValidationError = LibraryValidationError;
