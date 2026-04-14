import Link from 'next/link'
import { getShiciList } from '@/lib/shici'

export default async function ShiciListPage() {
  const words = await getShiciList()

  return (
    <div className="max-w-4xl mx-auto px-4 pt-4 pb-24">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold">实词 300</h1>
        <div className="flex gap-2">
          <Link
            href="/shici/import"
            className="text-xs text-gray-500 bg-gray-100 px-3 py-1.5 rounded-lg active:opacity-80"
          >
            导入
          </Link>
          <Link
            href="/shici/practice"
            className="text-xs bg-red-700 text-white px-3 py-1.5 rounded-lg active:opacity-80"
          >
            随机练习
          </Link>
        </div>
      </div>

      {words.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="mb-3">暂无实词数据</p>
          <Link href="/shici/import" className="text-sm text-red-700">前往导入 →</Link>
        </div>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
          {words.map(w => (
            <Link
              key={w.id}
              href={`/shici/${w.id}`}
              className="flex flex-col items-center p-3 rounded-xl border border-gray-200 hover:border-red-400 hover:bg-red-50 active:opacity-80 transition-colors"
            >
              <span className="text-xs text-gray-400">{w.id}</span>
              <span className="text-2xl font-serif my-1">{w.word}</span>
              <span className="text-xs text-gray-500">{w.pinyin}</span>
              <span className="text-xs text-gray-400 text-center mt-1 line-clamp-1">{w.base_meaning}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
