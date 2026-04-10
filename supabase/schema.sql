-- texts table
CREATE TABLE texts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
  is_builtin BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- annotations table
CREATE TABLE annotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  text_id UUID NOT NULL REFERENCES texts(id) ON DELETE CASCADE,
  word TEXT NOT NULL,
  pinyin TEXT NOT NULL DEFAULT '',
  context TEXT NOT NULL,
  answer TEXT NOT NULL,
  loose TEXT[] NOT NULL DEFAULT '{}',
  category TEXT NOT NULL,
  is_hsf_word BOOLEAN NOT NULL DEFAULT false,
  is_builtin BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- sentences table
CREATE TABLE sentences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  text_id UUID NOT NULL REFERENCES texts(id) ON DELETE CASCADE,
  original TEXT NOT NULL,
  translation TEXT NOT NULL,
  key_points TEXT[] NOT NULL DEFAULT '{}',
  difficulty INTEGER NOT NULL DEFAULT 1,
  is_builtin BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- recitation_questions table
CREATE TABLE recitation_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  text_id UUID NOT NULL REFERENCES texts(id) ON DELETE CASCADE,
  prompt TEXT NOT NULL,
  answer TEXT NOT NULL,
  answer_lines TEXT[] NOT NULL DEFAULT '{}',
  source TEXT NOT NULL DEFAULT '',
  is_builtin BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- multi_meanings table
CREATE TABLE multi_meanings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  character TEXT NOT NULL,
  text_id UUID NOT NULL REFERENCES texts(id) ON DELETE CASCADE,
  context TEXT NOT NULL,
  meaning TEXT NOT NULL,
  usage TEXT NOT NULL DEFAULT ''
);

-- mistakes table
CREATE TABLE mistakes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_type TEXT NOT NULL,
  reference_id UUID NOT NULL,
  user_answer TEXT NOT NULL,
  correct_answer TEXT NOT NULL,
  review_count INTEGER NOT NULL DEFAULT 1,
  next_review_at TIMESTAMPTZ NOT NULL,
  is_mastered BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- shici_cards table（实词300词卡）
CREATE TABLE shici_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  character TEXT NOT NULL,
  seq INTEGER NOT NULL DEFAULT 0,
  pinyin TEXT NOT NULL DEFAULT '',
  etymology TEXT NOT NULL DEFAULT '',
  pos TEXT NOT NULL DEFAULT '',
  meaning TEXT NOT NULL,
  example TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT '',
  sentence_meaning TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_shici_cards_character ON shici_cards(character);
CREATE INDEX idx_annotations_text_id ON annotations(text_id);
CREATE INDEX idx_annotations_category ON annotations(category);
CREATE INDEX idx_sentences_text_id ON sentences(text_id);
CREATE INDEX idx_recitation_questions_text_id ON recitation_questions(text_id);
CREATE INDEX idx_multi_meanings_character ON multi_meanings(character);
CREATE INDEX idx_mistakes_next_review ON mistakes(next_review_at) WHERE is_mastered = false;
