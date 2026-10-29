const { getDb } = require("../db");

// Презентационные маппинги — остались на стороне репозитория, как и раньше.
const genreKeys = {
  "J-pop": "j-pop",
  Электроника: "electronic",
  Синтвейв: "synthwave",
  Эмбиент: "ambient",
  Рок: "rock",
  Dance: "dance",
};

const palettes = {
  "artwork-sakura": ["#b75275", "#6f3a83", "#182a42"],
  "artwork-night": ["#9b4fa1", "#554b9a", "#192b51"],
  "artwork-mono": ["#78878d", "#49515f", "#202735"],
  "artwork-peach": ["#c46e65", "#a64c78", "#3a3056"],
  "artwork-cyan": ["#248c9f", "#41569c", "#173f51"],
  "artwork-violet": ["#7154b4", "#4e3980", "#232c55"],
  "artwork-orange": ["#ce7650", "#a04a72", "#3f2c50"],
  "artwork-pink": ["#c25289", "#7952a6", "#263b5d"],
};

function mapTrack(row) {
  return {
    id: row.id,
    title: row.title,
    displayTitle: row.display_title,
    artist: row.artist,
    artistName: row.artist_name,
    duration: row.duration,
    genre: row.genre,
    artworkClass: row.artwork_class,
    artworkGlyph: row.artwork_glyph,
    rating: row.rating,
    album: row.album,
    releaseYear: row.release_year,
    description: row.description,
    audioUrl: row.audio_url,
    filterGenre: genreKeys[row.genre] || "all",
    artworkColors: [...(palettes[row.artwork_class] || palettes["artwork-cyan"])],
  };
}

function mapArtist(row, trackIds = []) {
  return {
    id: row.id,
    name: row.name,
    alias: row.alias,
    initials: row.initials,
    cardClass: row.card_class,
    genreLabel: row.genre_label,
    genres: JSON.parse(row.genres || "[]"),
    trackCount: row.track_count,
    listenersLabel: row.listeners_label,
    country: row.country,
    trackIds,
    searchText: `${row.name} ${row.alias} ${row.genre_label}`.toLocaleLowerCase("ru"),
  };
}

function mapCollection(row, trackIds = []) {
  return {
    id: row.id,
    title: row.title,
    tagline: row.tagline,
    description: row.description,
    cardClass: row.card_class,
    ...(row.featured === undefined ? {} : { featured: Boolean(row.featured) }),
    trackIds,
    trackCount: trackIds.length,
  };
}

function mapPlaylist(row, trackIds = []) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    label: row.label,
    artworkClass: row.artwork_class,
    isPublic: Boolean(row.is_public),
    trackIds,
    trackCount: trackIds.length,
  };
}

function mapEvent(row) {
  return {
    id: row.id,
    title: row.title,
    type: row.type,
    venue: row.venue,
    location: row.location,
    date: row.date,
    dateLabel: row.date_label,
    day: row.day,
    month: row.month,
    time: row.time,
    category: row.category,
    artworkClass: row.artwork_class,
    artworkGlyph: row.artwork_glyph,
    tag: row.tag,
    description: row.description,
  };
}

function createContentRepository(db = getDb()) {
  const statements = {
    allTracks: db.prepare("SELECT * FROM tracks ORDER BY id"),
    trackById: db.prepare("SELECT * FROM tracks WHERE id = ?"),
    trackIdsByArtist: db.prepare(
      "SELECT track_id FROM artist_tracks WHERE artist_id = ? ORDER BY position",
    ),
    trackIdsByCollection: db.prepare(
      "SELECT track_id FROM collection_tracks WHERE collection_id = ? ORDER BY position",
    ),
    trackIdsByPlaylist: db.prepare(
      "SELECT track_id FROM playlist_tracks WHERE playlist_id = ? ORDER BY position",
    ),
    allArtists: db.prepare("SELECT * FROM artists ORDER BY name"),
    artistById: db.prepare("SELECT * FROM artists WHERE id = ?"),
    allCollections: db.prepare("SELECT * FROM collections ORDER BY id"),
    collectionById: db.prepare("SELECT * FROM collections WHERE id = ?"),
    allPlaylists: db.prepare("SELECT * FROM playlists ORDER BY id"),
    playlistById: db.prepare(
      "SELECT * FROM playlists WHERE id = ? AND is_public = 1",
    ),
    allEvents: db.prepare("SELECT * FROM events ORDER BY date"),
    eventById: db.prepare("SELECT * FROM events WHERE id = ?"),
  };

  function getLinkedTracks(trackIds = []) {
    const ids = new Set(trackIds);
    return statements.allTracks
      .all()
      .filter((row) => ids.has(row.id))
      .map(mapTrack);
  }

  return {
    getTracks() {
      return statements.allTracks.all().map(mapTrack);
    },
    getTrackById(id) {
      const row = statements.trackById.get(id);
      return row ? mapTrack(row) : null;
    },
    getArtists() {
      return statements.allArtists.all().map((row) => {
        const trackIds = statements.trackIdsByArtist
          .all(row.id)
          .map((item) => item.track_id);
        return mapArtist(row, trackIds);
      });
    },
    getArtistById(id) {
      const row = statements.artistById.get(id);
      if (!row) return null;
      const trackIds = statements.trackIdsByArtist
        .all(row.id)
        .map((item) => item.track_id);
      return mapArtist(row, trackIds);
    },
    getCollections() {
      return statements.allCollections.all().map((row) => {
        const trackIds = statements.trackIdsByCollection
          .all(row.id)
          .map((item) => item.track_id);
        return mapCollection(row, trackIds);
      });
    },
    getCollectionById(id) {
      const row = statements.collectionById.get(id);
      if (!row) return null;
      const trackIds = statements.trackIdsByCollection
        .all(row.id)
        .map((item) => item.track_id);
      return mapCollection(row, trackIds);
    },
    getPlaylists() {
      return statements.allPlaylists.all().map((row) => {
        const trackIds = statements.trackIdsByPlaylist
          .all(row.id)
          .map((item) => item.track_id);
        return mapPlaylist(row, trackIds);
      });
    },
    getPublicPlaylists() {
      return statements.allPlaylists
        .all()
        .filter((row) => row.is_public === 1)
        .map((row) => {
          const trackIds = statements.trackIdsByPlaylist
            .all(row.id)
            .map((item) => item.track_id);
          return mapPlaylist(row, trackIds);
        });
    },
    getPublicPlaylistById(id) {
      const row = statements.playlistById.get(id);
      if (!row) return null;
      const trackIds = statements.trackIdsByPlaylist
        .all(row.id)
        .map((item) => item.track_id);
      return mapPlaylist(row, trackIds);
    },
    getEvents() {
      return statements.allEvents.all().map(mapEvent);
    },
    getEventById(id) {
      const row = statements.eventById.get(id);
      return row ? mapEvent(row) : null;
    },
  };
}

module.exports = createContentRepository();
module.exports.createContentRepository = createContentRepository;
