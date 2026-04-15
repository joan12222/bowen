"use client"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { Annotation, Text, AnnotationCategory } from "@/lib/types"
import { ANNOTATION_CATEGORY_LABELS } from "@/lib/constants"

type Mode = "sequential" | "random" | "mistakes" | "hsf" | "unmastered"
type Filter = "all" | AnnotationCategory | "hsf"

const MODE_LABELS: Record<Mode, string> = {
  sequential: "顺序",
  random: "随机",
  mistakes: "只练错题",
  hsf: "高频300字",
  unmastered: "未掌握",
}

const FILTER_OPTIONS: { key: Filter; label: string }[] = [
  { key: "all", label: "全部" },
  { key: "shiCi", label: "实词" },
  { key: "xuCi", label: "虚词" },
  { key: "tongJia", label: "通假字" },
  { key: "guJinYiYi", label: "古今异义" },
  { key: "ciLeiHuoYong", label: "词类活用" },
  { key: "teShüJuShi", label: "特殊句式" },
  { key: "hsf", label: "高频300字" },
]

function highlightWord(context: string, word: string): React.ReactNode {
  const idx = context.indexOf(word)
  if (idx === -1) return context
  return (
    <>
      {context.slice(0, idx)}
      <span className="bg-amber-200 text-amber-900 px-0.5 rounded font-semibold">{word}</span>
      {context.slice(idx + word.length)}
    </>
  )
}

function scoreAnswer(userAnswer: string, annotation: Annotation): boolean {
  const ua = userAnswer.trim()
  if (!ua) return false
  if (ua.includes(annotation.answer) || annotation.answer.includes(ua)) {
    if (ua.length >= 2) return true
  }
  return annotation.loose.some((kw) => ua.includes(kw) || kw.includes(ua))
}

