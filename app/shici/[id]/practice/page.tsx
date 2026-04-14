import Link from 'next/link'
import { getShiciDetail } from '@/lib/shici'
import PracticeCard from '@/components/shici/PracticeCard'

export default async function ShiciPracticePage({ params }: { params: Promise<{ id: string }> }) {
  const { id: idStr } = await params
  const id = Number(idStr)
  const { word, senses } = await getShiciDetail(id)

  if (!word) {
    return (
      <div className="max-w-xl mx-auto p-4">
        <Link href="/shici" className="text-sm text-gray-500">← 实词列表</Link>
        <p className="mt-8 text-center text-gray-400">未找到该实词</p>
      </div>
    )
  }

  return (
    <div className="pb-24">
      <div className="flex items-center justify-between px-4 pt-4 mb-2">
        <Link href={`/shici/${id}`} className="text-sm text-gray-500">← {word.word}</Link>
        <Link href="/shici/practice" className="text-xs text-gray-500 bg-gray-100 px-3 py-1.5 rounded-lg active:opacity-80">
          随机练习
        </Link>
      </div>
      <PracticeCard word={word} senses={senses} />
    </div>
  )
}
