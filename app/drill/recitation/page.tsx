"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { RecitationQuestion, Text } from "@/lib/types"

type RecitationMode = "all" | "byText" | "mistakes" | "gaokao" | "mock"

function compareChars(user: string, correct: string): { char: string; status: "correct" | "wrong" | "missing" }[] {
  const result = []
  for (let i = 0; i < correct.length; i++) {
    if (i >= user.length) {
      result.push({ char: correct[i], status: "missing" as const })
    } else if (user[i] === correct[i]) {
      result.push({ char: user[i], status: "correct" as const })
    } else {
      result.push({ char: correct[i], status: "wrong" as const })
    }
  }
  return result
}

function countErrors(user: string, correct: string): number {
  let errors = 0
  for (let i = 0; i < correct.length; i++) {
    if (i >= user.length || user[i] !== correct[i]) errors++
  }
  return errors
}

export default function RecitationDrillPage() {
  const [texts, setTexts] = useState<Text[]>(() => {
    try {
      const cached = localStorage.getItem("texts_list")
      return cached ? JSON.parse(cached) : []
    } catch { return [] }
  })
  const [selectedTextId, setSelectedTextId] = useState<string>("")
  const [source, setSource] = useState<string>("")
  const [started, setStarted] = useState(false)

  const [queue, setQueue] = useState<RecitationQuestion[]>([])
  const [current, setCurrent] = useState(0)
  const [answers, setAnswers] = useState<string[]>([])
  const [submitted, setSubmitted] = useState(false)
  const [results, setResults] = useState<{ line: string; status: "correct" | "typo" | "wrong"; chars: ReturnType<typeof compareChars> }[]>([])
  const [finished, setFinished] = useState(false)
  const [correctCount, setCorrectCount] = useState(0)

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
    if (selectedTextId) params.set("textId", selectedTextId)
    if (source) params.set("source", source)
    const res = await fetch(`/api/recitations?${params}`)
    const items: RecitationQuestion[] = await res.json()
    const shuffled = items.sort(() => Math.random() - 0.5)
    setQueue(shuffled)
    setCurrent(0)
    setAnswers(shuffled[0]?.answerLines.map(() => "") ?? [])
    setSubmitted(false)
    setResults([])
    setCorrectCount(0)
    setFinished(false)
    setStarted(true)
  }

  function handleSubmit() {
    const q = queue[current]
    const newResults = q.answerLines.map((line, i) => {
      const user = answers[i] || ""
      const errors = countErrors(user, line)
      const chars = compareChars(user, line)
      let status: "correct" | "typo" | "wrong"
      if (errors === 0) status = "correct"
      else if (errors <= 1 && user.length > 0) status = "typo"
      else status = "wrong"
      return { line, status, chars }
    })
    setResults(newResults)
    setSubmitted(true)

    const allCorrect = newResults.every((r) => r.status === "correct")
    const anyWrong = newResults.some((r) => r.status === "wrong")
    if (allCorrect) setCorrectCount((c) => c + 1)
    if (anyWrong || newResults.some((r) => r.status === "typo")) {
      fetch("/api/mistakes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionType: "recitation",
          referenceId: q.id,
          userAnswer: answers.join("；"),
          correctAnswer: q.answer,
        }),
      }).catch(() => {})
    }
  }

  function handleNext() {
    if (current + 1 >= queue.length) {
      setFinished(true)
    } else {
      const next = current + 1
      setCurrent(next)
      setAnswers(queue[next].answerLines.map(() => ""))
      setSubmitted(false)
      setResults([])
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
          <h1 className="text-xl font-bold text-gray-900">理解性默写</h1>
        </div>

        <div className="mb-4">
          <div className="text-sm font-medium text-gray-700 mb-2">选择篇目</div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <label className="flex items-center gap-3 px-4 py-3">
              <input type="radio" name="text" checked={selectedTextId === ""} onChange={() => setSelectedTextId("")} className="accent-red-700" />
              <span className="text-sm text-gray-800">全部篇目</span>
            </label>
            {texts.map((t) => (
              <label key={t.id} className="flex items-center gap-3 px-4 py-3 border-t border-gray-50">
                <input type="radio" name="text" checked={selectedTextId === t.id} onChange={() => setSelectedTextId(t.id)} className="accent-red-700" />
                <span className="text-sm text-gray-800">{t.title}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="mb-6">
          <div className="text-sm font-medium text-gray-700 mb-2">来源筛选</div>
          <div className="flex gap-2">
            {[
              { val: "", label: "全部" },
              { val: "高考真题", label: "高考真题" },
              { val: "模拟题", label: "模拟题" },
            ].map(({ val, label }) => (
              <button
                key={val}
                onClick={() => setSource(val)}
                className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                  source === val ? "bg-red-700 text-white border-red-700" : "bg-white text-gray-700 border-gray-200"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <button onClick={startDrill} className="w-full bg-red-700 text-white py-3 rounded-2xl font-semibold active:opacity-80">
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
            <div className="text-xl font-bold mb-2">暂无题目</div>
            <div className="text-gray-500 mb-6">请先导入默写题数据</div>
          </>
        ) : (
          <>
            <div className="text-xl font-bold mb-2">默写完成！</div>
            <div className="text-gray-500 mb-2">共 {queue.length} 题，答对 {correctCount} 题</div>
            <div className="text-2xl font-bold text-red-700 mb-6">{Math.round((correctCount / queue.length) * 100)}%</div>
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

  const q = queue[current]

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => setStarted(false)} className="text-gray-500">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full bg-emerald-600 rounded-full transition-all" style={{ width: `${(current / queue.length) * 100}%` }} />
        </div>
        <span className="text-sm text-gray-500">{current + 1}/{queue.length}</span>
      </div>

      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 mb-4">
        <div className="flex items-center gap-2 mb-4">
          {q.source && (
            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">{q.source}</span>
          )}
        </div>

        <div className="text-base text-gray-700 leading-7 mb-6">{q.prompt}</div>

        {!submitted ? (
          <>
            <div className="space-y-3">
              {q.answerLines.map((_, i) => (
                <input
                  key={i}
                  type="text"
                  value={answers[i] || ""}
                  onChange={(e) => {
                    const next = [...answers]
                    next[i] = e.target.value
                    setAnswers(next)
                  }}
                  placeholder={`第 ${i + 1} 句`}
                  className="w-full border-b-2 border-gray-200 focus:border-emerald-500 py-2 text-base text-gray-900 outline-none bg-transparent transition-colors placeholder-gray-300"
                  autoFocus={i === 0}
                />
              ))}
            </div>
            <button
              onClick={handleSubmit}
              disabled={answers.every((a) => !a.trim())}
              className="w-full mt-6 bg-gray-900 text-white py-3 rounded-2xl font-semibold active:opacity-80 disabled:opacity-30"
            >
              提交
            </button>
          </>
        ) : (
          <>
            <div className="space-y-3 mb-4">
              {results.map((r, i) => (
                <div key={i}>
                  {r.status === "correct" ? (
                    <div className="py-2 text-green-700 font-medium">{r.line} ✓</div>
                  ) : r.status === "typo" ? (
                    <div>
                      <div className="py-1 text-amber-600 text-sm">注意有错别字</div>
                      <div className="py-1 font-medium flex flex-wrap">
                        {r.chars.map((c, j) => (
                          <span key={j} className={c.status === "wrong" ? "bg-amber-200 text-amber-900" : "text-gray-900"}>
                            {c.char}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="py-1 text-red-600 text-sm mb-1">你的答案：{answers[i] || "（未填写）"}</div>
                      <div className="py-1 font-medium flex flex-wrap">
                        {r.chars.map((c, j) => (
                          <span key={j} className={
                            c.status === "wrong" ? "bg-red-200 text-red-900" :
                            c.status === "missing" ? "bg-red-100 text-red-400" :
                            "text-gray-900"
                          }>
                            {c.char}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <button onClick={handleNext} className="w-full bg-gray-900 text-white py-3 rounded-2xl font-semibold active:opacity-80">
              {current + 1 >= queue.length ? "查看结果" : "下一题"}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
