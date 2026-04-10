"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Mistake } from "@/lib/types"

export default function TodayReviewPage() {
  const [queue, setQueue] = useState<Mistake[]>([])
  const [current, setCurrent] = useState(0)
  const [userAnswer, setUserAnswer] = useState("")
  const [submitted, setSubmitted] = useState(false)
  const [correct, setCorrect] = useState(false)
  const [finished, setFinished] = useState(false)
  const [correctCount, setCorrectCount] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/review/today")
      .then((r) => r.json())
      .then((data) => {
        setQueue(data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const TYPE_LABELS = {
    annotation: "注释背默",
    translation: "句子翻译",
    recitation: "理解性默写",
    multiMeaning: "一词多义",
  }

  function handleSubmit() {
    const m = queue[current]
    const ua = userAnswer.trim()
    const isCorrect = ua && (
      ua.includes(m.correctAnswer) ||
      m.correctAnswer.includes(ua) ||
      ua === m.correctAnswer
    )
    setCorrect(!!isCorrect)
    setSubmitted(true)

    if (!isCorrect) {
      fetch(`/api/mistakes/${m.id}/wrong`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userAnswer: ua }),
      }).catch(() => {})
    } else {
      fetch(`/api/mistakes/${m.id}/correct`, { method: "POST" }).catch(() => {})
      setCorrectCount((c) => c + 1)
    }
  }

  function handleNext() {
    if (current + 1 >= queue.length) {
      setFinished(true)
    } else {
      setCurrent((c) => c + 1)
      setUserAnswer("")
      setSubmitted(false)
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-gray-400">加载中…</div>
  }

  if (finished || queue.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-6 flex flex-col items-center justify-center min-h-[60vh]">
        <div className="text-5xl mb-4">{queue.length === 0 ? "✨" : "🎉"}</div>
        {queue.length === 0 ? (
          <>
            <div className="text-xl font-bold mb-2">今日无需复习</div>
            <div className="text-gray-500 mb-6">继续完成新练习吧！</div>
          </>
        ) : (
          <>
            <div className="text-xl font-bold mb-2">今日复习完成！</div>
            <div className="text-gray-500 mb-2">共 {queue.length} 题，答对 {correctCount} 题</div>
            <div className="text-2xl font-bold text-red-700 mb-6">
              {Math.round((correctCount / queue.length) * 100)}%
            </div>
          </>
        )}
        <Link href="/review">
          <button className="px-6 py-2.5 bg-red-700 text-white rounded-xl font-semibold">返回错题本</button>
        </Link>
      </div>
    )
  }

  const m = queue[current]

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/review" className="text-gray-500">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full bg-red-600 rounded-full transition-all" style={{ width: `${(current / queue.length) * 100}%` }} />
        </div>
        <span className="text-sm text-gray-500">{current + 1}/{queue.length}</span>
      </div>

      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 mb-4">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full">
            {TYPE_LABELS[m.questionType]}
          </span>
          <span className="text-xs text-gray-400">第 {m.reviewCount} 次复习</span>
        </div>

        <div className="text-sm text-gray-500 mb-4">请写出正确答案：</div>

        {m.questionType === "translation" ? (
          /* Translation: show correct answer directly, self-assess */
          <>
            <div className="bg-gray-50 rounded-2xl p-4 mb-4">
              <div className="text-sm text-gray-600">{m.correctAnswer}</div>
            </div>
            {!submitted ? (
              <div className="flex gap-2">
                <button onClick={() => { setCorrect(false); setSubmitted(true); fetch(`/api/mistakes/${m.id}/wrong`, { method: "POST" }).catch(() => {}) }}
                  className="flex-1 py-3 bg-gray-200 text-gray-700 rounded-2xl font-medium">需复习</button>
                <button onClick={() => { setCorrect(true); setSubmitted(true); setCorrectCount((c) => c + 1); fetch(`/api/mistakes/${m.id}/correct`, { method: "POST" }).catch(() => {}) }}
                  className="flex-1 py-3 bg-green-600 text-white rounded-2xl font-medium">✓ 掌握</button>
              </div>
            ) : (
              <button onClick={handleNext} className="w-full bg-gray-900 text-white py-3 rounded-2xl font-semibold">下一题</button>
            )}
          </>
        ) : (
          <>
            {!submitted ? (
              <>
                <input
                  type="text"
                  value={userAnswer}
                  onChange={(e) => setUserAnswer(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && userAnswer.trim()) handleSubmit() }}
                  placeholder="输入答案…"
                  autoFocus
                  className="w-full border-b-2 border-gray-200 focus:border-red-500 py-2 text-base text-gray-900 outline-none bg-transparent transition-colors"
                />
                <button
                  onClick={handleSubmit}
                  disabled={!userAnswer.trim()}
                  className="w-full mt-4 bg-gray-900 text-white py-3 rounded-2xl font-semibold disabled:opacity-30"
                >
                  确认
                </button>
              </>
            ) : (
              <>
                <div className={`rounded-2xl p-4 mb-4 ${correct ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"}`}>
                  <div className={`text-sm font-semibold mb-1 ${correct ? "text-green-700" : "text-red-700"}`}>
                    {correct ? "✓ 正确！继续保持" : "✗ 继续加油"}
                  </div>
                  {!correct && <div className="text-sm text-gray-600 mb-1">你的答案：{userAnswer}</div>}
                  <div className="text-sm font-medium text-gray-900">标准答案：{m.correctAnswer}</div>
                </div>
                <button onClick={handleNext} className="w-full bg-gray-900 text-white py-3 rounded-2xl font-semibold">下一题</button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
