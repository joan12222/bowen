import { supabase } from './supabase'
import {
  Text, Annotation, Sentence, RecitationQuestion,
  MultiMeaning, Mistake, ShiciCard, VolumeId, TextType, AnnotationCategory, TextWithCounts
} from './types'
import { getNextReviewDate } from './constants'

// --- Transform helpers ---
function rowToText(row: Record<string, unknown>): Text {
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
    isBuiltin: row.is_builtin as boolean,
    createdAt: new Date(row.created_at as string),
  }
}

function rowToAnnotation(row: Record<string, unknown>): Annotation {
  return {
    id: row.id as string,
    textId: row.text_id as string,
    word: row.word as string,
    pinyin: row.pinyin as string,
    context: row.context as string,
    answer: row.answer as string,
    loose: (row.loose as string[]) || [],
    category: row.category as Annotation['category'],
    isHsfWord: row.is_hsf_word as boolean,
    isBuiltin: row.is_builtin as boolean,
    createdAt: new Date(row.created_at as string),
  }
}

function rowToSentence(row: Record<string, unknown>): Sentence {
  return {
    id: row.id as string,
    textId: row.text_id as string,
    original: row.original as string,
    translation: row.translation as string,
    keyPoints: (row.key_points as string[]) || [],
    difficulty: row.difficulty as 1 | 2 | 3,
    isBuiltin: row.is_builtin as boolean,
    createdAt: new Date(row.created_at as string),
  }
}

function rowToRecitationQuestion(row: Record<string, unknown>): RecitationQuestion {
  return {
    id: row.id as string,
    textId: row.text_id as string,
    prompt: row.prompt as string,
    answer: row.answer as string,
    answerLines: (row.answer_lines as string[]) || [],
    source: row.source as string,
    isBuiltin: row.is_builtin as boolean,
    createdAt: new Date(row.created_at as string),
  }
}

function rowToMultiMeaning(row: Record<string, unknown>): MultiMeaning {
  return {
    id: row.id as string,
    character: row.character as string,
    textId: row.text_id as string,
    context: row.context as string,
    meaning: row.meaning as string,
    usage: row.usage as string,
  }
}

function rowToMistake(row: Record<string, unknown>): Mistake {
  return {
    id: row.id as string,
    questionType: row.question_type as Mistake['questionType'],
    referenceId: row.reference_id as string,
    userAnswer: row.user_answer as string,
    correctAnswer: row.correct_answer as string,
    reviewCount: row.review_count as number,
    nextReviewAt: new Date(row.next_review_at as string),
    isMastered: row.is_mastered as boolean,
    createdAt: new Date(row.created_at as string),
  }
}

// --- Texts ---
export async function getTexts(volumeId?: VolumeId): Promise<Text[]> {
  let query = supabase.from('texts').select('*').order('text_order', { ascending: true })
  if (volumeId) {
    query = query.eq('volume_id', volumeId)
  }
  const { data, error } = await query
  if (error) throw error
  return (data || []).map(rowToText)
}

export async function getText(id: string): Promise<TextWithCounts | null> {
  const { data: text, error } = await supabase.from('texts').select('*').eq('id', id).single()
  if (error) return null

  const [annCount, sentCount, recCount] = await Promise.all([
    supabase.from('annotations').select('id', { count: 'exact', head: true }).eq('text_id', id),
    supabase.from('sentences').select('id', { count: 'exact', head: true }).eq('text_id', id),
    supabase.from('recitation_questions').select('id', { count: 'exact', head: true }).eq('text_id', id),
  ])

  return {
    ...rowToText(text),
    annotationCount: annCount.count || 0,
    sentenceCount: sentCount.count || 0,
    recitationCount: recCount.count || 0,
  }
}

