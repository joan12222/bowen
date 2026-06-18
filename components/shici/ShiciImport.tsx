'use client'
import { useState } from 'react'
import { transaction } from '@/lib/sqlite/client'
import type { StatementSpec } from '@/lib/sqlite/worker'

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

    try {
      const statements: StatementSpec[] = []
      for (const w of words) {
        statements.push({
          sql: `INSERT INTO shici_words (id, word, pinyin, char_type, origin, base_meaning)
                VALUES (?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                  word = excluded.word, pinyin = excluded.pinyin, char_type = excluded.char_type,
                  origin = excluded.origin, base_meaning = excluded.base_meaning`,
          params: [w.id, w.word, w.pinyin, w.char_type ?? null, w.origin ?? null, w.base_meaning],
        })
        statements.push({ sql: 'DELETE FROM shici_senses WHERE word_id = ?', params: [w.id] })
        for (const s of w.senses as any[]) {
          statements.push({
            sql: `INSERT INTO shici_senses (id, word_id, pos, meaning, sense_order, examples)
                  VALUES (?, ?, ?, ?, ?, ?)`,
            params: [crypto.randomUUID(), w.id, s.pos, s.meaning, s.sense_order, JSON.stringify(s.examples)],
          })
        }
      }
      await transaction(statements)
    } catch (err) {
      setStatus(`错误：${err instanceof Error ? err.message : '导入失败'}`)
      setLoading(false)
      return
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
