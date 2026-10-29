const { getDb } = require("../db");

function normalizeId(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u0400-\u04ff]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function createAdminRepository(db = getDb()) {
  const statements = {
    insertTrack: db.prepare(`
      INSERT INTO tracks (id, title, display_title, artist, artist_name, duration, genre,
        artwork_class, artwork_glyph, rating, album, release_year, description, audio_url, image_url)
      VALUES (@id, @title, @displayTitle, @artist, @artistName, @duration, @genre,
        @artworkClass, @artworkGlyph, @rating, @album, @releaseYear, @description, @audioUrl, @imageUrl)
    `),
    updateTrack: db.prepare(`
      UPDATE tracks SET
        title = @title, display_title = @displayTitle, artist = @artist, artist_name = @artistName,
        duration = @duration, genre = @genre, artwork_class = @artworkClass, artwork_glyph = @artworkGlyph,
        rating = @rating, album = @album, release_year = @releaseYear, description = @description,
        audio_url = @audioUrl, image_url = @imageUrl
      WHERE id = @id
    `),
    deleteTrack: db.prepare("DELETE FROM tracks WHERE id = ?"),
    artistById: db.prepare("SELECT * FROM artists WHERE id = ?"),
    artistIdsByTrack: db.prepare(
      "SELECT artist_id FROM artist_tracks WHERE track_id = ?",
    ),
    clearTrackArtists: db.prepare("DELETE FROM artist_tracks WHERE track_id = ?"),
    insertArtistTrack: db.prepare(
      "INSERT OR IGNORE INTO artist_tracks (artist_id, track_id, position) VALUES (?, ?, ?)",
    ),
    nextArtistTrackPosition: db.prepare(
      "SELECT COALESCE(MAX(position), -1) + 1 AS next_position FROM artist_tracks WHERE artist_id = ?",
    ),
    syncArtistTrackCount: db.prepare(
      "UPDATE artists SET track_count = (SELECT COUNT(*) FROM artist_tracks WHERE artist_id = ?) WHERE id = ?",
    ),

    insertArtist: db.prepare(`
      INSERT INTO artists (id, name, alias, initials, card_class, genre_label, genres,
        track_count, listeners_label, country, image_url)
      VALUES (@id, @name, @alias, @initials, @cardClass, @genreLabel, @genres,
        @trackCount, @listenersLabel, @country, @imageUrl)
    `),
    updateArtist: db.prepare(`
      UPDATE artists SET
        name = @name, alias = @alias, initials = @initials, card_class = @cardClass,
        genre_label = @genreLabel, genres = @genres, listeners_label = @listenersLabel,
        country = @country, image_url = @imageUrl
      WHERE id = @id
    `),
    deleteArtist: db.prepare("DELETE FROM artists WHERE id = ?"),

    allArtistStyles: db.prepare("SELECT * FROM artist_styles ORDER BY name"),
    artistStyleById: db.prepare("SELECT * FROM artist_styles WHERE id = ?"),
    insertArtistStyle: db.prepare(`
      INSERT INTO artist_styles (id, name, accent, background_start, background_end)
      VALUES (@id, @name, @accent, @backgroundStart, @backgroundEnd)
    `),
    updateArtistStyle: db.prepare(`
      UPDATE artist_styles SET
        name = @name, accent = @accent,
        background_start = @backgroundStart, background_end = @backgroundEnd
      WHERE id = @id
    `),
    deleteArtistStyle: db.prepare("DELETE FROM artist_styles WHERE id = ?"),
    countArtistsByStyle: db.prepare(
      "SELECT COUNT(*) AS n FROM artists WHERE card_class = ?",
    ),

    allTrackStyles: db.prepare("SELECT * FROM track_styles ORDER BY name"),
    trackStyleById: db.prepare("SELECT * FROM track_styles WHERE id = ?"),
    insertTrackStyle: db.prepare(`
      INSERT INTO track_styles (id, name, color_one, color_two, color_three)
      VALUES (@id, @name, @colorOne, @colorTwo, @colorThree)
    `),
    updateTrackStyle: db.prepare(`
      UPDATE track_styles SET
        name = @name, color_one = @colorOne,
        color_two = @colorTwo, color_three = @colorThree
      WHERE id = @id
    `),
    deleteTrackStyle: db.prepare("DELETE FROM track_styles WHERE id = ?"),
    countTracksByStyle: db.prepare(
      "SELECT COUNT(*) AS n FROM tracks WHERE artwork_class = ?",
    ),

    insertCollection: db.prepare(`
      INSERT INTO collections (id, title, tagline, description, card_class, featured)
      VALUES (@id, @title, @tagline, @description, @cardClass, @featured)
    `),
    insertCollectionTrack: db.prepare(
      "INSERT OR IGNORE INTO collection_tracks (collection_id, track_id, position) VALUES (?, ?, ?)",
    ),
    clearCollectionTracks: db.prepare(
      "DELETE FROM collection_tracks WHERE collection_id = ?",
    ),
    deleteCollection: db.prepare("DELETE FROM collections WHERE id = ?"),

    insertPlaylist: db.prepare(`
      INSERT INTO playlists (id, title, description, label, artwork_class, is_public)
      VALUES (@id, @title, @description, @label, @artworkClass, @isPublic)
    `),
    insertPlaylistTrack: db.prepare(
      "INSERT OR IGNORE INTO playlist_tracks (playlist_id, track_id, position) VALUES (?, ?, ?)",
    ),
    clearPlaylistTracks: db.prepare("DELETE FROM playlist_tracks WHERE playlist_id = ?"),
    deletePlaylist: db.prepare("DELETE FROM playlists WHERE id = ?"),

    insertEvent: db.prepare(`
      INSERT INTO events (id, title, type, venue, location, date, date_label, day, month,
        time, category, artwork_class, artwork_glyph, tag, description)
      VALUES (@id, @title, @type, @venue, @location, @date, @dateLabel, @day, @month,
        @time, @category, @artworkClass, @artworkGlyph, @tag, @description)
    `),
    deleteEvent: db.prepare("DELETE FROM events WHERE id = ?"),
  };

  function asArray(input) {
    if (input === undefined || input === null) return [];
    if (Array.isArray(input)) return input;
    return [input];
  }

  function parseGenres(input) {
    if (Array.isArray(input)) {
      return input.map((item) => String(item).trim()).filter(Boolean);
    }
    return String(input || "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  function slug(id, fallback) {
    const normalized = id == null ? "" : normalizeId(id);
    return normalized || fallback;
  }

  const existingTrackIds = db.prepare("SELECT id FROM tracks");

  /** Оставляет только id реально существующих треков. */
  function filterTrackIds(trackIds) {
    const known = new Set(existingTrackIds.all().map((row) => row.id));
    return asArray(trackIds).filter((trackId) => known.has(trackId));
  }

  return {
    // --- Треки ---
    createTrack(fields) {
      const artist = fields.artistId
        ? statements.artistById.get(String(fields.artistId))
        : null;
      const artistLabel = artist
        ? [artist.alias, artist.name].filter(Boolean).join(" · ")
        : fields.artist || "";
      const track = {
        id: slug(fields.id, `track-${Date.now()}`),
        title: fields.title || "",
        displayTitle: fields.displayTitle || fields.title || "",
        artist: artistLabel,
        artistName: artist ? artist.name : fields.artistName || "",
        duration: Number(fields.duration) || 0,
        genre: fields.genre || "",
        artworkClass: fields.artworkClass || "artwork-cyan",
        artworkGlyph: fields.artworkGlyph || "♪",
        rating: fields.rating || "0",
        album: fields.album || null,
        releaseYear: fields.releaseYear ? Number(fields.releaseYear) : null,
        description: fields.description || "",
        audioUrl: fields.audioUrl || null,
        imageUrl: fields.imageUrl || "",
      };

      const create = db.transaction(() => {
        statements.insertTrack.run(track);
        if (artist) {
          const position =
            statements.nextArtistTrackPosition.get(artist.id).next_position;
          statements.insertArtistTrack.run(artist.id, track.id, position);
          statements.syncArtistTrackCount.run(artist.id, artist.id);
        }
      });
      create.call(this);
      return track.id;
    },
    updateTrack(id, fields) {
      const row = db.prepare("SELECT * FROM tracks WHERE id = ?").get(id);
      if (!row) return false;

      const oldArtistIds = statements.artistIdsByTrack
        .all(id)
        .map((item) => item.artist_id);
      const artistChanged = fields.artistId !== undefined;
      const targetArtist = fields.artistId
        ? statements.artistById.get(String(fields.artistId))
        : null;
      const artistLabel = targetArtist
        ? [targetArtist.alias, targetArtist.name].filter(Boolean).join(" · ")
        : artistChanged
          ? ""
          : fields.artist ?? row.artist;
      const artistName = targetArtist
        ? targetArtist.name
        : artistChanged
          ? ""
          : fields.artistName ?? row.artist_name;

      const update = db.transaction(() => {
        statements.updateTrack.run({
          id,
          title: fields.title ?? row.title,
          displayTitle: fields.displayTitle ?? row.display_title,
          artist: artistLabel,
          artistName,
          duration:
            fields.duration !== undefined
              ? Number(fields.duration) || 0
              : row.duration,
          genre: fields.genre ?? row.genre,
          artworkClass: fields.artworkClass ?? row.artwork_class,
          artworkGlyph: fields.artworkGlyph ?? row.artwork_glyph,
          rating: fields.rating ?? row.rating,
          album: fields.album ?? row.album,
          releaseYear:
            fields.releaseYear !== undefined
              ? Number(fields.releaseYear) || null
              : row.release_year,
          description: fields.description ?? row.description,
          audioUrl: fields.audioUrl ?? row.audio_url,
          imageUrl:
            fields.imageUrl !== undefined ? fields.imageUrl : row.image_url,
        });

        if (artistChanged) {
          statements.clearTrackArtists.run(id);
          if (targetArtist) {
            const position =
              statements.nextArtistTrackPosition.get(targetArtist.id)
                .next_position;
            statements.insertArtistTrack.run(targetArtist.id, id, position);
          }
        }

        const affectedArtistIds = new Set(oldArtistIds);
        if (targetArtist) affectedArtistIds.add(targetArtist.id);
        affectedArtistIds.forEach((artistId) => {
          statements.syncArtistTrackCount.run(artistId, artistId);
        });
      });

      update();
      return true;
    },
    deleteTrack(id) {
      const artistIds = statements.artistIdsByTrack
        .all(id)
        .map((row) => row.artist_id);
      db.transaction(() => {
        statements.deleteTrack.run(id);
        artistIds.forEach((artistId) => {
          statements.syncArtistTrackCount.run(artistId, artistId);
        });
      })();
    },

    // --- РСЃРїРѕР»РЅРёС‚РµР»Рё ---
    createArtist(fields) {
      const artist = {
        id: slug(fields.id, `artist-${Date.now()}`),
        name: fields.name || "",
        alias: fields.alias || "",
        initials: fields.initials || "",
        cardClass: fields.cardClass || "performer-miku",
        genreLabel: fields.genreLabel || "",
        genres: JSON.stringify(parseGenres(fields.genres)),
        trackCount: 0,
        listenersLabel: fields.listenersLabel || "",
        country: fields.country || "",
        imageUrl: fields.imageUrl || "",
      };
      statements.insertArtist.run(artist);
      return artist.id;
    },
    updateArtist(id, fields) {
      const row = statements.artistById.get(id);
      if (!row) return false;
      statements.updateArtist.run({
        id,
        name: fields.name ?? row.name,
        alias: fields.alias ?? row.alias,
        initials: fields.initials ?? row.initials,
        cardClass: fields.cardClass ?? row.card_class,
        genreLabel: fields.genreLabel ?? row.genre_label,
        genres:
          fields.genres !== undefined
            ? JSON.stringify(parseGenres(fields.genres))
            : row.genres,
        listenersLabel: fields.listenersLabel ?? row.listeners_label,
        country: fields.country ?? row.country,
        imageUrl: fields.imageUrl !== undefined ? fields.imageUrl : row.image_url,
      });
      return true;
    },
    deleteArtist(id) {
      statements.deleteArtist.run(id);
    },

    // --- Стили карточек исполнителей ---
    createArtistStyle(fields) {
      const baseId = slug(
        fields.id || fields.name,
        `artist-style-${Date.now()}`,
      );
      let id = baseId;
      let suffix = 2;
      while (statements.artistStyleById.get(id)) {
        id = `${baseId}-${suffix}`;
        suffix += 1;
      }
      statements.insertArtistStyle.run({
        id,
        name: fields.name || "Новый стиль",
        accent: fields.accent || "#80e8cd",
        backgroundStart: fields.backgroundStart || "#172d39",
        backgroundEnd: fields.backgroundEnd || "#1c5b5b",
      });
      return id;
    },
    updateArtistStyle(id, fields) {
      const row = statements.artistStyleById.get(id);
      if (!row) return false;
      statements.updateArtistStyle.run({
        id,
        name: fields.name || row.name,
        accent: fields.accent || row.accent,
        backgroundStart: fields.backgroundStart || row.background_start,
        backgroundEnd: fields.backgroundEnd || row.background_end,
      });
      return true;
    },
    deleteArtistStyle(id) {
      if (statements.countArtistsByStyle.get(id).n > 0) return false;
      statements.deleteArtistStyle.run(id);
      return true;
    },
    getArtistStyleUsage() {
      const usage = new Map();
      db.prepare(
        "SELECT card_class AS id, COUNT(*) AS n FROM artists GROUP BY card_class",
      )
        .all()
        .forEach((row) => usage.set(row.id, row.n));
      return usage;
    },

    // --- Стили обложек треков ---
    createTrackStyle(fields) {
      const baseId = slug(
        fields.id || fields.name,
        `track-style-${Date.now()}`,
      );
      let id = baseId;
      let suffix = 2;
      while (statements.trackStyleById.get(id)) {
        id = `${baseId}-${suffix}`;
        suffix += 1;
      }
      statements.insertTrackStyle.run({
        id,
        name: fields.name || "Новый стиль",
        colorOne: fields.colorOne || "#b6fff0",
        colorTwo: fields.colorTwo || "#217c83",
        colorThree: fields.colorThree || "#182d45",
      });
      return id;
    },
    updateTrackStyle(id, fields) {
      const row = statements.trackStyleById.get(id);
      if (!row) return false;
      statements.updateTrackStyle.run({
        id,
        name: fields.name || row.name,
        colorOne: fields.colorOne || row.color_one,
        colorTwo: fields.colorTwo || row.color_two,
        colorThree: fields.colorThree || row.color_three,
      });
      return true;
    },
    deleteTrackStyle(id) {
      if (statements.countTracksByStyle.get(id).n > 0) return false;
      statements.deleteTrackStyle.run(id);
      return true;
    },
    getTrackStyleUsage() {
      const usage = new Map();
      db.prepare(
        "SELECT artwork_class AS id, COUNT(*) AS n FROM tracks GROUP BY artwork_class",
      )
        .all()
        .forEach((row) => usage.set(row.id, row.n));
      return usage;
    },

    // --- РџРѕРґР±РѕСЂРєРё ---
    createCollection(fields) {
      const collection = {
        id: slug(fields.id, `collection-${Date.now()}`),
        title: fields.title || "",
        tagline: (fields.tagline || fields.title || "").toLocaleUpperCase("ru"),
        description: fields.description || "",
        cardClass: fields.cardClass || "collection-mood-new",
        featured: fields.featured === "on" || fields.featured === "1" ? 1 : 0,
      };
      const create = db.transaction(() => {
        if (collection.featured) {
          db.prepare("UPDATE collections SET featured = 0").run();
        }
        statements.insertCollection.run(collection);
        this.setCollectionTracks(collection.id, filterTrackIds(fields.trackIds));
      });
      create.call(this);
      return collection.id;
    },
    setCollectionTracks(id, rawTrackIds) {
      return db.transaction(() => {
        statements.clearCollectionTracks.run(id);
        filterTrackIds(rawTrackIds).forEach((trackId, index) => {
          statements.insertCollectionTrack.run(id, trackId, index);
        });
      })();
    },
    deleteCollection(id) {
      statements.deleteCollection.run(id);
    },

    // --- РџР»РµР№Р»РёСЃС‚С‹ ---
    createPlaylist(fields) {
      const playlist = {
        id: slug(fields.id, `playlist-${Date.now()}`),
        title: fields.title || "",
        description: fields.description || "",
        label: (fields.label || fields.title || "").toLocaleUpperCase("ru"),
        artworkClass: fields.artworkClass || "playlist-card-new",
        isPublic: fields.isPublic === "on" || fields.isPublic === "1" ? 1 : 0,
      };
      const create = db.transaction(() => {
        statements.insertPlaylist.run(playlist);
        this.setPlaylistTracks(playlist.id, filterTrackIds(fields.trackIds));
      });
      create.call(this);
      return playlist.id;
    },
    setPlaylistTracks(id, rawTrackIds) {
      return db.transaction(() => {
        statements.clearPlaylistTracks.run(id);
        filterTrackIds(rawTrackIds).forEach((trackId, index) => {
          statements.insertPlaylistTrack.run(id, trackId, index);
        });
      })();
    },
    deletePlaylist(id) {
      statements.deletePlaylist.run(id);
    },

    // --- РЎРѕР±С‹С‚РёСЏ ---
    createEvent(fields) {
      const date = fields.date || new Date().toISOString().slice(0, 10);
      const event = {
        id: slug(fields.id, `event-${Date.now()}`),
        title: fields.title || "",
        type: fields.type === "online" ? "online" : "offline",
        venue: fields.venue || "",
        location: fields.location || "",
        date,
        dateLabel: fields.dateLabel || new Date(date).toLocaleDateString("ru", { day: "numeric", month: "long", year: "numeric" }),
        day: fields.day || date.slice(8, 10),
        month: fields.month || "",
        time: fields.time || "",
        category: fields.category || "",
        artworkClass: fields.artworkClass || "event-card-neon",
        artworkGlyph: fields.artworkGlyph || "в—†",
        tag: (fields.tag || "").toLocaleUpperCase("ru"),
        description: fields.description || "",
      };
      statements.insertEvent.run(event);
      return event.id;
    },
    deleteEvent(id) {
      statements.deleteEvent.run(id);
    },
  };
}

module.exports = createAdminRepository();
module.exports.createAdminRepository = createAdminRepository;
