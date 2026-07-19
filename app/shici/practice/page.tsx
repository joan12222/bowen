"use client"

import { useEffect, useState, Suspense } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { getShiciDetail } from "@/lib/shici.local"
import { addMistake } from "@/lib/db.local"
import { buildWordQuestions, makeExampleRef, type ExampleQuestion } from "@/lib/shici-practice"
import PracticeCard from "@/components/shici/PracticeCard"

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

  const [word, setWord] = useState<any>(null)
  const [queue, setQueue] = useState<ExampleQuestion[]>([])
  const [total, setTotal] = useState(0)
  const [mastered, setMastered] = useState(0)
  const [lastCorrect, setLastCorrect] = useState<boolean | null>(null)
  const [seq, setSeq] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) { setLoading(false); return }
    getShiciDetail(id)
      .then(({ word, senses }) => {
        setWord(word)
        if (word && senses.length >= 2) {
          const questions = buildWordQuestions(word, senses)
          setQueue(questions)
          setTotal(questions.length)
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [id])

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-gray-400">加载中…</div>
  }

  // 无 id / 未找到 / 义项不足 → 无法练习
  if (!id || !word || total === 0) {
    return (
      <div className="max-w-xl mx-auto p-6 text-center">
        <Link href="/shici" className="text-sm text-gray-500">← 实词列表</Link>
        <p className="mt-8 text-gray-500 mb-4">该词义项不足，无法生成练习。</p>
        <Link href="/shici" className="text-sm text-red-700">返回实词列表 →</Link>
      </div>
    )
  }

  const current = queue[0]
  const done = mastered >= total && queue.length === 0

  const handleAnswered = (correct: boolean, userAnswer: string) => {
    setLastCorrect(correct)
    if (!correct && current) {
      addMistake({
        questionType: "shici",
        referenceId: makeExampleRef(current.senseId, current.exampleIndex),
        userAnswer,
        correctAnswer: current.answer,
      }).catch(() => {})
    }
  }

  const handleNext = () => {
    setQueue((prev) => {
      const [head, ...rest] = prev
      return lastCorrect ? rest : [...rest, head] // 答对出队，答错重新入队尾
    })
    if (lastCorrect) setMastered((m) => m + 1)
    setLastCorrect(null)
    setSeq((s) => s + 1)
  }

  return (
    <div className="pb-24">
      <div className="flex items-center justify-between px-4 pt-4 mb-2">
        <Link href={`/shici/detail?id=${id}`} className="text-sm text-gray-500">← {word.word}</Link>
        <span className="text-xs text-gray-400">已掌握 {mastered} / {total} 句</span>
      </div>

      {done ? (
        <div className="max-w-xl mx-auto p-6 text-center">
          <div className="text-4xl mb-3">🎉</div>
          <p className="text-gray-700 mb-1">已掌握「{word.word}」全部 {total} 句例句</p>
          <div className="mt-6 flex items-center justify-center gap-3">
            <Link href={`/shici/detail?id=${id}`} className="text-sm bg-gray-100 px-4 py-2 rounded-lg active:opacity-80">
              返回详情
            </Link>
            <Link href="/shici" className="text-sm bg-red-700 text-white px-4 py-2 rounded-lg active:opacity-80">
              实词列表
            </Link>
          </div>
        </div>
      ) : (
        <PracticeCard key={seq} question={current} onAnswered={handleAnswered} onNext={handleNext} />
      )}
    </div>
  )
}
