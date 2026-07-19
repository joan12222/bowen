// First-launch (and incremental) seeding of builtin content, fetched at
// runtime from the static JSON snapshots in public/seed/.
//
// Two independent seed tracks, each gated by its own meta.* version key:
//   - builtin-content.json -> texts/annotations/sentences/recitation_questions/
//     multi_meanings, seeded eagerly during worker init (small enough, and the
//     app is unusable without it)
//   - shici-seed.json -> shici_words/shici_senses (~300 entries, ~1.2MB),
//     seeded lazily on first visit to /shici (see seedShiciIfNeeded)
//
// Both use INSERT OR IGNORE keyed on primary key, so re-running after a seed
// version bump only adds new builtin rows — it never overwrites rows the user
// has since edited (translations, custom texts, etc).

export const BUILTIN_CONTENT_SEED_VERSION = 6
export const SHICI_SEED_VERSION = 1

type SQLiteValue = number | string | Uint8Array | bigint | null
type StatementSpec = { sql: string; params?: SQLiteValue[] }

export interface SeedRunner {
  transaction(statements: StatementSpec[]): Promise<Array<{ changes: number }>>
}

function toInt(value: unknown): number {
  return value ? 1 : 0
}

function toJson(value: unknown): string {
  return JSON.stringify(value ?? [])
}

async function fetchSeedJson<T>(path: string): Promise<T> {
  const url = new URL(path, self.location.origin).href
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to fetch seed data ${path}: ${res.status}`)
  return res.json()
}

// Runs `statements` in fixed-size batches so each transaction stays a
// reasonable size (avoids one giant multi-thousand-row transaction blocking
// OPFS writes for an extended stretch).
async function runInChunks(db: SeedRunner, statements: StatementSpec[], chunkSize = 500) {
  for (let i = 0; i < statements.length; i += chunkSize) {
    await db.transaction(statements.slice(i, i + chunkSize))
  }
}

interface BuiltinContentSeed {
  texts: any[]
  annotations: any[]
  sentences: any[]
  recitationQuestions: any[]
  multiMeanings: any[]
}

export async function seedBuiltinContentIfNeeded(db: SeedRunner, currentVersion: number): Promise<void> {
  if (currentVersion >= BUILTIN_CONTENT_SEED_VERSION) return

  const seed = await fetchSeedJson<BuiltinContentSeed>('/seed/builtin-content.json')
  const statements: StatementSpec[] = []

  for (const t of seed.texts) {
    statements.push({
      sql: `INSERT OR IGNORE INTO texts (id, title, author, dynasty, source, volume_id, text_type, text_order, content, translation, appreciation, is_builtin, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      params: [t.id, t.title, t.author, t.dynasty, t.source ?? '', t.volume_id, t.text_type ?? 'wenyanwen', t.text_order ?? 0, t.content ?? '', t.translation ?? '', t.appreciation ?? '', toInt(t.is_builtin), t.created_at],
    })
  }

  for (const a of seed.annotations) {
    statements.push({
      sql: `INSERT OR IGNORE INTO annotations (id, text_id, word, pinyin, context, answer, loose, category, is_hsf_word, is_builtin, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      params: [a.id, a.text_id, a.word, a.pinyin ?? '', a.context, a.answer, toJson(a.loose), a.category, toInt(a.is_hsf_word), toInt(a.is_builtin), a.created_at],
    })
  }

  for (const s of seed.sentences) {
    statements.push({
      sql: `INSERT OR IGNORE INTO sentences (id, text_id, original, translation, key_points, difficulty, is_builtin, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      params: [s.id, s.text_id, s.original, s.translation, toJson(s.key_points), s.difficulty ?? 1, toInt(s.is_builtin), s.created_at],
    })
  }

  for (const r of seed.recitationQuestions) {
    statements.push({
      sql: `INSERT OR IGNORE INTO recitation_questions (id, text_id, prompt, answer, answer_lines, source, is_builtin, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      params: [r.id, r.text_id, r.prompt, r.answer, toJson(r.answer_lines), r.source ?? '', toInt(r.is_builtin), r.created_at],
    })
  }

  for (const m of seed.multiMeanings) {
    statements.push({
      sql: `INSERT OR IGNORE INTO multi_meanings (id, character, text_id, context, meaning, usage)
            VALUES (?, ?, ?, ?, ?, ?)`,
      params: [m.id, m.character, m.text_id, m.context, m.meaning, m.usage ?? ''],
    })
  }

  await runInChunks(db, statements)
}

interface ShiciSeed {
  shiciWords: any[]
  shiciSenses: any[]
}

export async function seedShiciIfNeeded(db: SeedRunner, currentVersion: number): Promise<void> {
  if (currentVersion >= SHICI_SEED_VERSION) return

  const seed = await fetchSeedJson<ShiciSeed>('/seed/shici-seed.json')
  const statements: StatementSpec[] = []

  for (const w of seed.shiciWords) {
    statements.push({
      sql: `INSERT OR IGNORE INTO shici_words (id, word, pinyin, char_type, origin, base_meaning) VALUES (?, ?, ?, ?, ?, ?)`,
      params: [w.id, w.word, w.pinyin, w.char_type ?? null, w.origin ?? null, w.base_meaning],
    })
  }

  for (const s of seed.shiciSenses) {
    statements.push({
      sql: `INSERT OR IGNORE INTO shici_senses (id, word_id, pos, meaning, sense_order, examples) VALUES (?, ?, ?, ?, ?, ?)`,
      params: [s.id, s.word_id, s.pos, s.meaning, s.sense_order, toJson(s.examples)],
    })
  }

  await runInChunks(db, statements)
}
