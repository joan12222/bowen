'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function ShiciImport() {
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(false)

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setLoading(true)
    setStatus('读取文件...')

    const text = await file.text()
    let words
    try {
      words = JSON.parse(text)
    } catch {
      setStatus('JSON 格式有误，请检查后重试')
      setLoading(false)
      return
    }

    if (!Array.isArray(words) || words.length === 0) {
      setStatus('JSON 内容为空或格式不正确')
      setLoading(false)
      return
    }

    setStatus(`导入中（共 ${words.length} 个实词）...`)

    for (const w of words) {
      const { error: wordError } = await supabase
        .from('shici_words')
        .upsert({
          id: w.id,
          word: w.word,
          pinyin: w.pinyin,
          char_type: w.char_type,
          origin: w.origin,
          base_meaning: w.base_meaning,
        })
      if (wordError) {
        setStatus(`错误：${wordError.message}`)
        setLoading(false)
        return
      }

      await supabase.from('shici_senses').delete().eq('word_id', w.id)
      const senses = w.senses.map((s: any) => ({
        word_id: w.id,
        pos: s.pos,
        meaning: s.meaning,
        sense_order: s.sense_order,
        examples: s.examples,
      }))
      const { error: senseError } = await supabase.from('shici_senses').insert(senses)
      if (senseError) {
        setStatus(`错误：${senseError.message}`)
        setLoading(false)
        return
      }
    }

    setStatus(`✓ 导入完成：${words.length} 个实词`)
    setLoading(false)
    // reset input
    e.target.value = ''
  }

  return (
    <div className="p-6 bg-white rounded-2xl border border-gray-200">
      <h2 className="text-base font-semibold mb-1">导入实词 JSON</h2>
      <p className="text-xs text-gray-500 mb-4 leading-relaxed">
        在 Claude.ai 上传实词 PDF，将返回的 JSON 保存为 .json 文件后上传。
        已导入的实词会自动覆盖（upsert），不会重复。
      </p>
      <input
        type="file"
        accept=".json"
        onChange={handleUpload}
        disabled={loading}
        className="block text-sm text-gray-600 mb-3 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-red-700 file:text-white file:text-xs file:cursor-pointer disabled:opacity-50"
      />
      {status && (
        <p className={`text-sm ${status.startsWith('✓') ? 'text-green-700' : status.startsWith('错误') ? 'text-red-600' : 'text-gray-600'}`}>
          {status}
        </p>
      )}
    </div>
  )
}
