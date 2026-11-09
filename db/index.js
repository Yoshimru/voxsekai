const path = require("node:path");
const fs = require("node:fs");
const Database = require("better-sqlite3");
const {
  artistStyles,
  trackStyles,
} = require("../data/stylePresets");
const {
  collectionStyles,
  playlistStyles,
  eventStyles,
} = require("../data/cardStylePresets");

const schemaSqlPath = path.join(__dirname, "schema.sql");

const dbFilePath = process.env.VOXSEKAI_DB
  ? path.resolve(process.env.VOXSEKAI_DB)
  : path.join(__dirname, "voxsekai.db");

let instance = null;

function getDb() {
  if (instance) return instance;
  fs.mkdirSync(path.dirname(dbFilePath), { recursive: true });
  instance = new Database(dbFilePath);
  instance.pragma("journal_mode = WAL");
  instance.pragma("foreign_keys = ON");
  instance.exec(fs.readFileSync(schemaSqlPath, "utf8"));
  migrate(instance);
  seedStyles(instance);
  return instance;
}

// Простые миграции для баз, созданных до появления новых колонок.
function migrate(db) {
  ensureColumn(db, "users", "email", "TEXT");
  ensureColumn(db, "artists", "image_url", "TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, "tracks", "image_url", "TEXT NOT NULL DEFAULT ''");
  ensureColumn(
    db,
    "playlists",
    "owner_id",
    "INTEGER REFERENCES users(id) ON DELETE CASCADE",
  );
  ensureColumn(
    db,
    "playlists",
    "created_at",
    "TEXT NOT NULL DEFAULT ''",
  );
  ensureColumn(
    db,
    "playlists",
    "updated_at",
    "TEXT NOT NULL DEFAULT ''",
  );
  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_unique
      ON users (email)
      WHERE email IS NOT NULL AND email <> '';

    CREATE INDEX IF NOT EXISTS idx_playlists_owner
      ON playlists (owner_id);

    UPDATE playlists
      SET created_at = datetime('now')
      WHERE created_at = '';

    UPDATE playlists
      SET updated_at = created_at
      WHERE updated_at = '';
  `);
}

function ensureColumn(db, table, column, definition) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!columns.some((item) => item.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

/** Заполняет таблицы стилей стартовыми пресетами, если они ещё пустые. */
function seedStyles(db) {
  const insertArtistStyle = db.prepare(`
    INSERT OR IGNORE INTO artist_styles
      (id, name, accent, background_start, background_end)
    VALUES (@id, @name, @accent, @backgroundStart, @backgroundEnd)
  `);
  const insertTrackStyle = db.prepare(`
    INSERT OR IGNORE INTO track_styles
      (id, name, color_one, color_two, color_three)
    VALUES (@id, @name, @colorOne, @colorTwo, @colorThree)
  `);
  const insertCardStyle = (table) =>
    db.prepare(`
      INSERT OR IGNORE INTO ${table}
        (id, name, accent, background_start, background_end)
      VALUES (@id, @name, @accent, @backgroundStart, @backgroundEnd)
    `);
  const insertCollectionStyle = insertCardStyle("collection_styles");
  const insertPlaylistStyle = insertCardStyle("playlist_styles");
  const insertEventStyle = insertCardStyle("event_styles");
  const cardStyleValues = (style) => ({
    id: style.id,
    name: style.name,
    accent: style.accent,
    backgroundStart: style.backgroundStart,
    backgroundEnd: style.backgroundEnd,
  });

  const isEmpty = (table) =>
    db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n === 0;

  db.transaction(() => {
    if (isEmpty("artist_styles")) {
      artistStyles.forEach((style) => insertArtistStyle.run(style));
    }
    if (isEmpty("track_styles")) {
      trackStyles.forEach((style) => insertTrackStyle.run(style));
    }
    if (isEmpty("collection_styles")) {
      collectionStyles.forEach((style) =>
        insertCollectionStyle.run(cardStyleValues(style)),
      );
    }
    if (isEmpty("playlist_styles")) {
      playlistStyles.forEach((style) =>
        insertPlaylistStyle.run(cardStyleValues(style)),
      );
    }
    if (isEmpty("event_styles")) {
      eventStyles.forEach((style) =>
        insertEventStyle.run(cardStyleValues(style)),
      );
    }
  })();
}

module.exports = { getDb };
