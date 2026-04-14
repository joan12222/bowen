'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { EBBINGHAUS_INTERVALS } from '@/lib/constants'

function generateQuestion(word: any, senses: any[]) {
  const sense = senses[Math.floor(Math.random() * senses.length)]
  const ex = sense.examples[Math.floor(Math.random() * sense.examples.length)]
  const others = senses
    .filter(s => s.meaning !== sense.meaning)
    .map(s => s.meaning)
    .sort(() => Math.random() - 0.5)
    .slice(0, 3)
  return {
    question: `"${ex.sentence}"（${ex.source}）中，"${word.word}"的意思是：`,
    options: [...others, sense.meaning].sort(() => Math.random() - 0.5),
    answer: sense.meaning,
    senseId: sense.id as string,
    translation: ex.translation,
    wordId: word.id as number,
  }
}

export default function PracticeCard({ word, senses }: { word: any, senses: any[] }) {
  const [q, setQ] = useState(() => generateQuestion(word, senses))
  const [selected, setSelected] = useState<string | null>(null)
  const [score, setScore] = useState({ correct: 0, total: 0 })

  if (senses.length < 2) {
    return (
      <div className="max-w-xl mx-auto p-6 text-center text-gray-500">
        该词义项不足，无法生成选择题。
      </div>
    )
  }

  const handleSelect = async (opt: string) => {
    if (selected) return
    setSelected(opt)
    const correct = opt === q.answer
    setScore(s => ({ correct: s.correct + (correct ? 1 : 0), total: s.total + 1 }))

    if (!correct) {
      const nextReview = new Date()
      nextReview.setDate(nextReview.getDate() + EBBINGHAUS_INTERVALS[0])
      await supabase.from('mistakes').insert({
        question_type: 'shici',
        reference_id: q.senseId,
        user_answer: opt,
        correct_answer: q.answer,
        next_review_at: nextReview.toISOString(),
        review_count: 1,
      })
    }
  }

  return (
    <div className="max-w-xl mx-auto p-6">
      <div className="text-sm text-gray-500 mb-4">得分：{score.correct} / {score.total}</div>
      <p className="text-base mb-6 leading-relaxed">{q.question}</p>
      <div className="grid grid-cols-2 gap-3 mb-6">
        {q.options.map(opt => (
          <button
            key={opt}
            onClick={() => handleSelect(opt)}
            className={`p-3 rounded-xl border text-sm text-left transition-colors active:opacity-80 ${
              !selected
                ? 'border-gray-200 hover:border-red-400 hover:bg-red-50'
                : opt === q.answer
                ? 'border-green-500 bg-green-50 text-green-800'
                : opt === selected
                ? 'border-red-500 bg-red-50 text-red-800'
                : 'border-gray-200 opacity-50'
            }`}
          >
            {opt}
          </button>
        ))}
      </div>
      {selected && (
        <div className="bg-gray-50 rounded-xl p-4 text-sm">
          <p className="font-medium mb-1">
            {selected === q.answer ? '✓ 正确！' : `✗ 正确答案：${q.answer}`}
          </p>
          <p className="text-gray-600 leading-relaxed">{q.translation}</p>
          <button
            onClick={() => { setSelected(null); setQ(generateQuestion(word, senses)) }}
            className="mt-3 bg-red-700 text-white px-3 py-1.5 rounded-lg text-xs active:opacity-80"
          >
            下一题
          </button>
        </div>
      )}
    </div>
  )
}
