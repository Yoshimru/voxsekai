const { getDb } = require("../db");

function createRatingRepository(db = getDb()) {
  const statements = {
    summary: db.prepare(`
      SELECT ROUND(AVG(value), 1) AS average, COUNT(*) AS count
      FROM track_ratings
      WHERE track_id = ?
    `),
    userRating: db.prepare(
      "SELECT value FROM track_ratings WHERE user_id = ? AND track_id = ?",
    ),
    upsert: db.prepare(`
      INSERT INTO track_ratings (user_id, track_id, value)
      VALUES (?, ?, ?)
      ON CONFLICT(user_id, track_id)
      DO UPDATE SET value = excluded.value, created_at = datetime('now')
    `),
    updateTrackRating: db.prepare(
      "UPDATE tracks SET rating = ? WHERE id = ?",
    ),
  };

  function summary(trackId) {
    const row = statements.summary.get(trackId);
    return {
      average: row.count ? Number(row.average).toFixed(1) : null,
      count: row.count,
    };
  }

  return {
    getSummary(trackId) {
      return summary(trackId);
    },
    getUserRating(userId, trackId) {
      const row = statements.userRating.get(userId, trackId);
      return row ? row.value : null;
    },
    rate(userId, trackId, value) {
      const rateTrack = db.transaction(() => {
        statements.upsert.run(userId, trackId, value);
        const nextSummary = summary(trackId);
        if (nextSummary.average) {
          statements.updateTrackRating.run(nextSummary.average, trackId);
        }
        return nextSummary;
      });
      return rateTrack();
    },
  };
}

module.exports = createRatingRepository();
module.exports.createRatingRepository = createRatingRepository;
