"use client"

import { useState, use, useRef, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"

type FileType = "docx" | "pdf" | "images" | null
type TaskStatus = "pending" | "processing" | "completed" | "failed" | null

export default function ImportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [files, setFiles] = useState<File[]>([])
  const [fileType, setFileType] = useState<FileType>(null)
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState("")
  const [error, setError] = useState("")
  const [taskId, setTaskId] = useState<string | null>(null)
  const [taskStatus, setTaskStatus] = useState<TaskStatus>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const fs = Array.from(e.target.files || [])
    setFiles(fs)
    setError("")
    setProgress("")
    setTaskId(null)
    setTaskStatus(null)
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current)
      pollIntervalRef.current = null
    }
    if (fs.length === 0) { setFileType(null); return }
    const firstName = fs[0].name
    if (firstName.endsWith(".docx")) setFileType("docx")
    else if (firstName.endsWith(".pdf")) setFileType("pdf")
    else if (/\.(jpg|jpeg|png|webp)$/i.test(firstName)) setFileType("images")
    else setFileType(null)
  }

  async function pollTaskStatus(taskId: string) {
    try {
      const res = await fetch(`/api/tasks/${taskId}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "查询任务失败")
      setTaskStatus(data.status)
      if (data.status === "processing") {
        setProgress("Claude Code 正在识别内容…")
      } else if (data.status === "completed") {
        setProgress("识别完成！")
      } else if (data.status === "failed") {
        setProgress(data.error || "处理失败")
      }
      if (data.status === "completed" || data.status === "failed") {
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current)
          pollIntervalRef.current = null
        }
        if (data.status === "completed") {
          ;["text", "ann", "sent", "rec"].forEach(k => localStorage.removeItem(`${k}_${id}`))
          setTimeout(() => router.push(`/texts/${id}/read`), 800)
        } else {
          setLoading(false)
        }
      }
    } catch {
      // ignore polling errors
    }
  }

  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current)
    }
  }, [])

  async function handleParse() {
    if (files.length === 0 || !fileType) return
    setLoading(true)
    setError("")
    setProgress("")
    setTaskId(null)
    setTaskStatus(null)
    try {
      if (fileType === "docx") {
        const form = new FormData()
        form.append("file", files[0])
        const res = await fetch(`/api/texts/${id}/parse-docx`, { method: "POST", body: form })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || "解析失败")
        ;["text", "ann", "sent", "rec"].forEach(k => localStorage.removeItem(`${k}_${id}`))
        router.push(`/texts/${id}/read`)
      } else {
        // PDF 或图片 → 保存到磁盘 + 创建 wenyan 任务
        setProgress("上传文件…")
        const form = new FormData()
        if (fileType === "pdf") {
          form.append("file", files[0])
        } else {
          for (const file of files) form.append("images", file)
        }
        const res = await fetch(`/api/texts/${id}/save-upload`, { method: "POST", body: form })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || "上传失败")

        setTaskId(data.task_id)
        setTaskStatus("pending")
        setProgress("等待 Claude Code 处理…")
        pollIntervalRef.current = setInterval(() => pollTaskStatus(data.task_id), 3000)
      }
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
        <Link href={`/texts/${id}`} className="text-gray-500">
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
          accept=".docx,.pdf,.jpg,.jpeg,.png,.webp"
          multiple
          className="hidden"
          onChange={handleFileChange}
        />
        {files.length > 0 ? (
          <>
            <div className="text-4xl mb-3">{fileType === "images" ? "🖼️" : fileType === "pdf" ? "📄" : "📝"}</div>
            <div className="font-semibold text-gray-900 text-base">
              {fileType === "images" ? files.length + " 张图片" : files[0].name}
              {fileType === "images" && files.length > 1 ? "（按顺序）" : ""}
            </div>
            <div className="text-sm text-gray-400 mt-1">
              {fileType === "images"
                ? files.map(f => f.name).join(", ")
                : (files[0].size / 1024).toFixed(0) + " KB"
              }
            </div>
            {!loading && <div className="text-xs text-amber-600 mt-3">点击重新选择</div>}
          </>
        ) : (
          <>
            <div className="text-4xl mb-3">📂</div>
            <div className="font-medium text-gray-700">点击选择文件</div>
            <div className="text-sm text-gray-400 mt-1">支持 .docx、.pdf 或图片（.jpg/.png）</div>
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
        <div className="bg-blue-50 rounded-2xl px-4 py-4">
          <div className="text-xs font-semibold text-blue-500 mb-2 uppercase tracking-wide">扫描件 / PDF 说明</div>
          <div className="text-xs text-blue-600 space-y-1.5 leading-5">
            <div>由 Claude Code 视觉识别，自动提取原文与注释</div>
            <div>需保持 Claude Code 对话处于运行状态</div>
            <div>上传后约 15 秒内自动完成处理</div>
            <div>建议扫描分辨率 ≥ 150 DPI，清晰度影响准确率</div>
          </div>
        </div>
      </div>
    </div>
  )
}
