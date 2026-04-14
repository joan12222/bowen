import Link from 'next/link'
import { getRandomShiciWord } from '@/lib/shici'
import PracticeCard from '@/components/shici/PracticeCard'

export const dynamic = 'force-dynamic'

export default async function RandomPracticePage() {
  const result = await getRandomShiciWord()

  if (!result || !result.word || result.senses.length < 2) {
    return (
      <div className="max-w-xl mx-auto p-6 text-center">
        <Link href="/shici" className="text-sm text-gray-500">← 实词列表</Link>
        <p className="mt-8 text-gray-500 mb-4">暂无足够词条，请先导入实词数据。</p>
        <Link href="/shici/import" className="text-sm text-red-700">前往导入 →</Link>
      </div>
    )
  }

  return (
    <div className="pb-24">
      <div className="flex items-center justify-between px-4 pt-4 mb-2">
        <Link href="/shici" className="text-sm text-gray-500">← 实词列表</Link>
        <Link
          href="/shici/practice"
          className="text-xs text-gray-500 bg-gray-100 px-3 py-1.5 rounded-lg active:opacity-80"
        >
          换一个词
        </Link>
      </div>
      <div className="text-center mb-2">
        <span className="text-3xl font-serif">{result.word.word}</span>
        <span className="text-gray-400 text-sm ml-2">{result.word.pinyin}</span>
      </div>
      <PracticeCard word={result.word} senses={result.senses} />
    </div>
  )
}
