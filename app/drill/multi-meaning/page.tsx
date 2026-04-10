"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { MultiMeaning } from "@/lib/types"
import { KEY_FUNCTION_WORDS, KEY_MULTI_MEANING_WORDS } from "@/lib/constants"

const ALL_CHARS = [...KEY_FUNCTION_WORDS, ...KEY_MULTI_MEANING_WORDS]

export default function MultiMeaningPage() {
  const [selected, setSelected] = useState<string | null>(null)
  const [items, setItems] = useState<MultiMeaning[]>([])
  const [loading, setLoading] = useState(false)
  const [compareMode, setCompareMode] = useState(false)
  const [current, setCurrent] = useState(0)
  const [userAnswer, setUserAnswer] = useState("")
  const [submitted, setSubmitted] = useState(false)
  const [correct, setCorrect] = useState(false)

  async function selectChar(char: string) {
    setSelected(char)
    setLoading(true)
    setItems([])
    setCompareMode(false)
    setCurrent(0)
    setUserAnswer("")
    setSubmitted(false)
    try {
      const res = await fetch(`/api/multi-meanings?character=${encodeURIComponent(char)}`)
      const data = await res.json()
      setItems(data)
    } catch {}
    setLoading(false)
  }

  function handleSubmit() {
    const item = items[current]
    const ua = userAnswer.trim()
    const isCorrect = ua && (ua.includes(item.meaning) || item.meaning.includes(ua))
    setCorrect(!!isCorrect)
    setSubmitted(true)
    if (!isCorrect) {
      fetch("/api/mistakes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionType: "multiMeaning",
          referenceId: item.id,
          userAnswer: ua,
          correctAnswer: item.meaning,
        }),
      }).catch(() => {})
    }
  }

  function handleNext() {
    if (current + 1 < items.length) {
      setCurrent((c) => c + 1)
      setUserAnswer("")
      setSubmitted(false)
    }
  }

  const item = items[current]

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/" className="text-gray-500">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <h1 className="text-xl font-bold text-gray-900">一词多义</h1>
      </div>

      {/* Character selector */}
      <div className="mb-6">
        <div className="text-sm font-medium text-gray-500 mb-2">虚词（18个）</div>
        <div className="flex flex-wrap gap-2 mb-4">
          {KEY_FUNCTION_WORDS.map((c) => (
            <button
              key={c}
              onClick={() => selectChar(c)}
              className={`w-10 h-10 rounded-xl text-base font-medium border transition-colors ${
                selected === c ? "bg-red-700 text-white border-red-700" : "bg-white text-gray-800 border-gray-200"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
        <div className="text-sm font-medium text-gray-500 mb-2">实词高频多义</div>
        <div className="flex flex-wrap gap-2">
          {KEY_MULTI_MEANING_WORDS.map((c) => (
            <button
              key={c}
              onClick={() => selectChar(c)}
              className={`w-10 h-10 rounded-xl text-base font-medium border transition-colors ${
                selected === c ? "bg-red-700 text-white border-red-700" : "bg-white text-gray-800 border-gray-200"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {loading && <div className="text-center py-8 text-gray-400">加载中…</div>}

      {selected && !loading && items.length === 0 && (
        <div className="text-center py-8 text-gray-400">
          <div className="text-3xl mb-2">📭</div>
          <div>暂无「{selected}」的多义数据</div>
        </div>
      )}

      {selected && !loading && items.length > 0 && (
        <>
          <div className="flex items-center justify-between mb-4">
            <div className="text-lg font-bold text-gray-900">「{selected}」— {items.length} 个义项</div>
            <button
              onClick={() => setCompareMode((v) => !v)}
              className={`text-sm px-3 py-1.5 rounded-lg border transition-colors ${
                compareMode ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-gray-700 border-gray-200"
              }`}
            >
              对比模式
            </button>
          </div>

          {compareMode ? (
            /* Compare mode: show all at once */
            <div className="space-y-2">
              {items.map((item) => (
                <div key={item.id} className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3">
                  <div className="text-sm text-gray-500 mb-1">{item.context}</div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-900">{item.meaning}</span>
                    {item.usage && (
                      <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">{item.usage}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* Practice mode */
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-sm text-gray-400">{current + 1}/{items.length}</span>
                {item.usage && (
                  <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">{item.usage}</span>
                )}
              </div>
              <div className="text-lg text-gray-700 leading-8 mb-6">
                {item.context.split(selected).map((part, i, arr) => (
                  <span key={i}>
                    {part}
                    {i < arr.length - 1 && (
                      <span className="bg-amber-200 text-amber-900 px-0.5 rounded font-semibold">{selected}</span>
                    )}
                  </span>
                ))}
              </div>

              {!submitted ? (
                <>
                  <div className="text-sm text-gray-500 mb-2">「{selected}」在此句的含义</div>
                  <input
                    type="text"
                    value={userAnswer}
                    onChange={(e) => setUserAnswer(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && userAnswer.trim()) handleSubmit() }}
                    placeholder="输入义项…"
                    autoFocus
                    className="w-full border-b-2 border-gray-200 focus:border-red-500 py-2 text-base text-gray-900 outline-none bg-transparent transition-colors"
                  />
                  <button
                    onClick={handleSubmit}
                    disabled={!userAnswer.trim()}
                    className="w-full mt-4 bg-gray-900 text-white py-3 rounded-2xl font-semibold active:opacity-80 disabled:opacity-30"
                  >
                    确认
                  </button>
                </>
              ) : (
                <>
                  <div className={`rounded-2xl p-4 mb-4 ${correct ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"}`}>
                    <div className={`text-sm font-semibold mb-1 ${correct ? "text-green-700" : "text-red-700"}`}>
                      {correct ? "✓ 正确" : "✗ 错误"}
                    </div>
                    {!correct && <div className="text-sm text-gray-600 mb-2">你的答案：{userAnswer}</div>}
                    <div className="text-sm font-medium text-gray-900">答案：{item.meaning}</div>
                    {item.usage && <div className="text-xs text-gray-500 mt-1">用法：{item.usage}</div>}
                  </div>
                  {current + 1 < items.length ? (
                    <button onClick={handleNext} className="w-full bg-gray-900 text-white py-3 rounded-2xl font-semibold">下一个</button>
                  ) : (
                    <button onClick={() => { setCurrent(0); setUserAnswer(""); setSubmitted(false) }} className="w-full bg-red-700 text-white py-3 rounded-2xl font-semibold">重新练习</button>
                  )}
                </>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
