-- Схема базы данных VoxSekai (SQLite)

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS tracks (
  id            TEXT PRIMARY KEY,
  title         TEXT NOT NULL,
  display_title TEXT NOT NULL,
  artist        TEXT NOT NULL DEFAULT '',
  artist_name   TEXT NOT NULL DEFAULT '',
  duration      INTEGER NOT NULL DEFAULT 0,
  genre         TEXT NOT NULL DEFAULT '',
  artwork_class TEXT NOT NULL DEFAULT 'artwork-cyan',
  artwork_glyph TEXT NOT NULL DEFAULT '',
  rating        TEXT NOT NULL DEFAULT '0',
  album         TEXT,
  release_year  INTEGER,
  description   TEXT,
  audio_url     TEXT,
  image_url     TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS artists (
  id             TEXT PRIMARY KEY,
  name           TEXT NOT NULL,
  alias          TEXT NOT NULL DEFAULT '',
  initials       TEXT NOT NULL DEFAULT '',
  card_class     TEXT NOT NULL DEFAULT '',
  genre_label    TEXT NOT NULL DEFAULT '',
  genres         TEXT NOT NULL DEFAULT '[]',   -- JSON-массив
  track_count    INTEGER NOT NULL DEFAULT 0,
  listeners_label TEXT NOT NULL DEFAULT '',
  country        TEXT NOT NULL DEFAULT '',
  image_url      TEXT NOT NULL DEFAULT ''
);

-- Связь «исполнитель — треки» (многие ко многим)
CREATE TABLE IF NOT EXISTS artist_tracks (
  artist_id TEXT NOT NULL REFERENCES artists(id)  ON DELETE CASCADE,
  track_id  TEXT NOT NULL REFERENCES tracks(id)   ON DELETE CASCADE,
  position  INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (artist_id, track_id)
);

-- Редактируемые стили карточек исполнителей
CREATE TABLE IF NOT EXISTS artist_styles (
  id               TEXT PRIMARY KEY,
  name             TEXT NOT NULL,
  accent           TEXT NOT NULL DEFAULT '#80e8cd',
  background_start TEXT NOT NULL DEFAULT '#172d39',
  background_end   TEXT NOT NULL DEFAULT '#1c5b5b'
);

-- Редактируемые стили обложек треков
CREATE TABLE IF NOT EXISTS track_styles (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  color_one   TEXT NOT NULL DEFAULT '#b6fff0',
  color_two   TEXT NOT NULL DEFAULT '#217c83',
  color_three TEXT NOT NULL DEFAULT '#182d45'
);

-- Стили карточек подборок
CREATE TABLE IF NOT EXISTS collection_styles (
  id               TEXT PRIMARY KEY,
  name             TEXT NOT NULL,
  accent           TEXT NOT NULL DEFAULT '#83c5ed',
  background_start TEXT NOT NULL DEFAULT '#21415c',
  background_end   TEXT NOT NULL DEFAULT '#1f5663'
);

-- Стили карточек плейлистов
CREATE TABLE IF NOT EXISTS playlist_styles (
  id               TEXT PRIMARY KEY,
  name             TEXT NOT NULL,
  accent           TEXT NOT NULL DEFAULT '#ee987d',
  background_start TEXT NOT NULL DEFAULT '#54352f',
  background_end   TEXT NOT NULL DEFAULT '#77443a'
);

-- Стили карточек событий
CREATE TABLE IF NOT EXISTS event_styles (
  id               TEXT PRIMARY KEY,
  name             TEXT NOT NULL,
  accent           TEXT NOT NULL DEFAULT '#d586d4',
  background_start TEXT NOT NULL DEFAULT '#492d44',
  background_end   TEXT NOT NULL DEFAULT '#6b3d62'
);

CREATE TABLE IF NOT EXISTS collections (
  id          TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  tagline     TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  card_class  TEXT NOT NULL DEFAULT '',
  featured    INTEGER NOT NULL DEFAULT 0
);

-- Связь «подборка — треки» (многие ко многим)
CREATE TABLE IF NOT EXISTS collection_tracks (
  collection_id TEXT NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  track_id      TEXT NOT NULL REFERENCES tracks(id)      ON DELETE CASCADE,
  position      INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (collection_id, track_id)
);

CREATE TABLE IF NOT EXISTS playlists (
  id            TEXT PRIMARY KEY,
  owner_id      INTEGER REFERENCES users(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  description   TEXT NOT NULL DEFAULT '',
  label         TEXT NOT NULL DEFAULT '',
  artwork_class TEXT NOT NULL DEFAULT '',
  is_public     INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Связь «плейлист — треки» (многие ко многим)
CREATE TABLE IF NOT EXISTS playlist_tracks (
  playlist_id TEXT NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
  track_id    TEXT NOT NULL REFERENCES tracks(id)    ON DELETE CASCADE,
  position    INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (playlist_id, track_id)
);

CREATE TABLE IF NOT EXISTS events (
  id            TEXT PRIMARY KEY,
  title         TEXT NOT NULL,
  type          TEXT NOT NULL DEFAULT 'offline',  -- 'online' | 'offline'
  venue         TEXT NOT NULL DEFAULT '',
  location      TEXT NOT NULL DEFAULT '',
  date          TEXT NOT NULL,                    -- ISO: YYYY-MM-DD
  date_label    TEXT NOT NULL DEFAULT '',
  day           TEXT NOT NULL DEFAULT '',
  month         TEXT NOT NULL DEFAULT '',
  time          TEXT NOT NULL DEFAULT '',
  category      TEXT NOT NULL DEFAULT '',
  artwork_class TEXT NOT NULL DEFAULT '',
  artwork_glyph TEXT NOT NULL DEFAULT '',
  tag           TEXT NOT NULL DEFAULT '',
  description   TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT NOT NULL UNIQUE,
  email         TEXT,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'user',   -- 'user' | 'admin'
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Пользовательские оценки треков (1–5)
CREATE TABLE IF NOT EXISTS track_ratings (
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  track_id   TEXT NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  value      INTEGER NOT NULL CHECK (value BETWEEN 1 AND 5),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, track_id)
);

-- Избранные треки пользователя
CREATE TABLE IF NOT EXISTS favorites (
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  track_id   TEXT NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, track_id)
);

CREATE INDEX IF NOT EXISTS idx_track_ratings_track ON track_ratings (track_id);
CREATE INDEX IF NOT EXISTS idx_favorites_track ON favorites (track_id);


CREATE INDEX IF NOT EXISTS idx_artist_tracks_track  ON artist_tracks (track_id);
CREATE INDEX IF NOT EXISTS idx_collection_tracks_collection ON collection_tracks (collection_id, position);
CREATE INDEX IF NOT EXISTS idx_playlist_tracks_playlist ON playlist_tracks (playlist_id, position);