export async function createText(data: Omit<Text, 'id' | 'createdAt'>): Promise<Text> {
  const { data: row, error } = await supabase.from('texts').insert({
    title: data.title,
    author: data.author,
    dynasty: data.dynasty,
    source: data.source,
    volume_id: data.volumeId,
    text_type: data.textType,
    text_order: data.textOrder,
    content: data.content,
    translation: data.translation || '',
    appreciation: data.appreciation || '',
    is_builtin: data.isBuiltin,
  }).select().single()
  if (error) throw error
  return rowToText(row)
}

export async function deleteText(id: string): Promise<void> {
  const { error } = await supabase.from('texts').delete().eq('id', id).eq('is_builtin', false)
  if (error) throw error
}

export async function updateTextTranslation(
  id: string,
  data: { translation?: string; appreciation?: string }
): Promise<void> {
  const update: Record<string, unknown> = {}
  if (data.translation !== undefined) update.translation = data.translation
  if (data.appreciation !== undefined) update.appreciation = data.appreciation

  const { error } = await supabase.from('texts').update(update).eq('id', id)
  if (error) throw error
}

// --- Annotations ---
export async function getAnnotations(textId: string, category?: AnnotationCategory): Promise<Annotation[]> {
  let query = supabase.from('annotations').select('*').eq('text_id', textId).order('created_at', { ascending: true })
  if (category) {
    query = query.eq('category', category)
  }
  const { data, error } = await query
  if (error) throw error
  return (data || []).map(rowToAnnotation)
}

export async function getAllAnnotations(filters?: { textIds?: string[], category?: AnnotationCategory, hsfOnly?: boolean }): Promise<Annotation[]> {
  let query = supabase.from('annotations').select('*').order('created_at', { ascending: true })
  if (filters?.textIds && filters.textIds.length > 0) {
    query = query.in('text_id', filters.textIds)
  }
  if (filters?.category) {
    query = query.eq('category', filters.category)
  }
  if (filters?.hsfOnly) {
    query = query.eq('is_hsf_word', true)
  }
  const { data, error } = await query
  if (error) throw error
  return (data || []).map(rowToAnnotation)
}

export async function createAnnotation(data: Omit<Annotation, 'id' | 'createdAt'>): Promise<Annotation> {
  const { data: row, error } = await supabase.from('annotations').insert({
    text_id: data.textId,
    word: data.word,
    pinyin: data.pinyin,
    context: data.context,
    answer: data.answer,
    loose: data.loose,
    category: data.category,
    is_hsf_word: data.isHsfWord,
    is_builtin: data.isBuiltin,
  }).select().single()
  if (error) throw error
  return rowToAnnotation(row)
}

export async function importAnnotations(textId: string, annotations: Omit<Annotation, 'id' | 'createdAt' | 'textId'>[]): Promise<{ success: number, skipped: number }> {
  const { data: existing } = await supabase.from('annotations').select('word').eq('text_id', textId)
  const existingWords = new Set((existing || []).map((r: { word: string }) => r.word))

  const toInsert = annotations.filter(a => !existingWords.has(a.word))
  if (toInsert.length === 0) return { success: 0, skipped: annotations.length }

  const { error } = await supabase.from('annotations').insert(
    toInsert.map(a => ({
      text_id: textId,
      word: a.word,
      pinyin: a.pinyin,
      context: a.context,
      answer: a.answer,
      loose: a.loose,
      category: a.category,
      is_hsf_word: a.isHsfWord,
      is_builtin: a.isBuiltin,
    }))
  )
  if (error) throw error
  return { success: toInsert.length, skipped: annotations.length - toInsert.length }
}

// --- Sentences ---
export async function getSentences(textId?: string, difficulty?: number): Promise<Sentence[]> {
  let query = supabase.from('sentences').select('*').order('created_at', { ascending: true })
  if (textId) query = query.eq('text_id', textId)
  if (difficulty) query = query.eq('difficulty', difficulty)
  const { data, error } = await query
  if (error) throw error
  return (data || []).map(rowToSentence)
}

