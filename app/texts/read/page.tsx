"use client"

import { useEffect, useState, Suspense } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { TextWithCounts, Annotation } from "@/lib/types"
import { getText, getAnnotations } from "@/lib/db.local"

function splitIntoSentences(content: string): string[] {
  const parts = content
    .replace(/\r\n/g, "\n")
    .split(/(?<=[。！？])/g)
    .flatMap((s) => s.split("\n"))
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
  // Merge orphaned trailing punctuation/quotes (no CJK chars) into the previous sentence
  const result: string[] = []
  for (const part of parts) {
    if (result.length > 0 && !/[一-鿿]/.test(part)) {
      result[result.length - 1] += part
    } else {
      result.push(part)
    }
  }
  return result
}

// Map each annotation to exactly the sentence whose position in `content`
// contains the annotation's context.  This is strict: an annotation only
// appears where the original document had a circled number, even when the
// same sentence text occurs multiple times.
function buildAnnotationsBySentence(
  content: string,
  sentences: string[],
  annotations: Annotation[]
): Annotation[][] {
  // Compute the start offset of each sentence inside the content string.
  const starts: number[] = []
  let pos = 0
  for (const s of sentences) {
    const idx = content.indexOf(s, pos)
    starts.push(idx)
    if (idx >= 0) pos = idx + s.length
  }

  const result: Annotation[][] = sentences.map(() => [])

  for (const ann of annotations) {
    if (!ann.context) continue
    const ctxIdx = content.indexOf(ann.context)
    if (ctxIdx === -1) continue
    for (let si = 0; si < sentences.length; si++) {
      const s = starts[si]
      if (s !== -1 && ctxIdx >= s && ctxIdx < s + sentences[si].length) {
        result[si].push(ann)
        break
      }
    }
  }

  return result
}

interface SubAnnotation { word: string; meaning: string }
interface ParsedAnswer { main: string; subs: SubAnnotation[] }

// Split answer into main explanation + sub-annotations like "择，区别。放，放纵。"
function parseAnswer(answer: string): ParsedAnswer {
  const parts = answer.split(/(?<=[。！？])/).filter((s) => s.trim())
  if (parts.length <= 1) return { main: answer, subs: [] }

  const subs: SubAnnotation[] = []
  const mainParts: string[] = [parts[0]]
  for (let i = 1; i < parts.length; i++) {
    const part = parts[i].trim()
    if (!part) continue
    // Sub-annotation: 1–2 char word (optionally with pinyin) then ，meaning
    const m = part.match(/^([^\s，。！？；]{1,2})(?:（[^）]+）)?，(.+?)。?$/)
    if (m) {
      subs.push({ word: m[1], meaning: m[2] })
    } else {
      mainParts.push(parts[i])
    }
  }
  return { main: mainParts.join(""), subs }
}


type Segment = { text: string; annotation?: Annotation }

function buildSegments(sentence: string, anns: Annotation[]): Segment[] {
  const segments: Segment[] = []
  let remaining = sentence
  const sorted = [...anns].sort((a, b) => sentence.indexOf(a.word) - sentence.indexOf(b.word))
  for (const ann of sorted) {
    const idx = remaining.indexOf(ann.word)
    if (idx === -1) continue
    if (idx > 0) segments.push({ text: remaining.slice(0, idx) })
    segments.push({ text: ann.word, annotation: ann })
    remaining = remaining.slice(idx + ann.word.length)
  }
  if (remaining) segments.push({ text: remaining })
  return segments
}

function AnnotatedWord({ seg }: { seg: { text: string; annotation: Annotation } }) {
  return (
    <span className="inline-flex flex-col items-start mr-0.5 mb-2 align-top">
      <span className="text-base font-semibold text-amber-900 bg-amber-50 border-b-2 border-amber-400 px-0.5 leading-8 whitespace-nowrap">
        {seg.text}
      </span>
      <span className="text-[11px] text-gray-500 leading-snug mt-0.5 max-w-[12rem]">
        {seg.annotation.pinyin && (
          <span className="text-amber-500 mr-0.5">{seg.annotation.pinyin}</span>
        )}
        {seg.annotation.answer}
      </span>
    </span>
  )
}

function SentenceBlock({ sentence, anns }: { sentence: string; anns: Annotation[] }) {
  const segments = buildSegments(sentence, anns)

  return (
    <div className="mb-4">
      <div className="flex flex-wrap items-start text-base text-gray-900 leading-relaxed">
        {segments.map((seg, i) =>
          seg.annotation ? (
            <AnnotatedWord key={i} seg={seg as { text: string; annotation: Annotation }} />
          ) : (
            <span key={i} className="leading-8">{seg.text}</span>
          )
        )}
      </div>
    </div>
  )
}