export default function AnnotationDrillPage() {
  const [texts, setTexts] = useState<Text[]>(() => {
    try {
      const cached = localStorage.getItem("texts_list")
      return cached ? JSON.parse(cached) : []
    } catch { return [] }
  })
  const [selectedTextIds, setSelectedTextIds] = useState<string[]>([])
  const [filter, setFilter] = useState<Filter>("all")
  const [mode, setMode] = useState<Mode>("sequential")
  const [started, setStarted] = useState(false)

  const [queue, setQueue] = useState<Annotation[]>([])
  const [current, setCurrent] = useState(0)
  const [userAnswer, setUserAnswer] = useState("")
  const [submitted, setSubmitted] = useState(false)
  const [correct, setCorrect] = useState(false)
  const [finished, setFinished] = useState(false)
  const [correctCount, setCorrectCount] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
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
    if (selectedTextIds.length > 0) {
      selectedTextIds.forEach((id) => params.append("textId", id))
    }
    if (filter === "hsf") {
      params.set("hsfOnly", "true")
    } else if (filter !== "all") {
      params.set("category", filter)
    }
    if (mode === "mistakes") params.set("mistakesOnly", "true")

    const res = await fetch(`/api/annotations?${params}`)
    let items: Annotation[] = await res.json()

    if (mode === "random") {
      items = items.sort(() => Math.random() - 0.5)
    }

    setQueue(items)
    setCurrent(0)
    setUserAnswer("")
    setSubmitted(false)
    setCorrectCount(0)
    setFinished(false)
    setStarted(true)
  }

  function handleSubmit() {
    if (!queue[current]) return
    const isCorrect = scoreAnswer(userAnswer, queue[current])
    setCorrect(isCorrect)
    setSubmitted(true)
    if (isCorrect) {
      setCorrectCount((c) => c + 1)
    } else {
      fetch("/api/mistakes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionType: "annotation",
          referenceId: queue[current].id,
          userAnswer,
          correctAnswer: queue[current].answer,
        }),
      }).catch(() => {})
    }
  }

  function handleNext() {
    if (current + 1 >= queue.length) {
      setFinished(true)
    } else {
      setCurrent((c) => c + 1)
      setUserAnswer("")
      setSubmitted(false)
      setTimeout(() => inputRef.current?.focus(), 100)
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
          <h1 className="text-xl font-bold text-gray-900">注释背默</h1>
        </div>

        {/* Text selection */}
        <div className="mb-4">
          <div className="text-sm font-medium text-gray-700 mb-2">选择篇目（不选则全部）</div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {texts.length === 0 ? (
              <div className="px-4 py-3 text-sm text-gray-400">暂无篇目</div>
            ) : (
              texts.map((t, idx) => (
                <label key={t.id} className={`flex items-center gap-3 px-4 py-3 ${idx > 0 ? "border-t border-gray-50" : ""}`}>
                  <input
                    type="checkbox"
                    checked={selectedTextIds.includes(t.id)}
                    onChange={(e) => {
                      if (e.target.checked) setSelectedTextIds((ids) => [...ids, t.id])
                      else setSelectedTextIds((ids) => ids.filter((id) => id !== t.id))
                    }}
                    className="w-4 h-4 accent-red-700"
                  />
                  <span className="text-sm text-gray-800">{t.title}</span>
                  <span className="text-xs text-gray-400 ml-auto">{t.author}</span>
                </label>
              ))
            )}
          </div>
        </div>

        {/* Filter */}
        <div className="mb-4">
          <div className="text-sm font-medium text-gray-700 mb-2">分类筛选</div>
          <div className="flex flex-wrap gap-2">
            {FILTER_OPTIONS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                  filter === f.key
                    ? "bg-red-700 text-white border-red-700"
                    : "bg-white text-gray-700 border-gray-200"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Mode */}
        <div className="mb-6">
          <div className="text-sm font-medium text-gray-700 mb-2">练习模式</div>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(MODE_LABELS) as Mode[]).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                  mode === m
                    ? "bg-red-700 text-white border-red-700"
                    : "bg-white text-gray-700 border-gray-200"
                }`}
              >
                {MODE_LABELS[m]}
              </button>
            ))}
          </div>
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
            <div className="text-gray-500 mb-6 text-center">请先导入注释数据，或调整筛选条件</div>
          </>
        ) : (
          <>
            <div className="text-xl font-bold text-gray-900 mb-2">练习完成！</div>
            <div className="text-gray-500 mb-2">共 {queue.length} 题，答对 {correctCount} 题</div>
            <div className="text-2xl font-bold text-red-700 mb-6">
              {Math.round((correctCount / queue.length) * 100)}%
            </div>
          </>
        )}
        <div className="flex gap-3">
          <button
            onClick={() => setStarted(false)}
            className="px-6 py-2.5 border border-gray-200 rounded-xl text-gray-700"
          >
            重新设置
          </button>
          {queue.length > 0 && (
            <button
              onClick={startDrill}
              className="px-6 py-2.5 bg-red-700 text-white rounded-xl font-semibold"
            >
              再练一遍
            </button>
          )}
        </div>
      </div>
    )
  }

  const ann = queue[current]
  const DIFF_COLORS: Record<AnnotationCategory, string> = {
    shiCi: "bg-blue-100 text-blue-700",
    xuCi: "bg-purple-100 text-purple-700",
    tongJia: "bg-orange-100 text-orange-700",
    guJinYiYi: "bg-teal-100 text-teal-700",
    ciLeiHuoYong: "bg-pink-100 text-pink-700",
    teShüJuShi: "bg-indigo-100 text-indigo-700",
    other: "bg-gray-100 text-gray-600",
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {/* Progress bar */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => setStarted(false)} className="text-gray-500">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-red-600 rounded-full transition-all"
            style={{ width: `${((current) / queue.length) * 100}%` }}
          />
        </div>
        <span className="text-sm text-gray-500">{current + 1}/{queue.length}</span>
      </div>

      {/* Card */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 mb-4">
        <div className="flex items-center gap-2 mb-4">
          <span className={`text-xs px-2 py-1 rounded-full ${DIFF_COLORS[ann.category]}`}>
            {ANNOTATION_CATEGORY_LABELS[ann.category]}
          </span>
          {ann.isHsfWord && (
            <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full">★ 高频300字</span>
          )}
        </div>

        {/* Context */}
        <div className="text-lg text-gray-700 mb-2 leading-8">
          {highlightWord(ann.context, ann.word)}
        </div>
        {ann.pinyin && (
          <div className="text-sm text-gray-400 mb-4">{ann.word}：{ann.pinyin}</div>
        )}

        {!submitted ? (
          <>
            <div className="text-sm text-gray-500 mb-2">解释"{ann.word}"</div>
            <input
              ref={inputRef}
              autoFocus
              type="text"
              value={userAnswer}
              onChange={(e) => setUserAnswer(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && userAnswer.trim()) handleSubmit() }}
              placeholder="输入释义…"
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
            <div className={`mt-2 rounded-2xl p-4 ${correct ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"}`}>
              <div className={`text-sm font-semibold mb-1 ${correct ? "text-green-700" : "text-red-700"}`}>
                {correct ? "✓ 正确" : "✗ 错误"}
              </div>
              {!correct && (
                <div className="text-sm text-gray-600 mb-2">你的答案：{userAnswer}</div>
              )}
              <div className="text-sm font-medium text-gray-900">标准答案：{ann.answer}</div>
              {ann.loose.length > 0 && (
                <div className="text-xs text-gray-500 mt-1">关键词：{ann.loose.join("、")}</div>
              )}
            </div>
            <button
              onClick={handleNext}
              className="w-full mt-4 bg-gray-900 text-white py-3 rounded-2xl font-semibold active:opacity-80"
            >
              {current + 1 >= queue.length ? "查看结果" : "下一题"}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
