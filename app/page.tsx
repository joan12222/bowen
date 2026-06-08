"use client"

import { useState, useEffect } from "react"
import Link from "next/link"

const drillItems = [
  { href: "/drill/annotation", label: "注释背默", desc: "字词释义练习", color: "bg-red-50 border-red-200 text-red-800" },
  { href: "/drill/translation", label: "句子翻译", desc: "句意理解自评", color: "bg-indigo-50 border-indigo-200 text-indigo-800" },
  { href: "/drill/recitation", label: "理解性默写", desc: "情境填空练习", color: "bg-emerald-50 border-emerald-200 text-emerald-800" },
  { href: "/drill/multi-meaning", label: "一词多义", desc: "跨篇义项对比", color: "bg-amber-50 border-amber-200 text-amber-800" },
]

export default function HomePage() {
  const [reviewCount, setReviewCount] = useState<number | null>(null)

  useEffect(() => {
    fetch("/api/review/today/count")
      .then((r) => r.json())
      .then((d) => setReviewCount(d.count ?? 0))
      .catch(() => setReviewCount(0))
  }, [])

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">博文</h1>
        <p className="text-sm text-gray-500 mt-1">文言文学习 · 高考备考</p>
      </div>

      {/* Today's Review */}
      {reviewCount !== null && reviewCount > 0 && (
        <Link href="/review/today">
          <div className="mb-4 bg-red-700 text-white rounded-2xl p-4 flex items-center justify-between shadow-sm active:opacity-90">
            <div>
              <div className="font-semibold">今日待复习</div>
              <div className="text-red-200 text-sm mt-0.5">艾宾浩斯复习提醒</div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-3xl font-bold">{reviewCount}</span>
              <span className="text-red-200">题</span>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5 text-red-200">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </div>
        </Link>
      )}

      {reviewCount !== null && reviewCount === 0 && (
        <div className="mb-4 bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center gap-3">
          <div className="text-emerald-600 text-2xl">✓</div>
          <div>
            <div className="font-medium text-emerald-800">今日复习已完成</div>
            <div className="text-emerald-600 text-sm">继续练习新内容吧</div>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 gap-3 mb-6">
        <Link href="/texts" className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm active:bg-gray-50">
          <div className="text-2xl font-bold text-gray-900">5</div>
          <div className="text-sm text-gray-500 mt-1">册次 · 查看篇目</div>
        </Link>
      </div>

      {/* Drill Modules */}
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">练习模块</h2>
      <div className="grid grid-cols-2 gap-3 mb-6">
        {drillItems.map((item) => (
          <Link key={item.href} href={item.href}>
            <div className={`rounded-2xl p-4 border ${item.color} active:opacity-80`}>
              <div className="font-semibold text-sm">{item.label}</div>
              <div className="text-xs mt-1 opacity-70">{item.desc}</div>
            </div>
          </Link>
        ))}
      </div>

      {/* Quick Links */}
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">快速入口</h2>
      <div className="space-y-2">
        <Link href="/texts">
          <div className="bg-white rounded-xl p-4 border border-gray-100 flex items-center justify-between active:bg-gray-50">
            <span className="text-gray-800">篇目管理 / JSON 导入</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4 text-gray-400">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </Link>
        <Link href="/review">
          <div className="bg-white rounded-xl p-4 border border-gray-100 flex items-center justify-between active:bg-gray-50">
            <span className="text-gray-800">错题本</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4 text-gray-400">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </Link>
      </div>
    </div>
  )
}
