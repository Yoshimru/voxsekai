const { getDb } = require("../db");
const db = getDb();
for (const table of ["tracks", "collections", "collection_tracks", "playlists", "playlist_tracks", "events", "users"]) {
  console.log(table, db.prepare(`SELECT COUNT(*) n FROM ${table}`).get().n);
}
