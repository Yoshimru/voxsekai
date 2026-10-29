const path = require("node:path");
const fs = require("node:fs");
const Database = require("better-sqlite3");
const {
  artistStyles,
  trackStyles,
} = require("../data/stylePresets");

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
  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_unique
      ON users (email)
      WHERE email IS NOT NULL AND email <> ''
  `);
}

function ensureColumn(db, table, column, definition) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!columns.some((item) => item.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

/** Заполняет таблицы стилей стартовыми пресетами только при первом запуске. */
function seedStyles(db) {
  const artistStyleCount = db
    .prepare("SELECT COUNT(*) AS n FROM artist_styles")
    .get().n;
  const trackStyleCount = db
    .prepare("SELECT COUNT(*) AS n FROM track_styles")
    .get().n;
  if (artistStyleCount || trackStyleCount) return;

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
  db.transaction(() => {
    artistStyles.forEach((style) => insertArtistStyle.run(style));
    trackStyles.forEach((style) => insertTrackStyle.run(style));
  })();
}

module.exports = { getDb };
