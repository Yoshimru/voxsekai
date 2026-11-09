const fs = require("node:fs");
const path = require("node:path");
const Database = require("better-sqlite3");
const { artistStyles, trackStyles } = require("../data/stylePresets");
const {
  collectionStyles,
  playlistStyles,
  eventStyles,
} = require("../data/cardStylePresets");
const {
  artists,
  tracks,
  collections,
  playlists,
  events,
} = require("../data/demoCatalog");

const projectRoot = path.resolve(__dirname, "..");
const outputPath = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(projectRoot, "db", "demo", "voxsekai-demo.db");
const activeDatabasePath = path.join(projectRoot, "db", "voxsekai.db");

function validateCatalog() {
  if (artists.length < 5) {
    throw new Error("Демонстрационный каталог должен содержать не менее 5 исполнителей.");
  }

  const artistIds = new Set(artists.map((artist) => artist.id));
  const trackIds = new Set();
  const trackCounts = new Map(artists.map((artist) => [artist.id, 0]));

  tracks.forEach((track) => {
    if (trackIds.has(track.id)) throw new Error(`Повторяющийся ID трека: ${track.id}`);
    if (!artistIds.has(track.artistId)) {
      throw new Error(`У трека ${track.id} указан неизвестный исполнитель ${track.artistId}.`);
    }
    trackIds.add(track.id);
    trackCounts.set(track.artistId, trackCounts.get(track.artistId) + 1);
  });

  trackCounts.forEach((count, artistId) => {
    if (count < 2) throw new Error(`У исполнителя ${artistId} меньше двух треков.`);
  });
}

function insertStyles(db) {
  const insertArtistStyle = db.prepare(`
    INSERT INTO artist_styles
      (id, name, accent, background_start, background_end)
    VALUES (@id, @name, @accent, @backgroundStart, @backgroundEnd)
  `);
  const insertTrackStyle = db.prepare(`
    INSERT INTO track_styles
      (id, name, color_one, color_two, color_three)
    VALUES (@id, @name, @colorOne, @colorTwo, @colorThree)
  `);
  const insertCardStyle = (table) => db.prepare(`
    INSERT INTO ${table}
      (id, name, accent, background_start, background_end)
    VALUES (@id, @name, @accent, @backgroundStart, @backgroundEnd)
  `);
  const cardValues = (style) => ({
    id: style.id,
    name: style.name,
    accent: style.accent,
    backgroundStart: style.backgroundStart,
    backgroundEnd: style.backgroundEnd,
  });

  artistStyles.forEach((style) => insertArtistStyle.run(style));
  trackStyles.forEach((style) => insertTrackStyle.run(style));
  collectionStyles.forEach((style) =>
    insertCardStyle("collection_styles").run(cardValues(style)),
  );
  playlistStyles.forEach((style) =>
    insertCardStyle("playlist_styles").run(cardValues(style)),
  );
  eventStyles.forEach((style) =>
    insertCardStyle("event_styles").run(cardValues(style)),
  );
}

