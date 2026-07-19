'use client'
import { useState } from 'react'
import type { ExampleQuestion } from '@/lib/shici-practice'

// Controlled single-question card. The parent session owns the queue and all
// side effects: `onAnswered(correct)` fires once when an option is chosen
// (parent records mistakes / marks mastered), `onNext` advances the queue.
// Parent should mount with a per-question `key` so state resets between items.
export default function PracticeCard({
  question,
  onAnswered,
  onNext,
  nextLabel = '下一题',
}: {
  question: ExampleQuestion
  onAnswered: (correct: boolean, userAnswer: string) => void
  onNext: () => void
  nextLabel?: string
}) {
  const [selected, setSelected] = useState<string | null>(null)

  const handleSelect = (opt: string) => {
    if (selected) return
    setSelected(opt)
    onAnswered(opt === question.answer, opt)
  }

  return (
    <div className="max-w-xl mx-auto p-6">
      <p className="text-base mb-1 leading-relaxed">
        「{question.word.word}」在下句中的意思是:
      </p>
      <p className="text-base mb-1 leading-relaxed font-serif">{question.sentence}</p>
      <p className="text-xs text-gray-400 mb-5">{question.source}</p>

      <div className="flex flex-col gap-2 mb-6">
        {question.options.map((opt) => (
          <button
            key={opt}
            onClick={() => handleSelect(opt)}
            className={`p-3 rounded-xl border text-sm text-left transition-colors active:opacity-80 ${
              !selected
                ? 'border-gray-200 hover:border-red-400 hover:bg-red-50'
                : opt === question.answer
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
            {selected === question.answer ? '✓ 正确！' : `✗ 正确答案：${question.answer}`}
          </p>
          <p className="text-gray-600 leading-relaxed">{question.translation}</p>
          <button
            onClick={onNext}
            className="mt-3 bg-red-700 text-white px-3 py-1.5 rounded-lg text-xs active:opacity-80"
          >
            {nextLabel}
          </button>
        </div>
      )}
    </div>
  )
}
