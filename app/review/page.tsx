"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Mistake } from "@/lib/types"
import { getMistakes, markMistakeMastered, deleteMistake, clearMistakes } from "@/lib/db.local"

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

const TYPE_LABELS = {
  annotation: "注释",
  translation: "翻译",
  recitation: "默写",
  multiMeaning: "多义",
  shici: "实词",
}

const TYPE_COLORS = {
  annotation: "bg-blue-100 text-blue-700",
  translation: "bg-indigo-100 text-indigo-700",
  recitation: "bg-emerald-100 text-emerald-700",
  multiMeaning: "bg-purple-100 text-purple-700",
  shici: "bg-rose-100 text-rose-700",
}

// 实词错题按「词」归类,保持首次出现顺序。
function groupByChar(list: Mistake[]): [string, Mistake[]][] {
  const map = new Map<string, Mistake[]>()
  for (const m of list) {
    const key = m.shiciCharacter || "（未知）"
    const arr = map.get(key)
    if (arr) arr.push(m)
    else map.set(key, [m])
  }
  return [...map.entries()]
}

export default function ReviewPage() {
  const [mistakes, setMistakes] = useState<Mistake[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>("all")

  async function loadMistakes() {
    setLoading(true)
    try {
      const data = await getMistakes({
        questionType: filter !== "all" ? (filter as Mistake["questionType"]) : undefined,
        isMastered: false,
      })
      setMistakes(data)
    } catch {}
    setLoading(false)
  }

  useEffect(() => {
    loadMistakes()
  }, [filter])

  async function handleMastered(id: string) {
    await markMistakeMastered(id)
    setMistakes((prev) => prev.filter((m) => m.id !== id))
  }

  async function handleDelete(id: string) {
    await deleteMistake(id)
    setMistakes((prev) => prev.filter((m) => m.id !== id))
  }

  async function handleClearAll() {
    const label = filter === "all" ? "全部错题" : `所有${["注释", "翻译", "默写", "多义"][["annotation", "translation", "recitation", "multiMeaning"].indexOf(filter)]}错题`
    if (!confirm(`确定删除${label}？此操作不可恢复。`)) return
    await clearMistakes(filter !== "all" ? (filter as Mistake["questionType"]) : undefined)
    setMistakes([])
  }

  const renderCard = (m: Mistake) => (
    <div key={m.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3">
      <div className="flex items-center gap-2 mb-2">
        <span className={`text-xs px-2 py-0.5 rounded-full ${TYPE_COLORS[m.questionType]}`}>
          {TYPE_LABELS[m.questionType]}
        </span>
        <span className="text-xs text-gray-400">错 {m.reviewCount} 次</span>
      </div>

      {/* 注释上下文 */}
      {m.questionType === 'annotation' && m.annWord && (
        <div className="mb-2">
          {m.annTextTitle && (
            <div className="text-xs text-gray-400 mb-0.5">《{m.annTextTitle}》</div>
          )}
          <div className="text-sm text-gray-700">
            {m.annContext ? highlightWord(m.annContext, m.annWord) : `「${m.annWord}」`}
          </div>
        </div>
      )}

      {/* 实词上下文 */}
      {m.questionType === 'shici' && m.shiciCharacter && (
        <div className="mb-2">
          {m.shiciSource && (
            <div className="text-xs text-gray-400 mb-0.5">《{m.shiciSource}》</div>
          )}
          <div className="text-sm text-gray-700">
            {m.shiciExample ? highlightWord(m.shiciExample, m.shiciCharacter) : `「${m.shiciCharacter}」`}
          </div>
        </div>
      )}

      <div className="text-sm font-medium text-gray-900 mb-1">{m.correctAnswer}</div>
      <div className="text-xs text-gray-400 mb-2">你的答案：{m.userAnswer}</div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => handleMastered(m.id)}
          className="text-xs text-emerald-600 border border-emerald-200 px-3 py-1 rounded-lg active:bg-emerald-50"
        >
          已掌握
        </button>
        <button
          onClick={() => handleDelete(m.id)}
          className="text-xs text-red-500 border border-red-200 px-3 py-1 rounded-lg active:bg-red-50"
        >
          删除
        </button>
      </div>
    </div>
  )

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <h1 className="text-xl font-bold text-gray-900 mb-4">错题本</h1>

      {/* Filter */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
        {[
          { key: "all", label: "全部" },
          { key: "annotation", label: "注释" },
          { key: "recitation", label: "默写" },
          { key: "shici", label: "实词" },
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
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm text-gray-400">共 {mistakes.length} 条错题</div>
            <button
              onClick={handleClearAll}
              className="text-xs text-red-500 border border-red-200 px-3 py-1 rounded-lg active:bg-red-50"
            >
              清除全部
            </button>
          </div>
          {filter === "shici"
            ? groupByChar(mistakes).map(([char, group]) => (
                <div key={char} className="mb-4">
                  <div className="flex items-center justify-between mb-2 mt-1">
                    <div className="text-sm font-semibold text-gray-800">
                      {char}
                      <span className="text-xs text-gray-400 font-normal ml-1">（{group.length}）</span>
                    </div>
                    {char !== "（未知）" && (
                      <Link
                        href={`/review/practice?char=${encodeURIComponent(char)}`}
                        className="text-xs bg-red-700 text-white px-3 py-1 rounded-lg active:opacity-80"
                      >
                        练习
                      </Link>
                    )}
                  </div>
                  <div className="space-y-2">{group.map(renderCard)}</div>
                </div>
              ))
            : mistakes.map(renderCard)}
        </div>
      )}
    </div>
  )
}
