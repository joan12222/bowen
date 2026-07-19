"use client"

import { useEffect, useState, Suspense } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { getShiciDetail, getAdjacentShiciIds } from "@/lib/shici.local"
import SenseTable from "@/components/shici/SenseTable"

type ShiciDetail = Awaited<ReturnType<typeof getShiciDetail>>

export default function ShiciDetailPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64 text-gray-400">加载中…</div>}>
      <ShiciDetailContent />
    </Suspense>
  )
}

function ShiciDetailContent() {
  const idStr = useSearchParams().get("id") || ""
  const id = Number(idStr)
  const [word, setWord] = useState<ShiciDetail["word"]>(null)
  const [senses, setSenses] = useState<ShiciDetail["senses"]>([])
  const [prevId, setPrevId] = useState<number | null>(null)
  const [nextId, setNextId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    Promise.all([getShiciDetail(id), getAdjacentShiciIds(id)])
      .then(([{ word, senses }, { prevId, nextId }]) => {
        setWord(word)
        setSenses(senses)
        setPrevId(prevId)
        setNextId(nextId)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [id])

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-gray-400">加载中…</div>
  }

  if (!word) {
    return (
      <div className="max-w-3xl mx-auto p-4">
        <Link href="/shici" className="text-sm text-gray-500">← 实词列表</Link>
        <p className="mt-8 text-center text-gray-400">未找到该实词</p>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto px-4 pt-4 pb-24">
      <Link href="/shici" className="text-sm text-gray-500">← 实词列表</Link>

      <div className="my-6">
        <div className="flex items-baseline gap-3 flex-wrap">
          <span className="text-5xl font-serif">{word.word}</span>
          <span className="text-xl text-gray-500">{word.pinyin}</span>
          {word.char_type && (
            <span className="text-sm text-gray-400 bg-gray-100 px-2 py-0.5 rounded">{word.char_type}</span>
          )}
        </div>
        {word.origin && (
          <p className="mt-3 text-sm text-gray-600 leading-relaxed bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
            ◎ {word.origin}
          </p>
        )}
        <p className="mt-3 text-sm">
          <span className="font-medium">本义：</span>{word.base_meaning}
        </p>
      </div>

      <SenseTable senses={senses} word={String(word.word)} />

      <div className="flex items-center justify-between mt-8 gap-3">
        {prevId != null ? (
          <Link href={`/shici/detail?id=${prevId}`} className="text-sm bg-gray-100 px-3 py-2 rounded-lg active:opacity-80">
            ← 上一个
          </Link>
        ) : <span />}
        {senses.length >= 2 ? (
          <Link
            href={`/shici/practice?id=${id}`}
            className="bg-red-700 text-white px-4 py-2 rounded-lg text-sm active:opacity-80"
          >
            练习此词
          </Link>
        ) : (
          <span className="bg-gray-100 text-gray-400 px-4 py-2 rounded-lg text-sm">义项不足，无法练习</span>
        )}
        {nextId != null ? (
          <Link href={`/shici/detail?id=${nextId}`} className="text-sm bg-gray-100 px-3 py-2 rounded-lg active:opacity-80">
            下一个 →
          </Link>
        ) : <span />}
      </div>
    </div>
  )
}
