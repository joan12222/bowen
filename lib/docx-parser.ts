// Client-side replacement for the old app/api/texts/[id]/parse-docx route —
// see lib/parse-annotations.ts's parseParas() for the (unchanged) annotation
// extraction logic. Only the unzip/decode layer changes: adm-zip + Buffer
// (Node) -> fflate + TextDecoder (browser). The XML paragraph regex is
// carried over verbatim — it's already production-tested, don't "improve" it.
import { unzipSync, strFromU8 } from "fflate"
import { parseParas, type ParseResult } from "./parse-annotations"

function extractParagraphs(bytes: Uint8Array): string[] {
  const files = unzipSync(bytes, { filter: (file) => file.name === "word/document.xml" })
  const xmlBytes = files["word/document.xml"]
  if (!xmlBytes) throw new Error("不是有效的 .docx 文件（缺少 word/document.xml）")
  const xml = strFromU8(xmlBytes)

  const paras: string[] = []
  for (const m of xml.matchAll(/<w:p[ >][\s\S]*?<\/w:p>/g)) {
    const texts: string[] = []
    for (const t of m[0].matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g)) {
      texts.push(t[1])
    }
    const combined = texts
      .join("")
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
    if (combined.trim()) paras.push(combined)
  }
  return paras
}

export async function parseDocxFile(file: File): Promise<ParseResult> {
  if (!file.name.endsWith(".docx")) throw new Error("请上传 .docx 格式文件")
  const bytes = new Uint8Array(await file.arrayBuffer())
  const paras = extractParagraphs(bytes)
  return parseParas(paras)
}