export async function importSentences(textId: string, sentences: Omit<Sentence, 'id' | 'createdAt' | 'textId'>[]): Promise<{ success: number, skipped: number }> {
  const { data: existing } = await supabase.from('sentences').select('original').eq('text_id', textId)
  const existingOriginals = new Set((existing || []).map((r: { original: string }) => r.original))

  const toInsert = sentences.filter(s => !existingOriginals.has(s.original))
  if (toInsert.length === 0) return { success: 0, skipped: sentences.length }

  const { error } = await supabase.from('sentences').insert(
    toInsert.map(s => ({
      text_id: textId,
      original: s.original,
      translation: s.translation,
      key_points: s.keyPoints,
      difficulty: s.difficulty,
      is_builtin: s.isBuiltin,
    }))
  )
  if (error) throw error
  return { success: toInsert.length, skipped: sentences.length - toInsert.length }
}

// --- Recitation Questions ---
export async function getRecitationQuestions(textId?: string): Promise<RecitationQuestion[]> {
  let query = supabase.from('recitation_questions').select('*').order('created_at', { ascending: true })
  if (textId) query = query.eq('text_id', textId)
  const { data, error } = await query
  if (error) throw error
  return (data || []).map(rowToRecitationQuestion)
}

export async function importRecitationQuestions(textId: string, questions: Omit<RecitationQuestion, 'id' | 'createdAt' | 'textId'>[]): Promise<{ success: number, skipped: number }> {
  const { data: existing } = await supabase.from('recitation_questions').select('prompt').eq('text_id', textId)
  const existingPrompts = new Set((existing || []).map((r: { prompt: string }) => r.prompt))

  const toInsert = questions.filter(q => !existingPrompts.has(q.prompt))
  if (toInsert.length === 0) return { success: 0, skipped: questions.length }

  const { error } = await supabase.from('recitation_questions').insert(
    toInsert.map(q => ({
      text_id: textId,
      prompt: q.prompt,
      answer: q.answer,
      answer_lines: q.answerLines,
      source: q.source,
      is_builtin: q.isBuiltin,
    }))
  )
  if (error) throw error
  return { success: toInsert.length, skipped: questions.length - toInsert.length }
}

// --- Multi Meanings ---
export async function getMultiMeanings(character: string): Promise<MultiMeaning[]> {
  const { data, error } = await supabase.from('multi_meanings').select('*').eq('character', character)
  if (error) throw error
  return (data || []).map(rowToMultiMeaning)
}

// --- ShiciCards ---
function rowToShiciCard(row: Record<string, unknown>): ShiciCard {
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

export async function getShiciCards(character: string): Promise<ShiciCard[]> {
  const { data, error } = await supabase
    .from('shici_cards')
    .select('*')
    .eq('character', character)
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data || []).map(rowToShiciCard)
}

export async function getAllShiciCharacters(): Promise<string[]> {
  const { data, error } = await supabase
    .from('shici_cards')
    .select('character, created_at')
    .order('created_at', { ascending: true })
  if (error) throw error
  const seen = new Set<string>()
  const chars: string[] = []
  for (const row of (data || []) as { character: string }[]) {
    if (!seen.has(row.character)) {
      seen.add(row.character)
      chars.push(row.character)
    }
  }
  return chars
}

export async function importShiciCards(
  cards: Omit<ShiciCard, 'id' | 'createdAt'>[]
): Promise<{ success: number; skipped: number }> {
  const { data: existing } = await supabase
    .from('shici_cards')
    .select('character, example')
  const existingKeys = new Set(
    (existing || []).map((r: { character: string; example: string }) => `${r.character}||${r.example}`)
  )
  const toInsert = cards.filter(c => !existingKeys.has(`${c.character}||${c.example}`))
  if (toInsert.length === 0) return { success: 0, skipped: cards.length }
  const { error } = await supabase.from('shici_cards').insert(
    toInsert.map(c => ({
      character: c.character,
      pinyin: c.pinyin,
      etymology: c.etymology,
      pos: c.pos,
      meaning: c.meaning,
      example: c.example,
      source: c.source,
      sentence_meaning: c.sentenceMeaning,
    }))
  )
  if (error) throw error
  return { success: toInsert.length, skipped: cards.length - toInsert.length }
}

