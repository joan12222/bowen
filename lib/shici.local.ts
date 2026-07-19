// Local-first reimplementation of lib/shici.ts against the worker-owned
// SQLite database. Same return shapes as the original (plain query-result
// objects, not lib/types.ts interfaces — callers destructure `.word`/`.senses`
// directly), so Phase 3 can swap the import with no other changes.

import { query, seedShici } from './sqlite/client'
import type { Row } from './sqlite/worker'
import { buildExampleQuestion, parseExampleRef, type ExampleQuestion } from './shici-practice'

export async function getShiciList() {
  // Lazily seeds the ~300-entry shici dataset on first visit to /shici,
  // rather than blocking every app launch with a ~1.2MB fetch+insert.
  await seedShici()
  const rows = await query('SELECT id, word, pinyin, base_meaning FROM shici_words ORDER BY id')
  return rows as unknown as { id: number; word: string; pinyin: string; base_meaning: string }[]
}

export async function getShiciDetail(id: number) {
  await seedShici()
  const wordRows = await query('SELECT * FROM shici_words WHERE id = ?', [id])
  const senseRows = await query('SELECT * FROM shici_senses WHERE word_id = ? ORDER BY sense_order', [id])

  const word: Row | null = wordRows.length > 0 ? wordRows[0] : null
  const senses = senseRows.map((row) => ({
    ...row,
    examples: typeof row.examples === 'string' ? JSON.parse(row.examples) : [],
  }))

  return { word, senses }
}

export async function getAdjacentShiciIds(id: number) {
  await seedShici()
  const prev = await query('SELECT id FROM shici_words WHERE id < ? ORDER BY id DESC LIMIT 1', [id])
  const next = await query('SELECT id FROM shici_words WHERE id > ? ORDER BY id ASC LIMIT 1', [id])
  return { prevId: (prev[0]?.id as number) ?? null, nextId: (next[0]?.id as number) ?? null }
}

// Restores unmastered 实词 mistakes into replayable example questions for the
// mistake-book redo mode (app/review/practice). Each mistake's referenceId
// (`senseId#exampleIndex`) is resolved back to its word + all senses.
export async function getShiciMistakeQuestions(char?: string): Promise<{ mistakeId: string; question: ExampleQuestion }[]> {
  await seedShici()
  const mistakes = await query(
    "SELECT id, reference_id FROM mistakes WHERE question_type = 'shici' AND is_mastered = 0 ORDER BY created_at ASC"
  )
  if (!mistakes.length) return []

  const detailCache = new Map<number, { word: Row | null; senses: any[] }>()
  const result: { mistakeId: string; question: ExampleQuestion }[] = []

  for (const m of mistakes) {
    const { senseId, exampleIndex } = parseExampleRef(m.reference_id as string)
    const senseRows = await query('SELECT word_id FROM shici_senses WHERE id = ?', [senseId])
    const wordId = senseRows[0]?.word_id as number | undefined
    if (wordId == null) continue

    let detail = detailCache.get(wordId)
    if (!detail) {
      detail = await getShiciDetail(wordId)
      detailCache.set(wordId, detail)
    }
    if (!detail.word) continue
    if (char && detail.word.word !== char) continue // 按词过滤

    const question = buildExampleQuestion(detail.word, detail.senses, senseId, exampleIndex)
    if (question) result.push({ mistakeId: m.id as string, question })
  }
  return result
}
