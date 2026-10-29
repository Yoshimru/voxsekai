const { getDb } = require("../db");
const {
  fallbackArtistStyle: defaultArtistPreset,
  fallbackTrackStyle: defaultTrackPreset,
} = require("../data/stylePresets");

// Презентационные маппинги — остались на стороне репозитория, как и раньше.
const genreKeys = {
  "J-pop": "j-pop",
  Электроника: "electronic",
  Синтвейв: "synthwave",
  Эмбиент: "ambient",
  Рок: "rock",
  Dance: "dance",
};

function mapArtistStyle(row) {
  return {
    id: row.id,
    name: row.name,
    accent: row.accent,
    backgroundStart: row.background_start,
    backgroundEnd: row.background_end,
    background: `linear-gradient(135deg, ${row.background_start}, ${row.background_end})`,
  };
}

function mapTrackStyle(row) {
  return {
    id: row.id,
    name: row.name,
    colorOne: row.color_one,
    colorTwo: row.color_two,
    colorThree: row.color_three,
    colors: [row.color_one, row.color_two, row.color_three],
    background: `radial-gradient(circle at 65% 28%, ${row.color_one}, ${row.color_two} 38%, ${row.color_three} 80%)`,
  };
}

const fallbackArtistStyle = {
  ...defaultArtistPreset,
  background: `linear-gradient(135deg, ${defaultArtistPreset.backgroundStart}, ${defaultArtistPreset.backgroundEnd})`,
};

const fallbackTrackStyle = {
  ...defaultTrackPreset,
  colors: [
    defaultTrackPreset.colorOne,
    defaultTrackPreset.colorTwo,
    defaultTrackPreset.colorThree,
  ],
  background: `radial-gradient(circle at 65% 28%, ${defaultTrackPreset.colorOne}, ${defaultTrackPreset.colorTwo} 38%, ${defaultTrackPreset.colorThree} 80%)`,
};

function mapTrack(row, style = fallbackTrackStyle) {
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
    imageUrl: row.image_url || "",
    style,
    filterGenre: genreKeys[row.genre] || "all",
    artworkColors: [...style.colors],
  };
}

function mapArtist(row, trackIds = [], style = fallbackArtistStyle) {
  return {
    id: row.id,
    name: row.name,
    alias: row.alias,
    initials: row.initials,
    cardClass: row.card_class,
    genreLabel: row.genre_label,
    genres: JSON.parse(row.genres || "[]"),
    trackCount: trackIds.length,
    listenersLabel: row.listeners_label,
    country: row.country,
    imageUrl: row.image_url || "",
    style,
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
    allArtistStyles: db.prepare("SELECT * FROM artist_styles ORDER BY name"),
    allTrackStyles: db.prepare("SELECT * FROM track_styles ORDER BY name"),
    artistStyleById: db.prepare("SELECT * FROM artist_styles WHERE id = ?"),
    trackStyleById: db.prepare("SELECT * FROM track_styles WHERE id = ?"),
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
      .map((row) => mapTrack(row));
  }

  function artistStyleMap() {
    return new Map(
      statements.allArtistStyles
        .all()
        .map((row) => [row.id, mapArtistStyle(row)]),
    );
  }

  function trackStyleMap() {
    return new Map(
      statements.allTrackStyles
        .all()
        .map((row) => [row.id, mapTrackStyle(row)]),
    );
  }

  return {
    getTracks() {
      const styles = trackStyleMap();
      return statements.allTracks
        .all()
        .map((row) => mapTrack(row, styles.get(row.artwork_class)));
    },
    getTrackById(id) {
      const row = statements.trackById.get(id);
      if (!row) return null;
      const styleRow = statements.trackStyleById.get(row.artwork_class);
      return mapTrack(
        row,
        styleRow ? mapTrackStyle(styleRow) : fallbackTrackStyle,
      );
    },
    getArtists() {
      const styles = artistStyleMap();
      return statements.allArtists.all().map((row) => {
        const trackIds = statements.trackIdsByArtist
          .all(row.id)
          .map((item) => item.track_id);
        return mapArtist(
          row,
          trackIds,
          styles.get(row.card_class) || fallbackArtistStyle,
        );
      });
    },
    getArtistById(id) {
      const row = statements.artistById.get(id);
      if (!row) return null;
      const trackIds = statements.trackIdsByArtist
        .all(row.id)
        .map((item) => item.track_id);
      const styleRow = statements.artistStyleById.get(row.card_class);
      return mapArtist(
        row,
        trackIds,
        styleRow ? mapArtistStyle(styleRow) : fallbackArtistStyle,
      );
    },
    getArtistStyles() {
      return statements.allArtistStyles.all().map(mapArtistStyle);
    },
    getTrackStyles() {
      return statements.allTrackStyles.all().map(mapTrackStyle);
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
