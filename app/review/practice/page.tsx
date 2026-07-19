"use client"

import { useEffect, useState, Suspense } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { getShiciMistakeQuestions } from "@/lib/shici.local"
import { addMistake, markMistakeMastered } from "@/lib/db.local"
import { makeExampleRef, type ExampleQuestion } from "@/lib/shici-practice"
import PracticeCard from "@/components/shici/PracticeCard"

type Item = { mistakeId: string; question: ExampleQuestion }

export default function ReviewPracticePage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64 text-gray-400">加载中…</div>}>
      <ReviewPracticeContent />
    </Suspense>
  )
}

function ReviewPracticeContent() {
  const char = useSearchParams().get("char") || undefined

  const [items, setItems] = useState<Item[]>([])
  const [idx, setIdx] = useState(0)
  const [lastCorrect, setLastCorrect] = useState<boolean | null>(null)
  const [stats, setStats] = useState({ removed: 0, kept: 0, wrong: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getShiciMistakeQuestions(char)
      .then((data) => { setItems(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [char])

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-gray-400">加载中…</div>
  }

  if (items.length === 0) {
    return (
      <div className="max-w-xl mx-auto p-6 text-center">
        <Link href="/review" className="text-sm text-gray-500">← 错题本</Link>
        <div className="text-4xl mt-10 mb-3">🎉</div>
        <p className="text-gray-500">暂无{char ? `「${char}」的` : ""}实词错题</p>
      </div>
    )
  }

  const done = idx >= items.length
  const current = items[idx]

  const handleAnswered = (correct: boolean, userAnswer: string) => {
    setLastCorrect(correct)
    if (correct) {
      const remove = window.confirm(`答对了！从错题本移除「${current.question.word.word}」的这道题？`)
      if (remove) {
        markMistakeMastered(current.mistakeId).catch(() => {})
        setStats((s) => ({ ...s, removed: s.removed + 1 }))
      } else {
        setStats((s) => ({ ...s, kept: s.kept + 1 }))
      }
    } else {
      addMistake({
        questionType: "shici",
        referenceId: makeExampleRef(current.question.senseId, current.question.exampleIndex),
        userAnswer,
        correctAnswer: current.question.answer,
      }).catch(() => {})
      setStats((s) => ({ ...s, wrong: s.wrong + 1 }))
    }
  }

  const handleNext = () => {
    setIdx((i) => i + 1)
    setLastCorrect(null)
  }

  return (
    <div className="pb-24">
      <div className="flex items-center justify-between px-4 pt-4 mb-2">
        <Link href="/review" className="text-sm text-gray-500">← 错题本</Link>
        {!done && (
          <span className="text-xs text-gray-400">
            {char ? `「${char}」 ` : ""}{idx + 1} / {items.length}
          </span>
        )}
      </div>

      {done ? (
        <div className="max-w-xl mx-auto p-6 text-center">
          <div className="text-4xl mb-3">🎉</div>
          <p className="text-gray-700 mb-1">练习完成</p>
          <p className="text-sm text-gray-500 mb-6">
            答对移除 {stats.removed} · 答对保留 {stats.kept} · 答错 {stats.wrong}
          </p>
          <Link href="/review" className="text-sm bg-red-700 text-white px-4 py-2 rounded-lg active:opacity-80">
            返回错题本
          </Link>
        </div>
      ) : (
        <PracticeCard
          key={idx}
          question={current.question}
          onAnswered={handleAnswered}
          onNext={handleNext}
          nextLabel={idx + 1 >= items.length ? "完成" : "下一题"}
        />
      )}
    </div>
  )
}
