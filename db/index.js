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
  return instance;
}

module.exports = { getDb };
