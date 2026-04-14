import { supabase } from '@/lib/supabase'

export async function getShiciList() {
  const { data } = await supabase
    .from('shici_words')
    .select('id, word, pinyin, base_meaning')
    .order('id')
  return data ?? []
}

export async function getShiciDetail(id: number) {
  const { data: word } = await supabase
    .from('shici_words')
    .select('*')
    .eq('id', id)
    .single()

  const { data: senses } = await supabase
    .from('shici_senses')
    .select('*')
    .eq('word_id', id)
    .order('sense_order')

  return { word: word ?? null, senses: senses ?? [] }
}

export async function getRandomShiciWord() {
  const { count } = await supabase
    .from('shici_words')
    .select('*', { count: 'exact', head: true })

  if (!count) return null

  const randomOffset = Math.floor(Math.random() * count)
  const { data: wordRow } = await supabase
    .from('shici_words')
    .select('id')
    .range(randomOffset, randomOffset)
    .single()

  if (!wordRow) return null
  return getShiciDetail(wordRow.id)
}
