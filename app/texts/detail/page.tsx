"use client"

import { useState, useEffect, Suspense } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { TextWithCounts, Annotation, Sentence, RecitationQuestion } from "@/lib/types"
import { ANNOTATION_CATEGORY_LABELS } from "@/lib/constants"
import {
  getText, getAnnotations, getSentences, getRecitationQuestions,
  updateTextContent, updateTextTranslation, deleteText,
  clearAnnotationsForText, clearSentencesForText, clearRecitationsForText,
  importRecitationQuestions,
} from "@/lib/db.local"

type Tab = "annotations" | "sentences" | "recitations" | "analysis"

export default function TextDetailPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64 text-gray-400">加载中…</div>}>
      <TextDetailContent />
    </Suspense>
  )
}

function TextDetailContent() {
  const id = useSearchParams().get("id") || ""
  const router = useRouter()
  const [text, setText] = useState<TextWithCounts | null>(null)
  const [tab, setTab] = useState<Tab>("annotations")
  const [annotations, setAnnotations] = useState<Annotation[]>([])
  const [sentences, setSentences] = useState<Sentence[]>([])
  const [recitations, setRecitations] = useState<RecitationQuestion[]>([])
  const [loading, setLoading] = useState(true)
  const [showContent, setShowContent] = useState(false)
  const [editingContent, setEditingContent] = useState(false)
  const [contentDraft, setContentDraft] = useState("")
  const [savingContent, setSavingContent] = useState(false)
  const [editingTranslation, setEditingTranslation] = useState(false)
  const [translationDraft, setTranslationDraft] = useState("")
  const [editingAppreciation, setEditingAppreciation] = useState(false)
  const [appreciationDraft, setAppreciationDraft] = useState("")
  const [savingAnalysis, setSavingAnalysis] = useState(false)
  const [showRecitationImport, setShowRecitationImport] = useState(false)
  const [recitationJsonDraft, setRecitationJsonDraft] = useState("")
  const [importingRecitation, setImportingRecitation] = useState(false)

  async function saveContent() {
    setSavingContent(true)
    try {
      await updateTextContent(id, contentDraft)
      setText((prev) => prev ? { ...prev, content: contentDraft } : prev)
      setEditingContent(false)
    } catch {
      alert("保存失败")
    } finally {
      setSavingContent(false)
    }
  }

  async function importRecitationsFromJson() {
    let parsed: { recitations?: unknown[] }
    try {
      parsed = JSON.parse(recitationJsonDraft)
    } catch {
      alert("JSON 格式错误，请检查")
      return
    }
    if (!Array.isArray(parsed.recitations) || parsed.recitations.length === 0) {
      alert("JSON 中未找到 recitations 数组")
      return
    }
    setImportingRecitation(true)
    try {
      const questions = parsed.recitations.map((q) => {
        const r = q as Record<string, unknown>
        return {
          prompt: r.prompt as string,
          answer: r.answer as string,
          answerLines: (r.answerLines as string[]) || [r.answer as string],
          source: (r.source as string) || "模拟题",
          isBuiltin: false,
        }
      })
      const result = await importRecitationQuestions(id, questions)
      const updated = await getRecitationQuestions(id)
      setRecitations(updated)
      setText((prev) => prev ? { ...prev, recitationCount: updated.length } : prev)
      setShowRecitationImport(false)
      setRecitationJsonDraft("")
      alert(`导入成功：新增 ${result.success} 条，跳过重复 ${result.skipped} 条`)
    } catch (e) {
      alert(e instanceof Error ? e.message : "导入失败")
    } finally {
      setImportingRecitation(false)
    }
  }

  async function saveAnalysis() {
    setSavingAnalysis(true)
    try {
      await updateTextTranslation(id, {
        translation: editingTranslation ? translationDraft : (text?.translation ?? ""),
        appreciation: editingAppreciation ? appreciationDraft : (text?.appreciation ?? ""),
      })
      const updated = await getText(id)
      setText(updated)
      setEditingTranslation(false)
      setEditingAppreciation(false)
    } catch {
      alert("保存失败")
    } finally {
      setSavingAnalysis(false)
    }
  }

  useEffect(() => {
    if (!id) return
    getText(id)
      .then((data) => setText(data))
      .finally(() => setLoading(false))
  }, [id])

  useEffect(() => {
    if (!id) return
    if (tab === "annotations") {
      getAnnotations(id).then(setAnnotations)
    } else if (tab === "sentences") {
      getSentences(id).then(setSentences)
    } else if (tab === "recitations") {
      getRecitationQuestions(id).then(setRecitations)
    }
  }, [tab, id])

  async function handleDelete() {
    if (!text || text.isBuiltin) return
    if (!confirm(`确定删除《${text.title}》及所有相关数据？`)) return
    await deleteText(id)
    router.push("/texts")
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-gray-400">加载中…</div>
  }
  if (!text) {
    return <div className="flex items-center justify-center h-64 text-gray-400">篇目不存在</div>
  }

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: "annotations", label: "注释", count: text.annotationCount },
    { key: "sentences", label: "翻译", count: text.sentenceCount },
    { key: "recitations", label: "默写", count: text.recitationCount },
    { key: "analysis", label: "翻译赏析", count: (text.translation ? 1 : 0) + (text.appreciation ? 1 : 0) },
  ]

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <Link href="/texts" className="text-gray-500">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900">{text.title}</h1>
          <div className="text-sm text-gray-500">{text.dynasty} · {text.author}{text.source ? ` · ${text.source}` : ""}</div>
        </div>
        <Link href={`/drill/annotation?textId=${id}`}>
          <span className="text-sm bg-red-700 text-white px-3 py-1.5 rounded-lg active:opacity-80">练习</span>
        </Link>
        {!text.isBuiltin && (
          <button onClick={handleDelete} className="text-sm text-red-500 px-3 py-1.5">删除</button>
        )}
      </div>

      {/* Read mode entry */}
      {text.content ? (
        <div className="mb-4 flex gap-2">
          <Link href={`/texts/read?id=${id}`} className="flex-1">
            <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 flex items-center justify-between active:opacity-80 h-full">
              <div>
                <span className="text-sm font-medium text-amber-900">阅读原文（带注释）</span>
                <span className="text-xs text-amber-600 ml-2">学习素材</span>
              </div>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4 text-amber-400">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </Link>
          <button
            onClick={async () => {
              if (!confirm("清空原文内容？")) return
              await updateTextContent(id, "")
              setText((prev) => prev ? { ...prev, content: "" } : prev)
            }}
            className="bg-white border border-gray-200 rounded-2xl px-3 text-xs text-gray-400 active:bg-gray-50 flex-shrink-0"
          >
            清空原文
          </button>
        </div>
      ) : (
        !editingContent && (
          <button
            onClick={() => { setEditingContent(true); setContentDraft("") }}
            className="mb-4 w-full bg-amber-50 border border-dashed border-amber-300 rounded-2xl px-4 py-3 text-sm text-amber-700 text-left active:opacity-80"
          >
            + 粘贴原文，开启带注释阅读模式
          </button>
        )
      )}

      {/* Content editor */}
      {editingContent && (
        <div className="mb-4 bg-white rounded-2xl border border-amber-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-50 flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">粘贴原文</span>
            <button onClick={() => setEditingContent(false)} className="text-xs text-gray-400">取消</button>
          </div>
          <textarea
            value={contentDraft}
            onChange={(e) => setContentDraft(e.target.value)}
            placeholder="粘贴原文内容…"
            rows={8}
            autoFocus
            className="w-full px-4 py-3 text-sm text-gray-900 outline-none bg-transparent resize-none placeholder-gray-300 leading-7"
          />
          <div className="px-4 pb-3">
            <button
              onClick={saveContent}
              disabled={!contentDraft.trim() || savingContent}
              className="w-full bg-amber-700 text-white py-2.5 rounded-xl text-sm font-semibold disabled:opacity-40"
            >
              {savingContent ? "保存中…" : "保存原文"}
            </button>
          </div>
        </div>
      )}

      {/* Original Text */}
      {text.content && (
        <div className="mb-4 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <button
            className="w-full flex items-center justify-between px-4 py-3"
            onClick={() => setShowContent((v) => !v)}
          >
            <span className="text-sm font-medium text-gray-700">原文</span>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              className={`w-4 h-4 text-gray-400 transition-transform ${showContent ? "rotate-90" : ""}`}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
          {showContent && (
            <div className="px-4 pb-4 text-sm text-gray-800 leading-8 border-t border-gray-50 pt-3 whitespace-pre-wrap">
              {text.content}
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <Link href={`/texts/import?id=${id}`}>
        <div className="mb-4 bg-indigo-50 border border-indigo-200 rounded-2xl px-4 py-3 flex items-center justify-between active:opacity-80">
          <span className="text-sm font-medium text-indigo-800">导入 Word 文档</span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4 text-indigo-400">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </Link>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-gray-100 rounded-xl p-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === t.key ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"
            }`}
          >
            {t.label}
            <span className="ml-1 text-xs opacity-60">({t.count})</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {tab === "annotations" && (
        <>
          {annotations.length > 0 && (
            <div className="flex justify-end mb-2">
              <button
                onClick={async () => {
                  if (!confirm(`清空《${text.title}》全部 ${annotations.length} 条注释？此操作不可撤销。`)) return
                  await clearAnnotationsForText(id)
                  setAnnotations([])
                  setText((prev) => prev ? { ...prev, annotationCount: 0 } : prev)
                }}
                className="text-xs text-red-400 border border-red-200 px-3 py-1.5 rounded-lg active:bg-red-50"
              >
                清空全部注释
              </button>
            </div>
          )}
          <AnnotationList annotations={annotations} textId={id} />
        </>
      )}
      {tab === "sentences" && (
        <>
          {sentences.length > 0 && (
            <div className="flex justify-end mb-2">
              <button
                onClick={async () => {
                  if (!confirm(`清空《${text.title}》全部 ${sentences.length} 条翻译题？`)) return
                  await clearSentencesForText(id)
                  setSentences([])
                  setText((prev) => prev ? { ...prev, sentenceCount: 0 } : prev)
                }}
                className="text-xs text-red-400 border border-red-200 px-3 py-1.5 rounded-lg active:bg-red-50"
              >
                清空全部翻译题
              </button>
            </div>
          )}
          <SentenceList sentences={sentences} />
        </>
      )}
      {tab === "recitations" && (
        <>
          <div className="flex justify-between items-center mb-2">
            <button
              onClick={() => { setShowRecitationImport((v) => !v); setRecitationJsonDraft("") }}
              className="text-xs text-indigo-600 border border-indigo-200 bg-indigo-50 px-3 py-1.5 rounded-lg active:opacity-80"
            >
              {showRecitationImport ? "取消导入" : "+ 导入默写题 JSON"}
            </button>
            {recitations.length > 0 && (
              <button
                onClick={async () => {
                  if (!confirm(`清空《${text.title}》全部 ${recitations.length} 条默写题？`)) return
                  await clearRecitationsForText(id)
                  setRecitations([])
                  setText((prev) => prev ? { ...prev, recitationCount: 0 } : prev)
                }}
                className="text-xs text-red-400 border border-red-200 px-3 py-1.5 rounded-lg active:bg-red-50"
              >
                清空全部默写题
              </button>
            )}
          </div>
          {showRecitationImport && (
            <div className="mb-4 bg-white rounded-2xl border border-indigo-200 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-50">
                <div className="text-sm font-medium text-gray-700 mb-0.5">粘贴默写题 JSON</div>
                <div className="text-xs text-gray-400">格式：{"{ \"recitations\": [{\"prompt\":\"...\",\"answer\":\"...\",\"answerLines\":[...],\"source\":\"...\"}] }"}</div>
              </div>
              <textarea
                value={recitationJsonDraft}
                onChange={(e) => setRecitationJsonDraft(e.target.value)}
                placeholder='粘贴 JSON…'
                rows={8}
                className="w-full px-4 py-3 text-xs text-gray-800 outline-none bg-transparent resize-none placeholder-gray-300 font-mono leading-5"
              />
              <div className="px-4 pb-3">
                <button
                  onClick={importRecitationsFromJson}
                  disabled={!recitationJsonDraft.trim() || importingRecitation}
                  className="w-full bg-indigo-700 text-white py-2.5 rounded-xl text-sm font-semibold disabled:opacity-40"
                >
                  {importingRecitation ? "导入中…" : "导入默写题"}
                </button>
              </div>
            </div>
          )}
          <RecitationList recitations={recitations} />
        </>
      )}
      {tab === "analysis" && (
        <div className="space-y-4">
          {/* Translation section */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3">
              <button
                className="flex-1 flex items-center justify-between"
                onClick={() => {
                  if (!editingTranslation) setTranslationDraft(text?.translation || "")
                  setEditingTranslation(v => !v)
                }}
              >
                <span className="text-sm font-medium text-gray-700">全文翻译</span>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
                  className={`w-4 h-4 text-gray-400 transition-transform ${editingTranslation ? "rotate-90" : ""}`}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
              {text?.translation && !editingTranslation && (
                <button
                  onClick={async () => {
                    if (!confirm("确定清空全文翻译？")) return
                    await updateTextTranslation(id, { translation: "" })
                    setText(prev => prev ? { ...prev, translation: "" } : prev)
                  }}
                  className="text-xs text-red-400 border border-red-200 px-2 py-1 rounded ml-2"
                >
                  清空
                </button>
              )}
            </div>
            {editingTranslation && (
              <div className="px-4 pb-4 border-t border-gray-50 pt-3">
                <textarea
                  value={translationDraft}
                  onChange={(e) => setTranslationDraft(e.target.value)}
                  placeholder="输入全文现代汉语翻译…"
                  rows={6}
                  className="w-full px-3 py-2 text-sm text-gray-800 outline-none bg-gray-50 rounded-lg resize-none placeholder-gray-300"
                />
              </div>
            )}
            {!editingTranslation && text?.translation && (
              <div className="px-4 pb-4 text-sm text-gray-700 leading-7 border-t border-gray-50 pt-3 prose prose-sm max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{text.translation}</ReactMarkdown>
              </div>
            )}
          </div>

          {/* Appreciation section */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3">
              <button
                className="flex-1 flex items-center justify-between"
                onClick={() => {
                  if (!editingAppreciation) setAppreciationDraft(text?.appreciation || "")
                  setEditingAppreciation(v => !v)
                }}
              >
                <span className="text-sm font-medium text-gray-700">全文赏析</span>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
                  className={`w-4 h-4 text-gray-400 transition-transform ${editingAppreciation ? "rotate-90" : ""}`}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
              {text?.appreciation && !editingAppreciation && (
                <button
                  onClick={async () => {
                    if (!confirm("确定清空全文赏析？")) return
                    await updateTextTranslation(id, { appreciation: "" })
                    setText(prev => prev ? { ...prev, appreciation: "" } : prev)
                  }}
                  className="text-xs text-red-400 border border-red-200 px-2 py-1 rounded ml-2"
                >
                  清空
                </button>
              )}
            </div>
            {editingAppreciation && (
              <div className="px-4 pb-4 border-t border-gray-50 pt-3">
                <textarea
                  value={appreciationDraft}
                  onChange={(e) => setAppreciationDraft(e.target.value)}
                  placeholder="输入文学赏析内容…"
                  rows={6}
                  className="w-full px-3 py-2 text-sm text-gray-800 outline-none bg-gray-50 rounded-lg resize-none placeholder-gray-300"
                />
              </div>
            )}
            {!editingAppreciation && text?.appreciation && (
              <div className="px-4 pb-4 text-sm text-gray-700 leading-7 border-t border-gray-50 pt-3 prose prose-sm max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{text.appreciation}</ReactMarkdown>
              </div>
            )}
          </div>

          {/* Save button */}
          {(editingTranslation || editingAppreciation) && (
            <button
              onClick={saveAnalysis}
              disabled={savingAnalysis}
              className="w-full bg-indigo-700 text-white py-3 rounded-xl text-sm font-semibold disabled:opacity-40"
            >
              {savingAnalysis ? "保存中…" : "保存翻译和赏析"}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function AnnotationList({ annotations, textId }: { annotations: Annotation[]; textId: string }) {
  if (annotations.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        <div className="text-3xl mb-2">📝</div>
        <div>暂无注释，导入 Word 文档开始学习</div>
      </div>
    )
  }
  return (
    <div className="space-y-2">
      {annotations.map((a) => (
        <div key={a.id} className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3">
          <div className="flex items-start gap-2 mb-1">
            <span className="font-semibold text-gray-900">{a.word}</span>
            {a.pinyin && <span className="text-xs text-gray-400">{a.pinyin}</span>}
            {a.isHsfWord && <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">★高频</span>}
            <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded ml-auto">
              {ANNOTATION_CATEGORY_LABELS[a.category]}
            </span>
          </div>
          <div className="text-xs text-gray-500 mb-1">"{a.context}"</div>
          <div className="text-sm text-gray-800">{a.answer}</div>
        </div>
      ))}
    </div>
  )
}

function SentenceList({ sentences }: { sentences: Sentence[] }) {
  if (sentences.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        <div className="text-3xl mb-2">📖</div>
        <div>暂无翻译题</div>
      </div>
    )
  }
  const DIFF_LABELS = { 1: "直译", 2: "含活用", 3: "长难句" }
  const DIFF_COLORS = { 1: "bg-green-100 text-green-700", 2: "bg-amber-100 text-amber-700", 3: "bg-red-100 text-red-700" }
  return (
    <div className="space-y-2">
      {sentences.map((s) => (
        <div key={s.id} className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3">
          <div className="flex items-center gap-2 mb-2">
            <span className={`text-xs px-1.5 py-0.5 rounded ${DIFF_COLORS[s.difficulty]}`}>
              {DIFF_LABELS[s.difficulty]}
            </span>
          </div>
          <div className="text-sm font-medium text-gray-900 mb-1">{s.original}</div>
          <div className="text-sm text-gray-500">{s.translation}</div>
          {s.keyPoints.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {s.keyPoints.map((kp, i) => (
                <span key={i} className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded">{kp}</span>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function RecitationList({ recitations }: { recitations: RecitationQuestion[] }) {
  if (recitations.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        <div className="text-3xl mb-2">✍️</div>
        <div>暂无默写题</div>
      </div>
    )
  }
  return (
    <div className="space-y-2">
      {recitations.map((r) => (
        <div key={r.id} className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{r.source}</span>
          </div>
          <div className="text-sm text-gray-600 mb-2">{r.prompt}</div>
          <div className="text-sm font-medium text-gray-900">{r.answer}</div>
        </div>
      ))}
    </div>
  )
}
