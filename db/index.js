const path = require("node:path");
const fs = require("node:fs");
const Database = require("better-sqlite3");

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
  return instance;
}

// Простые миграции для баз, созданных до появления новых колонок.
function migrate(db) {
  const userColumns = db.prepare("PRAGMA table_info(users)").all();
  if (!userColumns.some((column) => column.name === "email")) {
    db.exec("ALTER TABLE users ADD COLUMN email TEXT");
  }
  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_unique
      ON users (email)
      WHERE email IS NOT NULL AND email <> ''
  `);
}

module.exports = { getDb };