export default function ReadPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64 text-gray-400">加载中…</div>}>
      <ReadPageContent />
    </Suspense>
  )
}

function ReadPageContent() {
  const id = useSearchParams().get("id") || ""
  const [text, setText] = useState<TextWithCounts | null>(null)
  const [annotations, setAnnotations] = useState<Annotation[]>([])
  const [loading, setLoading] = useState(true)
  const [showTranslation, setShowTranslation] = useState(false)
  const [showAppreciation, setShowAppreciation] = useState(false)

  useEffect(() => {
    if (!id) return
    Promise.all([
      getText(id),
      getAnnotations(id),
    ])
      .then(([t, a]) => {
        setText(t)
        setAnnotations(a)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [id])

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400">加载中…</div>
  if (!text) return <div className="flex items-center justify-center h-64 text-gray-400">篇目不存在</div>

  if (!text.content) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="flex items-center gap-3 mb-6">
          <Link href={`/texts/detail?id=${id}`} className="text-gray-500">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <h1 className="text-xl font-bold">{text.title}</h1>
        </div>
        <div className="text-center py-12 text-gray-400">
          <div className="text-3xl mb-2">📄</div>
          <div className="mb-4">暂无原文内容</div>
          <Link href={`/texts/import?id=${id}`} className="text-indigo-600 text-sm">
            前往导入 Word 文档
          </Link>
        </div>
      </div>
    )
  }

  const titleNote = annotations.find((a) => a.word === "题注")
  const wordAnnotations = annotations.filter((a) => a.word !== "题注")
  const sentences = splitIntoSentences(text.content)
  const annsBySentence = buildAnnotationsBySentence(text.content, sentences, wordAnnotations)

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <Link href={`/texts/detail?id=${id}`} className="text-gray-500 flex-shrink-0">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900">{text.title}</h1>
          <div className="text-xs text-gray-400 mt-0.5">
            {text.dynasty} · {text.author}{text.source ? ` · ${text.source}` : ""}
            <span className="ml-2">{wordAnnotations.length} 条注释</span>
          </div>
        </div>
      </div>

      {/* Title note */}
      {titleNote && (
        <div className="mb-6 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
          <div className="text-[10px] font-medium text-amber-400 mb-1 uppercase tracking-wide">题注</div>
          <div className="text-sm text-amber-900 leading-6">{titleNote.answer}</div>
        </div>
      )}

      {/* Annotated sentences */}
      <div className="space-y-6">
        {sentences.map((sentence, si) => {
          const anns = annsBySentence[si]
          return (
            <div key={si}>
              <SentenceBlock sentence={sentence} anns={anns} />
            </div>
          )
        })}
      </div>

      {/* Translation toggle */}
      {text?.translation && (
        <div className="mt-8 pt-4 border-t border-gray-100">
          <button
            onClick={() => setShowTranslation(v => !v)}
            className="w-full flex items-center justify-between px-1 py-2 text-sm font-medium text-indigo-700"
          >
            <span>全文翻译</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
              className={`w-4 h-4 transition-transform ${showTranslation ? "rotate-90" : ""}`}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
          {showTranslation && (
            <div className="mt-3 bg-indigo-50 rounded-xl px-4 py-4 prose">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {text.translation}
              </ReactMarkdown>
            </div>
          )}
        </div>
      )}

      {/* Appreciation toggle */}
      {text?.appreciation && (
        <div className="mt-6 pt-4 border-t border-gray-100">
          <button
            onClick={() => setShowAppreciation(v => !v)}
            className="w-full flex items-center justify-between px-1 py-2 text-sm font-medium text-amber-700"
          >
            <span>全文赏析</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
              className={`w-4 h-4 transition-transform ${showAppreciation ? "rotate-90" : ""}`}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
          {showAppreciation && (
            <div className="mt-3 bg-amber-50 rounded-xl px-4 py-4 prose">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {text.appreciation}
              </ReactMarkdown>
            </div>
          )}
        </div>
      )}

      {/* Practice button */}
      <div className="mt-10 pt-4 border-t border-gray-100">
        <Link href="/drill/annotation">
          <button className="w-full bg-red-700 text-white py-3 rounded-2xl font-semibold active:opacity-80">
            开始注释背默练习
          </button>
        </Link>
      </div>
    </div>
  )
}
