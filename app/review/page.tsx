"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Mistake } from "@/lib/types"

const TYPE_LABELS = {
  annotation: "注释",
  translation: "翻译",
  recitation: "默写",
  multiMeaning: "多义",
}

const TYPE_COLORS = {
  annotation: "bg-blue-100 text-blue-700",
  translation: "bg-indigo-100 text-indigo-700",
  recitation: "bg-emerald-100 text-emerald-700",
  multiMeaning: "bg-purple-100 text-purple-700",
}

export default function ReviewPage() {
  const [mistakes, setMistakes] = useState<Mistake[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>("all")
  const [todayCount, setTodayCount] = useState(0)

  async function loadMistakes() {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filter !== "all") params.set("questionType", filter)
      params.set("isMastered", "false")
      const res = await fetch(`/api/mistakes?${params}`)
      const data = await res.json()
      setMistakes(data)
    } catch {}
    setLoading(false)
  }

  useEffect(() => {
    loadMistakes()
  }, [filter])

  useEffect(() => {
    fetch("/api/review/today/count")
      .then((r) => r.json())
      .then((d) => setTodayCount(d.count))
      .catch(() => {})
  }, [])

  async function handleMastered(id: string) {
    await fetch(`/api/mistakes/${id}/mastered`, { method: "POST" })
    setMistakes((prev) => prev.filter((m) => m.id !== id))
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <h1 className="text-xl font-bold text-gray-900 mb-4">错题本</h1>

      {todayCount > 0 && (
        <Link href="/review/today">
          <div className="mb-4 bg-red-700 text-white rounded-2xl p-4 flex items-center justify-between active:opacity-90">
            <div>
              <div className="font-semibold">今日待复习 {todayCount} 题</div>
              <div className="text-red-200 text-sm">点击开始复习</div>
            </div>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5 text-red-200">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </Link>
      )}

      {/* Filter */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
        {[
          { key: "all", label: "全部" },
          { key: "annotation", label: "注释" },
          { key: "translation", label: "翻译" },
          { key: "recitation", label: "默写" },
          { key: "multiMeaning", label: "多义" },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-sm border transition-colors ${
              filter === key ? "bg-red-700 text-white border-red-700" : "bg-white text-gray-700 border-gray-200"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">加载中…</div>
      ) : mistakes.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-4xl mb-3">🎉</div>
          <div className="text-gray-500">暂无错题</div>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="text-sm text-gray-400 mb-2">共 {mistakes.length} 条错题</div>
          {mistakes.map((m) => {
            const reviewDate = new Date(m.nextReviewAt)
            const isDue = reviewDate <= new Date()
            return (
              <div key={m.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${TYPE_COLORS[m.questionType]}`}>
                    {TYPE_LABELS[m.questionType]}
                  </span>
                  <span className="text-xs text-gray-400">错 {m.reviewCount} 次</span>
                  {isDue && (
                    <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">待复习</span>
                  )}
                  <span className="text-xs text-gray-400 ml-auto">
                    {isDue ? "今日" : `${reviewDate.getMonth() + 1}/${reviewDate.getDate()}`} 复习
                  </span>
                </div>
                <div className="text-sm font-medium text-gray-900 mb-1">{m.correctAnswer}</div>
                <div className="text-xs text-gray-400 mb-2">你的答案：{m.userAnswer}</div>
                <button
                  onClick={() => handleMastered(m.id)}
                  className="text-xs text-emerald-600 border border-emerald-200 px-3 py-1 rounded-lg active:bg-emerald-50"
                >
                  已掌握
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
