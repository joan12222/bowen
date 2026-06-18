// Local-first reimplementation of lib/shici.ts against the worker-owned
// SQLite database. Same return shapes as the original (plain query-result
// objects, not lib/types.ts interfaces — callers destructure `.word`/`.senses`
// directly), so Phase 3 can swap the import with no other changes.

import { query, seedShici } from './sqlite/client'
import type { Row } from './sqlite/worker'

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

export async function getRandomShiciWord() {
  await seedShici()
  const countRows = await query('SELECT COUNT(*) AS count FROM shici_words')
  const count = (countRows[0]?.count as number) || 0
  if (!count) return null

  const randomOffset = Math.floor(Math.random() * count)
  const wordRows = await query('SELECT id FROM shici_words ORDER BY id LIMIT 1 OFFSET ?', [randomOffset])
  const wordRow = wordRows[0]
  if (!wordRow) return null
  return getShiciDetail(wordRow.id as number)
}
