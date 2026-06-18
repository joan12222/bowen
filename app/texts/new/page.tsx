"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { VolumeId } from "@/lib/types"
import { VOLUME_LABELS } from "@/lib/constants"
import { createText } from "@/lib/db.local"

const VOLUMES = Object.entries(VOLUME_LABELS) as [VolumeId, string][]

export default function NewTextPage() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    title: "",
    author: "",
    dynasty: "",
    source: "",
    volumeId: "custom" as VolumeId,
    content: "",
  })

  function set(key: string, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title || !form.author) return
    setSaving(true)
    try {
      const text = await createText({
        title: form.title,
        author: form.author,
        dynasty: form.dynasty || "",
        source: form.source || "",
        volumeId: form.volumeId,
        textType: "wenyanwen",
        textOrder: 999,
        content: form.content || "",
        isBuiltin: false,
      })
      router.push(`/texts/detail?id=${text.id}`)
    } catch {
      alert("保存失败，请重试")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/texts" className="text-gray-500">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <h1 className="text-xl font-bold text-gray-900">新增篇目</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {[
            { key: "title", label: "篇名", placeholder: "如：齐桓晋文之事", required: true },
            { key: "author", label: "作者", placeholder: "如：孟子", required: true },
            { key: "dynasty", label: "朝代", placeholder: "如：先秦", required: false },
            { key: "source", label: "出处", placeholder: "如：《孟子·梁惠王上》", required: false },
          ].map(({ key, label, placeholder, required }, idx) => (
            <div key={key} className={`flex items-center px-4 py-3 ${idx > 0 ? "border-t border-gray-50" : ""}`}>
              <label className="w-16 text-sm text-gray-500 flex-shrink-0">
                {label}{required && <span className="text-red-500">*</span>}
              </label>
              <input
                type="text"
                value={(form as Record<string, string>)[key]}
                onChange={(e) => set(key, e.target.value)}
                placeholder={placeholder}
                required={required}
                className="flex-1 text-sm text-gray-900 outline-none placeholder-gray-300 bg-transparent"
              />
            </div>
          ))}

          <div className="border-t border-gray-50 px-4 py-3 flex items-center">
            <label className="w-16 text-sm text-gray-500 flex-shrink-0">册次</label>
            <select
              value={form.volumeId}
              onChange={(e) => set("volumeId", e.target.value)}
              className="flex-1 text-sm text-gray-900 outline-none bg-transparent"
            >
              {VOLUMES.map(([id, label]) => (
                <option key={id} value={id}>{label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
          <div className="px-4 py-3 border-b border-gray-50">
            <label className="text-sm text-gray-500">原文（选填）</label>
          </div>
          <textarea
            value={form.content}
            onChange={(e) => set("content", e.target.value)}
            placeholder="粘贴原文内容…"
            rows={6}
            className="w-full px-4 py-3 text-sm text-gray-900 outline-none bg-transparent resize-none placeholder-gray-300"
          />
        </div>

        <button
          type="submit"
          disabled={saving || !form.title || !form.author}
          className="w-full bg-red-700 text-white py-3 rounded-2xl font-semibold active:opacity-80 disabled:opacity-40"
        >
          {saving ? "保存中…" : "保存"}
        </button>
      </form>
    </div>
  )
}
