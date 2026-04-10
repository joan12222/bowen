import { NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"
import { parseParas } from "@/lib/parse-annotations"

// eslint-disable-next-line @typescript-eslint/no-require-imports
const AdmZip = require("adm-zip")

// ─── XML paragraph extraction ────────────────────────────────────────────────

function extractParagraphs(buffer: Buffer): string[] {
  const zip = new AdmZip(buffer)
  const xml: string = zip.readAsText("word/document.xml")
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

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const formData = await req.formData()
    const file = formData.get("file") as File | null
    if (!file) return NextResponse.json({ error: "未选择文件" }, { status: 400 })
    if (!file.name.endsWith(".docx")) return NextResponse.json({ error: "请上传 .docx 格式文件" }, { status: 400 })

    const buffer = Buffer.from(await file.arrayBuffer())
    const paras = extractParagraphs(buffer)
    const { content, annotations } = parseParas(paras)

    const { error: contentErr } = await supabase.from("texts").update({ content }).eq("id", id)
    if (contentErr) throw contentErr

    await supabase.from("annotations").delete().eq("text_id", id)

    if (annotations.length > 0) {
      const rows = annotations.map((a) => ({
        text_id: id,
        word: a.word,
        pinyin: a.pinyin,
        context: a.context,
        answer: a.answer,
        loose: a.loose,
        category: a.category,
        is_hsf_word: a.isHsfWord,
        is_builtin: false,
      }))
      const { error: annErr } = await supabase.from("annotations").insert(rows)
      if (annErr) throw annErr
    }

    return NextResponse.json({ success: annotations.length, content: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : "解析失败"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
