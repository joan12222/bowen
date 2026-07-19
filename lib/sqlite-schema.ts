// SQLite DDL (converted from the original Postgres schema).
// Postgres -> SQLite type mapping used here:
//   UUID          -> TEXT (uuid generated in application code via the `uuid` package)
//   TEXT[]        -> TEXT (JSON-encoded string array, JSON.parse/stringify in lib/db.ts)
//   JSONB         -> TEXT (JSON-encoded string)
//   TIMESTAMPTZ   -> TEXT (ISO 8601 string, new Date(...).toISOString())
//   BOOLEAN       -> INTEGER (0/1)
//   gen_random_uuid() / NOW() defaults -> supplied by application code on insert

export const SQLITE_SCHEMA = `
CREATE TABLE IF NOT EXISTS texts (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  author TEXT NOT NULL,
  dynasty TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT '',
  volume_id TEXT NOT NULL,
  text_type TEXT NOT NULL DEFAULT 'wenyanwen',
  text_order INTEGER NOT NULL DEFAULT 0,
  content TEXT NOT NULL DEFAULT '',
  translation TEXT NOT NULL DEFAULT '',
  appreciation TEXT NOT NULL DEFAULT '',
  is_builtin INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS annotations (
  id TEXT PRIMARY KEY,
  text_id TEXT NOT NULL REFERENCES texts(id) ON DELETE CASCADE,
  word TEXT NOT NULL,
  pinyin TEXT NOT NULL DEFAULT '',
  context TEXT NOT NULL,
  answer TEXT NOT NULL,
  loose TEXT NOT NULL DEFAULT '[]',
  category TEXT NOT NULL,
  is_hsf_word INTEGER NOT NULL DEFAULT 0,
  is_builtin INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sentences (
  id TEXT PRIMARY KEY,
  text_id TEXT NOT NULL REFERENCES texts(id) ON DELETE CASCADE,
  original TEXT NOT NULL,
  translation TEXT NOT NULL,
  key_points TEXT NOT NULL DEFAULT '[]',
  difficulty INTEGER NOT NULL DEFAULT 1,
  is_builtin INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS recitation_questions (
  id TEXT PRIMARY KEY,
  text_id TEXT NOT NULL REFERENCES texts(id) ON DELETE CASCADE,
  prompt TEXT NOT NULL,
  answer TEXT NOT NULL,
  answer_lines TEXT NOT NULL DEFAULT '[]',
  source TEXT NOT NULL DEFAULT '',
  is_builtin INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS multi_meanings (
  id TEXT PRIMARY KEY,
  character TEXT NOT NULL,
  text_id TEXT NOT NULL REFERENCES texts(id) ON DELETE CASCADE,
  context TEXT NOT NULL,
  meaning TEXT NOT NULL,
  usage TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS mistakes (
  id TEXT PRIMARY KEY,
  question_type TEXT NOT NULL,
  reference_id TEXT NOT NULL,
  user_answer TEXT NOT NULL,
  correct_answer TEXT NOT NULL,
  review_count INTEGER NOT NULL DEFAULT 1,
  next_review_at TEXT NOT NULL,
  is_mastered INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS shici_words (
  id INTEGER PRIMARY KEY,
  word TEXT NOT NULL,
  pinyin TEXT NOT NULL,
  char_type TEXT,
  origin TEXT,
  base_meaning TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS shici_senses (
  id TEXT PRIMARY KEY,
  word_id INTEGER REFERENCES shici_words(id) ON DELETE CASCADE,
  pos TEXT NOT NULL,
  meaning TEXT NOT NULL,
  sense_order INTEGER NOT NULL,
  examples TEXT NOT NULL DEFAULT '[]'
);

-- Tracks local-DB bookkeeping, e.g. seed_version (drives first-launch /
-- incremental seeding, see lib/sqlite/worker.ts init and lib/seed/*.json).
CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_annotations_text_id ON annotations(text_id);
CREATE INDEX IF NOT EXISTS idx_annotations_category ON annotations(category);
CREATE INDEX IF NOT EXISTS idx_sentences_text_id ON sentences(text_id);
CREATE INDEX IF NOT EXISTS idx_recitation_questions_text_id ON recitation_questions(text_id);
CREATE INDEX IF NOT EXISTS idx_multi_meanings_character ON multi_meanings(character);
CREATE INDEX IF NOT EXISTS idx_mistakes_next_review ON mistakes(next_review_at) WHERE is_mastered = 0;
`
