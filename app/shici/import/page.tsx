import Link from 'next/link'
import ShiciImport from '@/components/shici/ShiciImport'

export default function ShiciImportPage() {
  return (
    <div className="max-w-xl mx-auto px-4 pt-4 pb-24">
      <Link href="/shici" className="text-sm text-gray-500">← 实词列表</Link>
      <h1 className="text-xl font-bold mt-4 mb-6">导入实词数据</h1>

      <ShiciImport />

      <div className="mt-6 bg-blue-50 border border-blue-100 rounded-xl px-4 py-4 text-sm text-blue-800 leading-relaxed">
        <p className="font-medium mb-2">导入说明</p>
        <ol className="list-decimal list-inside space-y-1 text-xs">
          <li>在 Claude.ai 上传实词 PDF</li>
          <li>Claude 返回 JSON 数组，复制并保存为 .json 文件</li>
          <li>点击上方按钮上传 .json 文件</li>
          <li>已导入的实词再次上传会自动覆盖，不会重复</li>
        </ol>
      </div>
    </div>
  )
}
