"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Sentence, Text } from "@/lib/types"

const DIFF_LABELS = { 1: "直译", 2: "含活用/句式", 3: "长难句" }
const DIFF_COLORS = {
  1: "bg-green-100 text-green-700",
  2: "bg-amber-100 text-amber-700",
  3: "bg-red-100 text-red-700",
}

export default function TranslationDrillPage() {
  const [texts, setTexts] = useState<Text[]>([])
  const [selectedTextId, setSelectedTextId] = useState<string>("")
  const [difficulty, setDifficulty] = useState<number>(0)
  const [reciteMode, setReciteMode] = useState(false)
  const [started, setStarted] = useState(false)

  const [queue, setQueue] = useState<Sentence[]>([])
  const [current, setCurrent] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [finished, setFinished] = useState(false)
  const [reviewCount, setReviewCount] = useState(0)

  useEffect(() => {
    try {
      const cached = localStorage.getItem("texts_list")
      if (cached) setTexts(JSON.parse(cached))
    } catch {}
    fetch("/api/texts")
      .then((r) => r.json())
      .then((data) => {
        setTexts(data)
        localStorage.setItem("texts_list", JSON.stringify(data))
      })
      .catch(() => {})
  }, [])

  async function startDrill() {
    const params = new URLSearchParams()
    if (selectedTextId) params.set("textId", selectedTextId)
    if (difficulty > 0) params.set("difficulty", String(difficulty))
    const res = await fetch(`/api/sentences?${params}`)
    const items: Sentence[] = await res.json()
    setQueue(items.sort(() => Math.random() - 0.5))
    setCurrent(0)
    setRevealed(false)
    setReviewCount(0)
    setFinished(false)
    setStarted(true)
  }

  function handleSelfAssess(needsReview: boolean) {
    if (needsReview) {
      setReviewCount((c) => c + 1)
      const s = queue[current]
      fetch("/api/mistakes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionType: "translation",
          referenceId: s.id,
          userAnswer: "（自评：需复习）",
          correctAnswer: s.translation,
        }),
      }).catch(() => {})
    }
    if (current + 1 >= queue.length) {
      setFinished(true)
    } else {
      setCurrent((c) => c + 1)
      setRevealed(reciteMode)
    }
  }

  if (!started) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/" className="text-gray-500">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <h1 className="text-xl font-bold text-gray-900">句子翻译</h1>
        </div>

        <div className="mb-4">
          <div className="text-sm font-medium text-gray-700 mb-2">选择篇目</div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <label className="flex items-center gap-3 px-4 py-3">
              <input type="radio" name="text" checked={selectedTextId === ""} onChange={() => setSelectedTextId("")} className="accent-red-700" />
              <span className="text-sm text-gray-800">全部篇目</span>
            </label>
            {texts.map((t, idx) => (
              <label key={t.id} className={`flex items-center gap-3 px-4 py-3 border-t border-gray-50`}>
                <input
                  type="radio"
                  name="text"
                  checked={selectedTextId === t.id}
                  onChange={() => setSelectedTextId(t.id)}
                  className="accent-red-700"
                />
                <span className="text-sm text-gray-800">{t.title}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="mb-4">
          <div className="text-sm font-medium text-gray-700 mb-2">难度筛选</div>
          <div className="flex gap-2">
            {[
              { val: 0, label: "全部" },
              { val: 1, label: "直译" },
              { val: 2, label: "含活用" },
              { val: 3, label: "长难句" },
            ].map(({ val, label }) => (
              <button
                key={val}
                onClick={() => setDifficulty(val)}
                className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                  difficulty === val ? "bg-red-700 text-white border-red-700" : "bg-white text-gray-700 border-gray-200"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-6">
          <label className="flex items-center gap-3 bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3">
            <input
              type="checkbox"
              checked={reciteMode}
              onChange={(e) => setReciteMode(e.target.checked)}
              className="w-4 h-4 accent-red-700"
            />
            <div>
              <div className="text-sm font-medium text-gray-800">背诵模式</div>
              <div className="text-xs text-gray-500">自动显示译文，连续翻阅</div>
            </div>
          </label>
        </div>

        <button
          onClick={startDrill}
          className="w-full bg-red-700 text-white py-3 rounded-2xl font-semibold active:opacity-80"
        >
          开始练习
        </button>
      </div>
    )
  }

  if (finished || queue.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-6 flex flex-col items-center justify-center min-h-[60vh]">
        <div className="text-5xl mb-4">{queue.length === 0 ? "📭" : "🎉"}</div>
        {queue.length === 0 ? (
          <>
            <div className="text-xl font-bold text-gray-900 mb-2">暂无题目</div>
            <div className="text-gray-500 mb-6 text-center">请先导入翻译数据</div>
          </>
        ) : (
          <>
            <div className="text-xl font-bold text-gray-900 mb-2">翻译完成！</div>
            <div className="text-gray-500 mb-1">共 {queue.length} 句</div>
            <div className="text-gray-500 mb-6">标记需复习 {reviewCount} 句</div>
          </>
        )}
        <div className="flex gap-3">
          <button onClick={() => setStarted(false)} className="px-6 py-2.5 border border-gray-200 rounded-xl text-gray-700">重新设置</button>
          {queue.length > 0 && (
            <button onClick={startDrill} className="px-6 py-2.5 bg-red-700 text-white rounded-xl font-semibold">再练一遍</button>
          )}
        </div>
      </div>
    )
  }

  const sentence = queue[current]

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => setStarted(false)} className="text-gray-500">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full bg-indigo-600 rounded-full transition-all" style={{ width: `${(current / queue.length) * 100}%` }} />
        </div>
        <span className="text-sm text-gray-500">{current + 1}/{queue.length}</span>
      </div>

      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 mb-4">
        <div className="flex items-center gap-2 mb-4">
          <span className={`text-xs px-2 py-1 rounded-full ${DIFF_COLORS[sentence.difficulty]}`}>
            {DIFF_LABELS[sentence.difficulty]}
          </span>
        </div>

        <div className="text-xl text-gray-900 leading-8 mb-6 font-medium">{sentence.original}</div>

        {!revealed ? (
          <button
            onClick={() => setRevealed(true)}
            className="w-full py-3 border-2 border-dashed border-gray-200 rounded-2xl text-gray-400 text-sm active:bg-gray-50"
          >
            点击查看译文
          </button>
        ) : (
          <>
            <div className="bg-gray-50 rounded-2xl p-4 mb-4">
              <div className="text-sm text-gray-600 leading-7">{sentence.translation}</div>
              {sentence.keyPoints.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-3">
                  {sentence.keyPoints.map((kp, i) => (
                    <span key={i} className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">{kp}</span>
                  ))}
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleSelfAssess(false)}
                className="flex-1 py-3 bg-green-600 text-white rounded-2xl font-medium active:opacity-80"
              >
                ✓ 掌握
              </button>
              <button
                onClick={() => handleSelfAssess(true)}
                className="flex-1 py-3 bg-gray-200 text-gray-700 rounded-2xl font-medium active:opacity-80"
              >
                需复习
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