function createDemoDatabase() {
  validateCatalog();
  if (outputPath.toLowerCase() === activeDatabasePath.toLowerCase()) {
    throw new Error("Генератор не записывает шаблон поверх активной рабочей базы.");
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  const temporaryPath = `${outputPath}.build-${process.pid}`;
  [temporaryPath, `${temporaryPath}-wal`, `${temporaryPath}-shm`].forEach((filePath) =>
    fs.rmSync(filePath, { force: true }),
  );

  let databaseBuilt = false;
  const db = new Database(temporaryPath);
  try {
    db.pragma("foreign_keys = ON");
    db.exec(fs.readFileSync(path.join(projectRoot, "db", "schema.sql"), "utf8"));

    const insertArtist = db.prepare(`
      INSERT INTO artists
        (id, name, alias, initials, card_class, genre_label, genres,
         track_count, listeners_label, country, image_url)
      VALUES
        (@id, @name, @alias, @initials, @cardClass, @genreLabel, @genres,
         @trackCount, @listenersLabel, @country, '')
    `);
    const insertTrack = db.prepare(`
      INSERT INTO tracks
        (id, title, display_title, artist, artist_name, duration, genre,
         artwork_class, artwork_glyph, rating, album, release_year,
         description, audio_url, image_url)
      VALUES
        (@id, @title, @displayTitle, @artist, @artistName, @duration, @genre,
         @artworkClass, @artworkGlyph, @rating, @album, @releaseYear,
         @description, NULL, '')
    `);
    const insertArtistTrack = db.prepare(`
      INSERT INTO artist_tracks (artist_id, track_id, position)
      VALUES (?, ?, ?)
    `);
    const insertCollection = db.prepare(`
      INSERT INTO collections (id, title, tagline, description, card_class, featured)
      VALUES (@id, @title, @tagline, @description, @cardClass, @featured)
    `);
    const insertCollectionTrack = db.prepare(`
      INSERT INTO collection_tracks (collection_id, track_id, position)
      VALUES (?, ?, ?)
    `);
    const insertPlaylist = db.prepare(`
      INSERT INTO playlists
        (id, title, description, label, artwork_class, is_public)
      VALUES (@id, @title, @description, @label, @artworkClass, @isPublic)
    `);
    const insertPlaylistTrack = db.prepare(`
      INSERT INTO playlist_tracks (playlist_id, track_id, position)
      VALUES (?, ?, ?)
    `);
    const insertEvent = db.prepare(`
      INSERT INTO events
        (id, title, type, venue, location, date, date_label, day, month, time,
         category, artwork_class, artwork_glyph, tag, description)
      VALUES
        (@id, @title, @type, @venue, @location, @date, @dateLabel, @day, @month, @time,
         @category, @artworkClass, @artworkGlyph, @tag, @description)
    `);

    db.transaction(() => {
      insertStyles(db);
      artists.forEach((artist) => {
        const artistTracks = tracks.filter((track) => track.artistId === artist.id);
        insertArtist.run({
          ...artist,
          genres: JSON.stringify(artist.genres),
          trackCount: artistTracks.length,
        });
      });
      tracks.forEach((track) => {
        const artist = artists.find((item) => item.id === track.artistId);
        insertTrack.run({ ...track, artistName: artist.name });
      });
      artists.forEach((artist) => {
        tracks
          .filter((track) => track.artistId === artist.id)
          .forEach((track, position) => insertArtistTrack.run(artist.id, track.id, position));
      });
      collections.forEach((collection) => {
        insertCollection.run({
          ...collection,
          featured: collection.featured ? 1 : 0,
        });
        collection.trackIds.forEach((trackId, position) =>
          insertCollectionTrack.run(collection.id, trackId, position),
        );
      });
      playlists.forEach((playlist) => {
        insertPlaylist.run({ ...playlist, isPublic: playlist.isPublic ? 1 : 0 });
        playlist.trackIds.forEach((trackId, position) =>
          insertPlaylistTrack.run(playlist.id, trackId, position),
        );
      });
      events.forEach((event) => insertEvent.run(event));
    })();

    db.pragma("journal_mode = DELETE");
    db.exec("VACUUM");
    databaseBuilt = true;
  } finally {
    db.close();
    if (!databaseBuilt) {
      [temporaryPath, `${temporaryPath}-wal`, `${temporaryPath}-shm`].forEach((filePath) =>
        fs.rmSync(filePath, { force: true }),
      );
    }
  }

  const previousPath = `${outputPath}.previous-${process.pid}`;
  fs.rmSync(previousPath, { force: true });
  if (fs.existsSync(outputPath)) fs.renameSync(outputPath, previousPath);
  try {
    fs.renameSync(temporaryPath, outputPath);
    fs.rmSync(previousPath, { force: true });
    [`${outputPath}-wal`, `${outputPath}-shm`].forEach((filePath) =>
      fs.rmSync(filePath, { force: true }),
    );
  } catch (error) {
    if (fs.existsSync(previousPath) && !fs.existsSync(outputPath)) {
      fs.renameSync(previousPath, outputPath);
    }
    fs.rmSync(temporaryPath, { force: true });
    throw error;
  }

  console.log(`Демонстрационная база создана: ${outputPath}`);
  console.log(
    `Исполнителей: ${artists.length}; треков: ${tracks.length}; событий: ${events.length}.`,
  );
}

createDemoDatabase();
