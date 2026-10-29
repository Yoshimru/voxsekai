const path = require("node:path");
const fs = require("node:fs");
const Database = require("better-sqlite3");

const schemaSqlPath = path.join(__dirname, "schema.sql");

function createDatabase(dbFilePath = path.join(__dirname, "voxsekai.db")) {
  fs.mkdirSync(path.dirname(dbFilePath), { recursive: true });
  const db = new Database(dbFilePath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(fs.readFileSync(schemaSqlPath, "utf8"));
  return db;
}

module.exports = { createDatabase };