// --- Mistakes ---
export async function getMistakes(filters?: {
  questionType?: Mistake['questionType']
  isMastered?: boolean
}): Promise<Mistake[]> {
  let query = supabase.from('mistakes').select('*').order('created_at', { ascending: false })
  if (filters?.questionType) query = query.eq('question_type', filters.questionType)
  if (filters?.isMastered !== undefined) query = query.eq('is_mastered', filters.isMastered)
  const { data, error } = await query
  if (error) throw error
  return (data || []).map(rowToMistake)
}

export async function addMistake(data: {
  questionType: Mistake['questionType']
  referenceId: string
  userAnswer: string
  correctAnswer: string
}): Promise<Mistake> {
  // Check if exists
  const { data: existing } = await supabase
    .from('mistakes')
    .select('*')
    .eq('reference_id', data.referenceId)
    .eq('question_type', data.questionType)
    .eq('is_mastered', false)
    .single()

  if (existing) {
    const newCount = (existing.review_count as number) + 1
    const nextReview = getNextReviewDate(newCount)
    const { data: updated, error } = await supabase
      .from('mistakes')
      .update({
        review_count: newCount,
        user_answer: data.userAnswer,
        next_review_at: nextReview.toISOString(),
      })
      .eq('id', existing.id)
      .select()
      .single()
    if (error) throw error
    return rowToMistake(updated)
  } else {
    const nextReview = getNextReviewDate(1)
    const { data: row, error } = await supabase.from('mistakes').insert({
      question_type: data.questionType,
      reference_id: data.referenceId,
      user_answer: data.userAnswer,
      correct_answer: data.correctAnswer,
      review_count: 1,
      next_review_at: nextReview.toISOString(),
      is_mastered: false,
    }).select().single()
    if (error) throw error
    return rowToMistake(row)
  }
}

export async function markMistakeMastered(id: string): Promise<void> {
  const { error } = await supabase.from('mistakes').update({ is_mastered: true }).eq('id', id)
  if (error) throw error
}

export async function getTodayReviewCount(): Promise<number> {
  const now = new Date().toISOString()
  const { count, error } = await supabase
    .from('mistakes')
    .select('id', { count: 'exact', head: true })
    .lte('next_review_at', now)
    .eq('is_mastered', false)
  if (error) return 0
  return count || 0
}

export async function getTodayReviewQueue(): Promise<Mistake[]> {
  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from('mistakes')
    .select('*')
    .lte('next_review_at', now)
    .eq('is_mastered', false)
    .order('next_review_at', { ascending: true })
  if (error) throw error
  return (data || []).map(rowToMistake)
}

export async function getTextsWithCounts(): Promise<TextWithCounts[]> {
  const { data: texts, error } = await supabase.from('texts').select('*').order('text_order', { ascending: true })
  if (error) throw error
  if (!texts || texts.length === 0) return []

  const textIds = texts.map((t) => t.id)

  const [annRows, sentRows, recRows] = await Promise.all([
    supabase.from('annotations').select('text_id').in('text_id', textIds),
    supabase.from('sentences').select('text_id').in('text_id', textIds),
    supabase.from('recitation_questions').select('text_id').in('text_id', textIds),
  ])

  const countMap = (rows: { text_id: string }[] | null) => {
    const m: Record<string, number> = {}
    for (const r of rows || []) m[r.text_id] = (m[r.text_id] || 0) + 1
    return m
  }
  const annMap = countMap(annRows.data)
  const sentMap = countMap(sentRows.data)
  const recMap = countMap(recRows.data)

  return texts.map((t) => ({
    ...rowToText(t),
    annotationCount: annMap[t.id] || 0,
    sentenceCount: sentMap[t.id] || 0,
    recitationCount: recMap[t.id] || 0,
  }))
}
