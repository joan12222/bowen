// Local-first reimplementation of lib/db.ts against the worker-owned SQLite
// database (see lib/sqlite/{worker,client}.ts), replacing every Supabase
// `.from(...).eq()...` call with parameterized `query`/`exec`/`transaction`.
//
// Signatures and return types are kept identical to lib/db.ts on purpose —
// Phase 3 swaps callers from `@/lib/db` to `@/lib/db.local` with no other
// changes. The rowTo* converters are likewise the same shape, adapted for
// SQLite's row representation: JSON-encoded array/object columns need
// JSON.parse, and boolean columns are stored as INTEGER 0/1.

import { exec, query, transaction } from './sqlite/client'
import type { Row, SQLiteValue, StatementSpec } from './sqlite/worker'
import {
  Text, Annotation, Sentence, RecitationQuestion,
  MultiMeaning, Mistake, ShiciCard, VolumeId, TextType, AnnotationCategory, TextWithCounts
} from './types'
import { getNextReviewDate } from './constants'

function newId(): string {
  return crypto.randomUUID()
}

function nowIso(): string {
  return new Date().toISOString()
}

function toBool(value: SQLiteValue): boolean {
  return value === 1
}

function fromBool(value: boolean): number {
  return value ? 1 : 0
}

function parseJsonArray(value: SQLiteValue): string[] {
  if (typeof value !== 'string') return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

// --- Transform helpers (mirror lib/db.ts's rowTo* exactly) ---
function rowToText(row: Row): Text {
  return {
    id: row.id as string,
    title: row.title as string,
    author: row.author as string,
    dynasty: row.dynasty as string,
    source: row.source as string,
    volumeId: row.volume_id as VolumeId,
    textType: (row.text_type as TextType) || 'wenyanwen',
    textOrder: row.text_order as number,
    content: row.content as string,
    translation: (row.translation as string) || undefined,
    appreciation: (row.appreciation as string) || undefined,
    isBuiltin: toBool(row.is_builtin),
    createdAt: new Date(row.created_at as string),
  }
}

function rowToAnnotation(row: Row): Annotation {
  return {
    id: row.id as string,
    textId: row.text_id as string,
    word: row.word as string,
    pinyin: row.pinyin as string,
    context: row.context as string,
    answer: row.answer as string,
    loose: parseJsonArray(row.loose),
    category: row.category as Annotation['category'],
    isHsfWord: toBool(row.is_hsf_word),
    isBuiltin: toBool(row.is_builtin),
    createdAt: new Date(row.created_at as string),
  }
}

function rowToSentence(row: Row): Sentence {
  return {
    id: row.id as string,
    textId: row.text_id as string,
    original: row.original as string,
    translation: row.translation as string,
    keyPoints: parseJsonArray(row.key_points),
    difficulty: row.difficulty as 1 | 2 | 3,
    isBuiltin: toBool(row.is_builtin),
    createdAt: new Date(row.created_at as string),
  }
}

function rowToRecitationQuestion(row: Row): RecitationQuestion {
  return {
    id: row.id as string,
    textId: row.text_id as string,
    prompt: row.prompt as string,
    answer: row.answer as string,
    answerLines: parseJsonArray(row.answer_lines),
    source: row.source as string,
    isBuiltin: toBool(row.is_builtin),
    createdAt: new Date(row.created_at as string),
  }
}

function rowToMultiMeaning(row: Row): MultiMeaning {
  return {
    id: row.id as string,
    character: row.character as string,
    textId: row.text_id as string,
    context: row.context as string,
    meaning: row.meaning as string,
    usage: row.usage as string,
  }
}

function rowToMistake(row: Row): Mistake {
  return {
    id: row.id as string,
    questionType: row.question_type as Mistake['questionType'],
    referenceId: row.reference_id as string,
    userAnswer: row.user_answer as string,
    correctAnswer: row.correct_answer as string,
    reviewCount: row.review_count as number,
    nextReviewAt: new Date(row.next_review_at as string),
    isMastered: toBool(row.is_mastered),
    createdAt: new Date(row.created_at as string),
    annWord: (row.ann_word as string) || undefined,
    annContext: (row.ann_context as string) || undefined,
    annTextTitle: (row.ann_text_title as string) || undefined,
    shiciCharacter: (row.shici_character as string) || undefined,
    shiciExample: (row.shici_example as string) || undefined,
    shiciSource: (row.shici_source as string) || undefined,
  }
}

function rowToShiciCard(row: Row): ShiciCard {
  return {
    id: row.id as string,
    character: row.character as string,
    pinyin: row.pinyin as string,
    etymology: row.etymology as string,
    pos: row.pos as string,
    meaning: row.meaning as string,
    example: row.example as string,
    source: row.source as string,
    sentenceMeaning: row.sentence_meaning as string,
    createdAt: new Date(row.created_at as string),
  }
}

// --- Texts ---
export async function getTexts(volumeId?: VolumeId): Promise<Text[]> {
  const rows = volumeId
    ? await query('SELECT * FROM texts WHERE volume_id = ? ORDER BY text_order ASC', [volumeId])
    : await query('SELECT * FROM texts ORDER BY text_order ASC')
  return rows.map(rowToText)
}

const TEXT_WITH_COUNTS_SELECT = `
  SELECT t.*,
    (SELECT COUNT(*) FROM annotations WHERE text_id = t.id) AS annotation_count,
    (SELECT COUNT(*) FROM sentences WHERE text_id = t.id) AS sentence_count,
    (SELECT COUNT(*) FROM recitation_questions WHERE text_id = t.id) AS recitation_count
  FROM texts t
`

function rowToTextWithCounts(row: Row): TextWithCounts {
  return {
    ...rowToText(row),
    annotationCount: (row.annotation_count as number) || 0,
    sentenceCount: (row.sentence_count as number) || 0,
    recitationCount: (row.recitation_count as number) || 0,
  }
}

export async function getText(id: string): Promise<TextWithCounts | null> {
  const rows = await query(`${TEXT_WITH_COUNTS_SELECT} WHERE t.id = ?`, [id])
  if (!rows.length) return null
  return rowToTextWithCounts(rows[0])
}

export async function createText(data: Omit<Text, 'id' | 'createdAt'>): Promise<Text> {
  const id = newId()
  const createdAt = nowIso()
  await exec(
    `INSERT INTO texts (id, title, author, dynasty, source, volume_id, text_type, text_order, content, translation, appreciation, is_builtin, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, data.title, data.author, data.dynasty, data.source, data.volumeId, data.textType, data.textOrder,
     data.content, data.translation || '', data.appreciation || '', fromBool(data.isBuiltin), createdAt]
  )
  return {
    id, title: data.title, author: data.author, dynasty: data.dynasty, source: data.source,
    volumeId: data.volumeId, textType: data.textType, textOrder: data.textOrder, content: data.content,
    translation: data.translation || undefined, appreciation: data.appreciation || undefined,
    isBuiltin: data.isBuiltin, createdAt: new Date(createdAt),
  }
}

export async function deleteText(id: string): Promise<void> {
  await exec('DELETE FROM texts WHERE id = ? AND is_builtin = 0', [id])
}

export async function updateTextTranslation(
  id: string,
  data: { translation?: string; appreciation?: string }
): Promise<void> {
  const sets: string[] = []
  const params: SQLiteValue[] = []
  if (data.translation !== undefined) { sets.push('translation = ?'); params.push(data.translation) }
  if (data.appreciation !== undefined) { sets.push('appreciation = ?'); params.push(data.appreciation) }
  if (!sets.length) return
  params.push(id)
  await exec(`UPDATE texts SET ${sets.join(', ')} WHERE id = ?`, params)
}

// New: not in lib/db.ts — the content-edit/import routes wrote `content`
// directly via Supabase (app/api/texts/[id]/content/route.ts).
export async function updateTextContent(id: string, content: string): Promise<void> {
  await exec('UPDATE texts SET content = ? WHERE id = ?', [content, id])
}

// New: previously app/api/texts/[id]/{annotations,sentences,recitations}/route.ts
// DELETE handlers — used by the import flow to clear-then-reimport.
export async function clearAnnotationsForText(textId: string): Promise<void> {
  await exec('DELETE FROM annotations WHERE text_id = ?', [textId])
}
export async function clearSentencesForText(textId: string): Promise<void> {
  await exec('DELETE FROM sentences WHERE text_id = ?', [textId])
}
export async function clearRecitationsForText(textId: string): Promise<void> {
  await exec('DELETE FROM recitation_questions WHERE text_id = ?', [textId])
}

// --- Annotations ---
export async function getAnnotations(textId: string, category?: AnnotationCategory): Promise<Annotation[]> {
  const rows = category
    ? await query('SELECT * FROM annotations WHERE text_id = ? AND category = ? ORDER BY created_at ASC', [textId, category])
    : await query('SELECT * FROM annotations WHERE text_id = ? ORDER BY created_at ASC', [textId])
  return rows.map(rowToAnnotation)
}

export async function getAllAnnotations(filters?: { textIds?: string[], category?: AnnotationCategory, hsfOnly?: boolean }): Promise<Annotation[]> {
  const conditions: string[] = []
  const params: SQLiteValue[] = []
  if (filters?.textIds && filters.textIds.length > 0) {
    conditions.push(`text_id IN (${filters.textIds.map(() => '?').join(', ')})`)
    params.push(...filters.textIds)
  }
  if (filters?.category) {
    conditions.push('category = ?')
    params.push(filters.category)
  }
  if (filters?.hsfOnly) {
    conditions.push('is_hsf_word = 1')
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
  const rows = await query(`SELECT * FROM annotations ${where} ORDER BY created_at ASC`, params)
  return rows.map(rowToAnnotation)
}

export async function createAnnotation(data: Omit<Annotation, 'id' | 'createdAt'>): Promise<Annotation> {
  const id = newId()
  const createdAt = nowIso()
  await exec(
    `INSERT INTO annotations (id, text_id, word, pinyin, context, answer, loose, category, is_hsf_word, is_builtin, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, data.textId, data.word, data.pinyin, data.context, data.answer, JSON.stringify(data.loose),
     data.category, fromBool(data.isHsfWord), fromBool(data.isBuiltin), createdAt]
  )
  return { ...data, id, createdAt: new Date(createdAt) }
}

export async function importAnnotations(textId: string, annotations: Omit<Annotation, 'id' | 'createdAt' | 'textId'>[]): Promise<{ success: number, skipped: number }> {
  const existing = await query('SELECT word FROM annotations WHERE text_id = ?', [textId])
  const existingWords = new Set(existing.map((r) => r.word as string))

  const toInsert = annotations.filter(a => !existingWords.has(a.word))
  if (toInsert.length === 0) return { success: 0, skipped: annotations.length }

  const statements: StatementSpec[] = toInsert.map((a) => ({
    sql: `INSERT INTO annotations (id, text_id, word, pinyin, context, answer, loose, category, is_hsf_word, is_builtin, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    params: [newId(), textId, a.word, a.pinyin, a.context, a.answer, JSON.stringify(a.loose),
             a.category, fromBool(a.isHsfWord), fromBool(a.isBuiltin), nowIso()],
  }))
  await transaction(statements)
  return { success: toInsert.length, skipped: annotations.length - toInsert.length }
}

// --- Sentences ---
export async function getSentences(textId?: string, difficulty?: number): Promise<Sentence[]> {
  const conditions: string[] = []
  const params: SQLiteValue[] = []
  if (textId) { conditions.push('text_id = ?'); params.push(textId) }
  if (difficulty) { conditions.push('difficulty = ?'); params.push(difficulty) }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
  const rows = await query(`SELECT * FROM sentences ${where} ORDER BY created_at ASC`, params)
  return rows.map(rowToSentence)
}

export async function importSentences(textId: string, sentences: Omit<Sentence, 'id' | 'createdAt' | 'textId'>[]): Promise<{ success: number, skipped: number }> {
  const existing = await query('SELECT original FROM sentences WHERE text_id = ?', [textId])
  const existingOriginals = new Set(existing.map((r) => r.original as string))

  const toInsert = sentences.filter(s => !existingOriginals.has(s.original))
  if (toInsert.length === 0) return { success: 0, skipped: sentences.length }

  const statements: StatementSpec[] = toInsert.map((s) => ({
    sql: `INSERT INTO sentences (id, text_id, original, translation, key_points, difficulty, is_builtin, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    params: [newId(), textId, s.original, s.translation, JSON.stringify(s.keyPoints), s.difficulty, fromBool(s.isBuiltin), nowIso()],
  }))
  await transaction(statements)
  return { success: toInsert.length, skipped: sentences.length - toInsert.length }
}

// --- Recitation Questions ---
export async function getRecitationQuestions(textId?: string): Promise<RecitationQuestion[]> {
  const rows = textId
    ? await query('SELECT * FROM recitation_questions WHERE text_id = ? ORDER BY created_at ASC', [textId])
    : await query('SELECT * FROM recitation_questions ORDER BY created_at ASC')
  return rows.map(rowToRecitationQuestion)
}

export async function importRecitationQuestions(textId: string, questions: Omit<RecitationQuestion, 'id' | 'createdAt' | 'textId'>[]): Promise<{ success: number, skipped: number }> {
  const existing = await query('SELECT prompt FROM recitation_questions WHERE text_id = ?', [textId])
  const existingPrompts = new Set(existing.map((r) => r.prompt as string))

  const toInsert = questions.filter(q => !existingPrompts.has(q.prompt))
  if (toInsert.length === 0) return { success: 0, skipped: questions.length }

  const statements: StatementSpec[] = toInsert.map((q) => ({
    sql: `INSERT INTO recitation_questions (id, text_id, prompt, answer, answer_lines, source, is_builtin, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    params: [newId(), textId, q.prompt, q.answer, JSON.stringify(q.answerLines), q.source, fromBool(q.isBuiltin), nowIso()],
  }))
  await transaction(statements)
  return { success: toInsert.length, skipped: questions.length - toInsert.length }
}

// --- Multi Meanings ---
export async function getMultiMeanings(character: string): Promise<MultiMeaning[]> {
  const rows = await query('SELECT * FROM multi_meanings WHERE character = ?', [character])
  return rows.map(rowToMultiMeaning)
}

// --- ShiciCards ---
export async function getShiciCards(character: string): Promise<ShiciCard[]> {
  const rows = await query('SELECT * FROM shici_cards WHERE character = ? ORDER BY created_at ASC', [character])
  return rows.map(rowToShiciCard)
}

export async function getAllShiciCharacters(): Promise<string[]> {
  const rows = await query('SELECT character, created_at FROM shici_cards ORDER BY created_at ASC')
  const seen = new Set<string>()
  const chars: string[] = []
  for (const row of rows) {
    const character = row.character as string
    if (!seen.has(character)) {
      seen.add(character)
      chars.push(character)
    }
  }
  return chars
}

export async function importShiciCards(cards: Omit<ShiciCard, 'id' | 'createdAt'>[]): Promise<{ success: number; skipped: number }> {
  const existing = await query('SELECT character, example FROM shici_cards')
  const existingKeys = new Set(existing.map((r) => `${r.character}||${r.example}`))

  const toInsert = cards.filter(c => !existingKeys.has(`${c.character}||${c.example}`))
  if (toInsert.length === 0) return { success: 0, skipped: cards.length }

  const statements: StatementSpec[] = toInsert.map((c) => ({
    sql: `INSERT INTO shici_cards (id, character, seq, pinyin, etymology, pos, meaning, example, source, sentence_meaning, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    params: [newId(), c.character, 0, c.pinyin, c.etymology, c.pos, c.meaning, c.example, c.source, c.sentenceMeaning, nowIso()],
  }))
  await transaction(statements)
  return { success: toInsert.length, skipped: cards.length - toInsert.length }
}

// --- Mistakes ---
export async function getMistakes(filters?: {
  questionType?: Mistake['questionType']
  isMastered?: boolean
}): Promise<Mistake[]> {
  const conditions: string[] = []
  const params: SQLiteValue[] = []
  if (filters?.questionType) { conditions.push('m.question_type = ?'); params.push(filters.questionType) }
  if (filters?.isMastered !== undefined) { conditions.push('m.is_mastered = ?'); params.push(fromBool(filters.isMastered)) }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
  const rows = await query(`
    SELECT m.*,
      a.word AS ann_word,
      a.context AS ann_context,
      t.title AS ann_text_title,
      sc.character AS shici_character,
      sc.example AS shici_example,
      sc.source AS shici_source
    FROM mistakes m
    LEFT JOIN annotations a ON m.question_type = 'annotation' AND m.reference_id = a.id
    LEFT JOIN texts t ON a.text_id = t.id
    LEFT JOIN shici_cards sc ON m.question_type = 'shici' AND m.reference_id = sc.id
    ${where}
    ORDER BY m.created_at DESC
  `, params)
  return rows.map(rowToMistake)
}

export async function addMistake(data: {
  questionType: Mistake['questionType']
  referenceId: string
  userAnswer: string
  correctAnswer: string
}): Promise<Mistake> {
  const existingRows = await query(
    'SELECT * FROM mistakes WHERE reference_id = ? AND question_type = ? AND is_mastered = 0 LIMIT 1',
    [data.referenceId, data.questionType]
  )
  const existing = existingRows[0]

  if (existing) {
    const newCount = (existing.review_count as number) + 1
    const nextReview = getNextReviewDate(newCount)
    await exec(
      'UPDATE mistakes SET review_count = ?, user_answer = ?, next_review_at = ? WHERE id = ?',
      [newCount, data.userAnswer, nextReview.toISOString(), existing.id]
    )
    return rowToMistake({ ...existing, review_count: newCount, user_answer: data.userAnswer, next_review_at: nextReview.toISOString() })
  } else {
    const id = newId()
    const createdAt = nowIso()
    const nextReview = getNextReviewDate(1)
    await exec(
      `INSERT INTO mistakes (id, question_type, reference_id, user_answer, correct_answer, review_count, next_review_at, is_mastered, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, data.questionType, data.referenceId, data.userAnswer, data.correctAnswer, 1, nextReview.toISOString(), 0, createdAt]
    )
    return {
      id, questionType: data.questionType, referenceId: data.referenceId, userAnswer: data.userAnswer,
      correctAnswer: data.correctAnswer, reviewCount: 1, nextReviewAt: nextReview, isMastered: false,
      createdAt: new Date(createdAt),
    }
  }
}

export async function markMistakeMastered(id: string): Promise<void> {
  await exec('UPDATE mistakes SET is_mastered = 1 WHERE id = ?', [id])
}

// New: previously app/api/mistakes/route.ts PATCH handler — used by the
// annotation drill's "已掌握" action, which only knows the question's
// referenceId/questionType (not the mistake row's id, which may not exist yet).
export async function markMistakeMasteredByReference(referenceId: string, questionType: Mistake['questionType']): Promise<void> {
  await exec(
    'UPDATE mistakes SET is_mastered = 1 WHERE reference_id = ? AND question_type = ? AND is_mastered = 0',
    [referenceId, questionType]
  )
}

// New: previously app/api/mistakes/[id]/{wrong,correct}/route.ts — the review
// flow's per-question SRS feedback handlers.
export async function markMistakeWrong(id: string, userAnswer: string): Promise<void> {
  const rows = await query('SELECT review_count FROM mistakes WHERE id = ?', [id])
  if (!rows.length) throw new Error('Mistake not found')
  const newCount = (rows[0].review_count as number) + 1
  const nextReview = getNextReviewDate(newCount)
  await exec(
    'UPDATE mistakes SET review_count = ?, next_review_at = ?, user_answer = ? WHERE id = ?',
    [newCount, nextReview.toISOString(), userAnswer || '', id]
  )
}

export async function markMistakeCorrect(id: string): Promise<void> {
  await exec('UPDATE mistakes SET is_mastered = 1 WHERE id = ?', [id])
}

export async function deleteMistake(id: string): Promise<void> {
  await exec('DELETE FROM mistakes WHERE id = ?', [id])
}

export async function clearMistakes(questionType?: Mistake['questionType']): Promise<void> {
  if (questionType) {
    await exec('DELETE FROM mistakes WHERE is_mastered = 0 AND question_type = ?', [questionType])
  } else {
    await exec('DELETE FROM mistakes WHERE is_mastered = 0')
  }
}

export async function getTodayReviewCount(): Promise<number> {
  const now = nowIso()
  const rows = await query('SELECT COUNT(*) AS count FROM mistakes WHERE next_review_at <= ? AND is_mastered = 0', [now])
  return (rows[0]?.count as number) || 0
}

export async function getTodayReviewQueue(): Promise<Mistake[]> {
  const now = nowIso()
  const rows = await query(
    'SELECT * FROM mistakes WHERE next_review_at <= ? AND is_mastered = 0 ORDER BY next_review_at ASC',
    [now]
  )
  return rows.map(rowToMistake)
}

export async function getTextsWithCounts(): Promise<TextWithCounts[]> {
  const rows = await query(`${TEXT_WITH_COUNTS_SELECT} ORDER BY t.text_order ASC`)
  return rows.map(rowToTextWithCounts)
}

// --- Backup / restore (data export & restore, see Phase 3 plan notes) ---
//
// navigator.storage.persist() (requested on every worker init, see
// lib/sqlite/worker.ts) only reduces the chance of OPFS data being evicted —
// it's not a guarantee, especially on iOS Safari under storage pressure. This
// is the user's actual safety net: a full snapshot they can download and
// later restore from, independent of OPFS surviving.

const BACKUP_VERSION = 1

export interface DataBackup {
  version: number
  exportedAt: string
  tables: {
    texts: Row[]
    annotations: Row[]
    sentences: Row[]
    recitationQuestions: Row[]
    multiMeanings: Row[]
    mistakes: Row[]
    shiciWords: Row[]
    shiciSenses: Row[]
    shiciCards: Row[]
    meta: Row[]
  }
}

// Order matters for restore: parents must be (re)inserted before children so
// FOREIGN KEY constraints are satisfied (texts -> annotations/sentences/
// recitation_questions/multi_meanings, shici_words -> shici_senses).
const BACKUP_TABLES: Array<{ key: keyof DataBackup['tables']; table: string }> = [
  { key: 'meta', table: 'meta' },
  { key: 'texts', table: 'texts' },
  { key: 'annotations', table: 'annotations' },
  { key: 'sentences', table: 'sentences' },
  { key: 'recitationQuestions', table: 'recitation_questions' },
  { key: 'multiMeanings', table: 'multi_meanings' },
  { key: 'mistakes', table: 'mistakes' },
  { key: 'shiciWords', table: 'shici_words' },
  { key: 'shiciSenses', table: 'shici_senses' },
  { key: 'shiciCards', table: 'shici_cards' },
]

export async function exportAllData(): Promise<DataBackup> {
  const results = await Promise.all(BACKUP_TABLES.map(({ table }) => query(`SELECT * FROM ${table}`)))
  const tables = {} as DataBackup['tables']
  BACKUP_TABLES.forEach(({ key }, i) => { tables[key] = results[i] })
  return { version: BACKUP_VERSION, exportedAt: nowIso(), tables }
}

function buildInsertStatements(table: string, rows: Row[]): StatementSpec[] {
  return rows.map((row) => {
    const columns = Object.keys(row)
    const placeholders = columns.map(() => '?').join(', ')
    return {
      sql: `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`,
      params: columns.map((c) => row[c]),
    }
  })
}

// Overwrite-restore: wipes every table this app owns and replaces it with the
// snapshot's contents, in one transaction (all-or-nothing — a partial restore
// would be worse than no restore). Callers MUST confirm with the user first;
// this is irreversible without another backup.
export async function importAllData(backup: DataBackup): Promise<void> {
  if (!backup || typeof backup !== 'object' || !backup.tables) {
    throw new Error('备份文件格式不正确')
  }

  const statements: StatementSpec[] = []
  // Delete children before parents (reverse of BACKUP_TABLES insert order).
  for (const { table } of [...BACKUP_TABLES].reverse()) {
    statements.push({ sql: `DELETE FROM ${table}` })
  }
  for (const { key, table } of BACKUP_TABLES) {
    statements.push(...buildInsertStatements(table, backup.tables[key] || []))
  }

  await transaction(statements)
}
