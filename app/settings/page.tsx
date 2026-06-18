"use client"

import { useRef, useState } from "react"
import Link from "next/link"
import { exportAllData, importAllData, type DataBackup } from "@/lib/db.local"

export default function SettingsPage() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [exporting, setExporting] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  async function handleExport() {
    setMessage(null)
    setExporting(true)
    try {
      const backup = await exportAllData()
      const json = JSON.stringify(backup, null, 2)
      const blob = new Blob([json], { type: "application/json" })
      const url = URL.createObjectURL(blob)
      const date = new Date().toISOString().slice(0, 10)
      const a = document.createElement("a")
      a.href = url
      a.download = `bowen-backup-${date}.json`
      a.click()
      URL.revokeObjectURL(url)
      setMessage({ type: "success", text: "导出成功，已开始下载备份文件" })
    } catch (err) {
      setMessage({ type: "error", text: `导出失败：${err instanceof Error ? err.message : "未知错误"}` })
    }
    setExporting(false)
  }

  function handleRestoreClick() {
    setMessage(null)
    fileInputRef.current?.click()
  }

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return

    setMessage(null)
    try {
      const text = await file.text()
      const backup = JSON.parse(text) as DataBackup
      if (!backup || typeof backup !== "object" || !backup.tables) {
        throw new Error("备份文件格式不正确")
      }

      const ok = confirm(
        "从备份恢复将清空当前所有数据（包括篇目、错题本、诗词数据等），并用备份文件中的内容整体覆盖。\n\n此操作不可撤销，确定要继续吗？"
      )
      if (!ok) return

      setRestoring(true)
      await importAllData(backup)
      setMessage({ type: "success", text: "恢复成功，建议刷新页面以查看最新数据" })
    } catch (err) {
      setMessage({ type: "error", text: `恢复失败：${err instanceof Error ? err.message : "文件格式不正确"}` })
    }
    setRestoring(false)
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/" className="text-gray-500">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <h1 className="text-xl font-bold text-gray-900">设置 / 数据备份</h1>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-6 text-sm text-amber-800 leading-6">
        博文的数据完全保存在本机浏览器中，不会上传到任何服务器。手机存储空间紧张时，浏览器有可能清空本地数据——
        建议定期导出备份文件保存到云盘或电脑，以防数据丢失。
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-4">
        <div className="font-semibold text-gray-900 mb-1">导出全部数据</div>
        <div className="text-sm text-gray-500 mb-3">
          将篇目、注释、句子翻译、默写题、错题本、诗词数据等全部内容打包为一个 JSON 文件并下载。
        </div>
        <button
          onClick={handleExport}
          disabled={exporting}
          className="w-full bg-red-700 text-white py-3 rounded-2xl font-semibold active:opacity-80 disabled:opacity-50"
        >
          {exporting ? "正在导出…" : "导出全部数据"}
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-4">
        <div className="font-semibold text-gray-900 mb-1">从备份恢复</div>
        <div className="text-sm text-gray-500 mb-3">
          选择此前导出的备份 JSON 文件，将<span className="font-medium text-red-600">覆盖</span>当前所有本地数据。
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={handleFileSelected}
        />
        <button
          onClick={handleRestoreClick}
          disabled={restoring}
          className="w-full border-2 border-red-200 text-red-700 py-3 rounded-2xl font-semibold active:bg-red-50 disabled:opacity-50"
        >
          {restoring ? "正在恢复…" : "从备份恢复"}
        </button>
      </div>

      {message && (
        <div
          className={`rounded-2xl p-4 text-sm ${
            message.type === "success"
              ? "bg-emerald-50 border border-emerald-200 text-emerald-700"
              : "bg-red-50 border border-red-200 text-red-700"
          }`}
        >
          {message.text}
        </div>
      )}
    </div>
  )
}
