import type Database from "better-sqlite3";

export function initSchema(db: Database) {
  db.exec(`
  CREATE TABLE IF NOT EXISTS sources (
    id TEXT PRIMARY KEY,
    kind TEXT NOT NULL, -- M3U | XTREAM
    name TEXT NOT NULL,
    config_json TEXT NOT NULL,
    headers_json TEXT NOT NULL,
    refresh_interval_minutes INTEGER NOT NULL DEFAULT 360,
    timeout_ms INTEGER NOT NULL DEFAULT 15000,
    last_refresh_at INTEGER,
    last_error TEXT
  );

  CREATE TABLE IF NOT EXISTS channels (
    id TEXT PRIMARY KEY,
    source_id TEXT NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    group_title TEXT,
    logo_url TEXT,
    tvg_id TEXT,
    epg_channel_id TEXT,
    stream_url TEXT NOT NULL,
    stream_type TEXT NOT NULL, -- HLS|MP4|UNKNOWN
    UNIQUE(source_id, stream_url)
  );

  CREATE TABLE IF NOT EXISTS vod (
    id TEXT PRIMARY KEY,
    source_id TEXT NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
    kind TEXT NOT NULL, -- MOVIE|SERIES
    title TEXT NOT NULL,
    category TEXT,
    poster_url TEXT,
    stream_url TEXT,
    UNIQUE(source_id, kind, title)
  );

  CREATE TABLE IF NOT EXISTS episodes (
    id TEXT PRIMARY KEY,
    source_id TEXT NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
    series_id TEXT NOT NULL REFERENCES vod(id) ON DELETE CASCADE,
    season_number INTEGER NOT NULL,
    episode_number INTEGER NOT NULL,
    title TEXT NOT NULL,
    stream_url TEXT NOT NULL,
    UNIQUE(source_id, series_id, season_number, episode_number)
  );

  CREATE TABLE IF NOT EXISTS epg_programs (
    id TEXT PRIMARY KEY,
    source_id TEXT NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
    channel_key TEXT NOT NULL,
    title TEXT NOT NULL,
    start_utc_ms INTEGER NOT NULL,
    end_utc_ms INTEGER NOT NULL,
    desc TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_epg_channel_time
    ON epg_programs(channel_key, start_utc_ms, end_utc_ms);

  CREATE TABLE IF NOT EXISTS favorites (
    id TEXT PRIMARY KEY,
    kind TEXT NOT NULL, -- LIVE|MOVIE|SERIES|EPISODE
    ref_id TEXT NOT NULL, -- channel.id or vod.id or episode.id
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS history (
    id TEXT PRIMARY KEY,
    kind TEXT NOT NULL,
    ref_id TEXT NOT NULL,
    position_seconds REAL NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS profiles (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL, -- KIDS|ADULT
    pin_hash TEXT,      -- bcrypt recommended; this scaffold uses SHA256 (replace in production)
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS profile_locks (
    id TEXT PRIMARY KEY,
    profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    kind TEXT NOT NULL, -- LIVE|MOVIE|SERIES
    value TEXT NOT NULL -- category/group title
  );

  CREATE TABLE IF NOT EXISTS playback_sessions (
    id TEXT PRIMARY KEY,
    kind TEXT NOT NULL, -- LIVE|MOVIE|EPISODE
    url TEXT NOT NULL,
    headers_json TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL
  );
  `);
}
