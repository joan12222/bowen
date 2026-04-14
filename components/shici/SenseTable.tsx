export default function SenseTable({ senses, word }: { senses: any[], word: string }) {
  if (senses.length === 0) {
    return <p className="text-sm text-gray-400">暂无义项数据</p>
  }

  return (
    <table className="w-full text-sm border-collapse" suppressHydrationWarning>
      <thead>
        <tr className="bg-gray-50">
          <th className="border border-gray-200 px-3 py-2 text-left w-16 font-medium text-gray-600">词性</th>
          <th className="border border-gray-200 px-3 py-2 text-left w-20 font-medium text-gray-600">词义</th>
          <th className="border border-gray-200 px-3 py-2 text-left font-medium text-gray-600">例句</th>
          <th className="border border-gray-200 px-3 py-2 text-left font-medium text-gray-600">句意</th>
        </tr>
      </thead>
      <tbody>
        {senses.map((sense) =>
          (sense.examples as any[]).map((ex, ei) => (
            <tr key={`${sense.id}-${ei}`} className="hover:bg-gray-50">
              {ei === 0 && (
                <td rowSpan={sense.examples.length} className="border border-gray-200 px-3 py-2 align-top text-gray-500">
                  {sense.pos}
                </td>
              )}
              {ei === 0 && (
                <td rowSpan={sense.examples.length} className="border border-gray-200 px-3 py-2 align-top font-medium">
                  {sense.meaning}
                </td>
              )}
              <td className="border border-gray-200 px-3 py-2">
                <div className="leading-relaxed">{ex.sentence}</div>
                <div className="text-gray-400 text-xs mt-0.5">{ex.source}</div>
              </td>
              <td className="border border-gray-200 px-3 py-2 text-gray-600 leading-relaxed">{ex.translation}</td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  )
}
