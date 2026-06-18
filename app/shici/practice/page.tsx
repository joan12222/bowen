"use client"

import { useEffect, useState, Suspense } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { getShiciDetail, getRandomShiciWord } from "@/lib/shici.local"
import PracticeCard from "@/components/shici/PracticeCard"

type PracticeResult = Awaited<ReturnType<typeof getShiciDetail>>

export default function ShiciPracticePage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64 text-gray-400">加载中…</div>}>
      <ShiciPracticeContent />
    </Suspense>
  )
}

function ShiciPracticeContent() {
  const idStr = useSearchParams().get("id")
  const id = idStr ? Number(idStr) : null
  const [result, setResult] = useState<PracticeResult | null>(null)
  const [loading, setLoading] = useState(true)

  function loadRandom() {
    setLoading(true)
    getRandomShiciWord()
      .then((r) => { setResult(r); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(() => {
    const load = id ? getShiciDetail(id) : getRandomShiciWord()
    load
      .then((r) => { setResult(r); setLoading(false) })
      .catch(() => setLoading(false))
  }, [id])

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-gray-400">加载中…</div>
  }

  if (!result || !result.word || result.senses.length < 2) {
    return (
      <div className="max-w-xl mx-auto p-6 text-center">
        <Link href="/shici" className="text-sm text-gray-500">← 实词列表</Link>
        <p className="mt-8 text-gray-500 mb-4">暂无足够词条，请先导入实词数据。</p>
        <Link href="/shici/import" className="text-sm text-red-700">前往导入 →</Link>
      </div>
    )
  }

  const { word, senses } = result

  return (
    <div className="pb-24">
      <div className="flex items-center justify-between px-4 pt-4 mb-2">
        {id ? (
          <Link href={`/shici/detail?id=${id}`} className="text-sm text-gray-500">← {word.word}</Link>
        ) : (
          <Link href="/shici" className="text-sm text-gray-500">← 实词列表</Link>
        )}
        {id ? (
          <Link
            href="/shici/practice"
            className="text-xs text-gray-500 bg-gray-100 px-3 py-1.5 rounded-lg active:opacity-80"
          >
            随机练习
          </Link>
        ) : (
          <button
            onClick={loadRandom}
            className="text-xs text-gray-500 bg-gray-100 px-3 py-1.5 rounded-lg active:opacity-80"
          >
            换一个词
          </button>
        )}
      </div>
      {!id && (
        <div className="text-center mb-2">
          <span className="text-3xl font-serif">{word.word}</span>
          <span className="text-gray-400 text-sm ml-2">{word.pinyin}</span>
        </div>
      )}
      <PracticeCard word={word} senses={senses} />
    </div>
  )
}
