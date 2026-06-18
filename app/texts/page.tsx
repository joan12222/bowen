"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { TextWithCounts, VolumeId } from "@/lib/types"
import { VOLUME_LABELS } from "@/lib/constants"
import { getTextsWithCounts } from "@/lib/db.local"

const VOLUME_ORDER: VolumeId[] = [
  "required_1",
  "required_2",
  "selective_1",
  "selective_2",
  "selective_3",
  "custom",
]

export default function TextsPage() {
  const [texts, setTexts] = useState<TextWithCounts[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<Set<VolumeId>>(new Set(["required_2"]))

  useEffect(() => {
    getTextsWithCounts()
      .then((list) => setTexts(list))
      .finally(() => setLoading(false))
  }, [])

  const grouped = VOLUME_ORDER.reduce<Record<VolumeId, TextWithCounts[]>>(
    (acc, v) => {
      acc[v] = texts.filter((t) => t.volumeId === v)
      return acc
    },
    {} as Record<VolumeId, TextWithCounts[]>
  )

  function toggleVolume(v: VolumeId) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(v)) next.delete(v)
      else next.add(v)
      return next
    })
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900">篇目</h1>
        <Link
          href="/texts/new"
          className="text-sm bg-red-700 text-white px-3 py-1.5 rounded-lg active:opacity-80"
        >
          + 新增篇目
        </Link>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">加载中…</div>
      ) : (
        <div className="space-y-3">
          {VOLUME_ORDER.map((volumeId) => {
            const items = grouped[volumeId]
            if (items.length === 0 && volumeId !== "required_2") return null
            const isExpanded = expanded.has(volumeId)
            return (
              <div key={volumeId} className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
                <button
                  className="w-full flex items-center justify-between p-4 text-left"
                  onClick={() => toggleVolume(volumeId)}
                >
                  <span className="font-semibold text-gray-900">{VOLUME_LABELS[volumeId]}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-400">{items.length} 篇</span>
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? "rotate-90" : ""}`}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-gray-100">
                    {items.length === 0 ? (
                      <div className="px-4 py-6 text-center text-gray-400 text-sm">
                        暂无篇目，点击右上角新增
                      </div>
                    ) : (() => {
                      const prose = items.filter(t => t.textType !== 'gushici')
                      const poetry = items.filter(t => t.textType === 'gushici')
                      const hasBoth = prose.length > 0 && poetry.length > 0
                      const renderItem = (text: typeof items[0], idx: number, showBorder: boolean) => (
                        <Link key={text.id} href={`/texts/detail?id=${text.id}`}>
                          <div className={`flex items-center justify-between px-4 py-3 active:bg-gray-50 ${showBorder ? "border-t border-gray-50" : ""}`}>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-gray-900 truncate">{text.title}</div>
                              <div className="text-xs text-gray-400 mt-0.5">{text.dynasty} · {text.author}</div>
                            </div>
                            <div className="flex items-center gap-3 ml-4">
                              <div className="text-right">
                                <div className="text-xs text-gray-500 space-x-2">
                                  <span>注{text.annotationCount}</span>
                                  <span>译{text.sentenceCount}</span>
                                  <span>默{text.recitationCount}</span>
                                </div>
                              </div>
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4 text-gray-300 flex-shrink-0">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                              </svg>
                            </div>
                          </div>
                        </Link>
                      )
                      return (
                        <>
                          {prose.map((text, idx) => renderItem(text, idx, idx > 0))}
                          {hasBoth && (
                            <div className="px-4 py-1.5 bg-gray-50 border-t border-gray-100">
                              <span className="text-xs text-gray-400 font-medium">古诗词</span>
                            </div>
                          )}
                          {poetry.map((text, idx) => renderItem(text, idx, !hasBoth && idx > 0))}
                        </>
                      )
                    })()}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
