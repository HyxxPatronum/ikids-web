-- Fluent Science Reading relational schema (PostgreSQL 15+ / SQLite-compatible core types)
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student','editor','admin')),
  display_name TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TEXT
);
CREATE TABLE IF NOT EXISTS series (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  subtitle TEXT,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS cards (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL,
  series_id TEXT REFERENCES series(id),
  topic TEXT NOT NULL,
  theme TEXT NOT NULL,
  day INTEGER NOT NULL,
  level TEXT NOT NULL,
  title TEXT NOT NULL,
  big_question TEXT,
  article_structure TEXT NOT NULL,
  image_path TEXT NOT NULL,
  content_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','unpublished','archived')),
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS learning_progress (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  answers_json TEXT NOT NULL DEFAULT '{}',
  steps_json TEXT NOT NULL DEFAULT '[]',
  module_status_json TEXT NOT NULL DEFAULT '{}',
  last_sentence INTEGER NOT NULL DEFAULT -1,
  last_module TEXT NOT NULL DEFAULT 'reading',
  completed_percent INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, card_id)
);
CREATE TABLE IF NOT EXISTS recording_submissions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  target_sentence TEXT NOT NULL,
  file_path TEXT,
  status TEXT NOT NULL DEFAULT 'uploaded' CHECK (status IN ('uploaded','processing','scored','failed')),
  score REAL,
  feedback_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS dictionary_cache (
  word TEXT PRIMARY KEY,
  payload_json TEXT,
  status TEXT NOT NULL CHECK (status IN ('found','not_found')),
  expires_at TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS dictionary_entries (
  word TEXT PRIMARY KEY,
  phonetic TEXT NOT NULL DEFAULT '',
  translation TEXT NOT NULL,
  definition TEXT NOT NULL DEFAULT '',
  pos TEXT NOT NULL DEFAULT '',
  exchange TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT 'ECDICT',
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS published_vocabulary_terms (
  card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  lexeme TEXT NOT NULL,
  surface_form TEXT NOT NULL,
  meaning TEXT NOT NULL DEFAULT '',
  image TEXT NOT NULL DEFAULT '',
  media_json TEXT NOT NULL DEFAULT '{}',
  membership TEXT NOT NULL CHECK (membership IN ('level2','level3','science')),
  source_slug TEXT NOT NULL,
  source_title TEXT NOT NULL DEFAULT '',
  source_theme TEXT NOT NULL DEFAULT '',
  source_image TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (card_id, lexeme)
);
CREATE INDEX IF NOT EXISTS idx_progress_user ON learning_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_cards_status ON cards(status);
CREATE INDEX IF NOT EXISTS idx_cards_series ON cards(series_id);
CREATE INDEX IF NOT EXISTS idx_dictionary_cache_expiry ON dictionary_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_published_vocabulary_lexeme ON published_vocabulary_terms(lexeme);
CREATE INDEX IF NOT EXISTS idx_published_vocabulary_membership ON published_vocabulary_terms(membership, lexeme);
