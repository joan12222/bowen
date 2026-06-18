"use client"

import { useState, useRef, Suspense } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { parseDocxFile } from "@/lib/docx-parser"
import { updateTextContent, clearAnnotationsForText, importAnnotations } from "@/lib/db.local"

type FileType = "docx" | null

export default function ImportPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64 text-gray-400">加载中…</div>}>
      <ImportPageContent />
    </Suspense>
  )
}

function ImportPageContent() {
  const id = useSearchParams().get("id") || ""
  const router = useRouter()
  const [files, setFiles] = useState<File[]>([])
  const [fileType, setFileType] = useState<FileType>(null)
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState("")
  const [error, setError] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const fs = Array.from(e.target.files || [])
    setFiles(fs)
    setError("")
    setProgress("")
    if (fs.length === 0) { setFileType(null); return }
    const firstName = fs[0].name
    setFileType(firstName.endsWith(".docx") ? "docx" : null)
  }

  async function handleParse() {
    if (files.length === 0 || !fileType) return
    setLoading(true)
    setError("")
    setProgress("解析中…")
    try {
      const { content, annotations } = await parseDocxFile(files[0])

      await updateTextContent(id, content)
      await clearAnnotationsForText(id)
      if (annotations.length > 0) {
        await importAnnotations(id, annotations.map((a) => ({ ...a, isBuiltin: false })))
      }

      router.push(`/texts/read?id=${id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : "解析失败")
      setLoading(false)
      setProgress("")
    }
  }

  const isValid = files.length > 0 && fileType !== null

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="flex items-center gap-3 mb-8">
        <Link href={`/texts/detail?id=${id}`} className="text-gray-500">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <h1 className="text-xl font-bold text-gray-900">导入文档</h1>
      </div>

      {/* Upload area */}
      <div
        onClick={() => !loading && inputRef.current?.click()}
        className={"border-2 border-dashed rounded-2xl p-10 text-center transition-colors " + (
          loading
            ? "border-gray-200 bg-gray-50 cursor-not-allowed"
            : files.length > 0
            ? "border-amber-300 bg-amber-50 cursor-pointer active:opacity-80"
            : "border-gray-200 bg-gray-50 cursor-pointer active:bg-gray-100"
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".docx"
          className="hidden"
          onChange={handleFileChange}
        />
        {files.length > 0 ? (
          <>
            <div className="text-4xl mb-3">📝</div>
            <div className="font-semibold text-gray-900 text-base">{files[0].name}</div>
            <div className="text-sm text-gray-400 mt-1">{(files[0].size / 1024).toFixed(0)} KB</div>
            {!loading && <div className="text-xs text-amber-600 mt-3">点击重新选择</div>}
          </>
        ) : (
          <>
            <div className="text-4xl mb-3">📂</div>
            <div className="font-medium text-gray-700">点击选择文件</div>
            <div className="text-sm text-gray-400 mt-1">支持 .docx 文档</div>
          </>
        )}
      </div>

      {/* Progress */}
      {loading && progress && (
        <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-700">
          {progress}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mt-4 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Parse button */}
      <button
        onClick={handleParse}
        disabled={!isValid || loading}
        className="mt-4 w-full bg-red-700 text-white py-3.5 rounded-2xl font-semibold active:opacity-80 disabled:opacity-40 transition-opacity"
      >
        {loading ? "处理中…" : "解析并导入"}
      </button>

      {/* Format hints */}
      <div className="mt-6 space-y-3">
        <div className="bg-gray-50 rounded-2xl px-4 py-4">
          <div className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">Word 文档格式</div>
          <div className="text-xs text-gray-500 space-y-1.5 leading-5">
            <div>文档需包含「原文」和「注释」两个段落标题</div>
            <div>原文中用圆圈数字（②③…）标注注释位置</div>
            <div>注释格式：② 【词语（拼音）】释义</div>
            <div>支持多节选合并（节选一、二、三…自动拼合）</div>
          </div>
        </div>
      </div>
    </div>
  )
}
