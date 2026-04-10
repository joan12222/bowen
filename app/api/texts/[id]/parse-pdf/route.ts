import { NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"
import { parseParas } from "@/lib/parse-annotations"

const MINIMAX_API_URL = "https://api.minimax.chat/v1/chat/completions"
const MINIMAX_MODEL = "MiniMax-VL-01"

const OCR_PROMPT = "识别这张文言文图片，输出格式如下，每行一项：\n\n" +
  "原文\n" +
  "[原文内容，保留圆圈数字标注]\n" +
  "注释\n" +
  "⑩【词语】释义\n" +
  "⑪【词语】释义\n\n" +
  "只需要输出纯文本，不要任何解释。原文和注释分开。"

async function ocrPage(base64: string, apiKey: string): Promise<string> {
  const res = await fetch(MINIMAX_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + apiKey,
    },
    body: JSON.stringify({
      model: MINIMAX_MODEL,
      max_tokens: 4096,
      messages: [{
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: { url: "data:image/jpeg;base64," + base64 },
          },
          { type: "text", text: OCR_PROMPT },
        ],
      }],
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error("MiniMax API 错误 " + res.status + ": " + err)
  }

  const data = await res.json()
  return data.choices?.[0]?.message?.content ?? ""
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const body = await req.json() as { pages: string[] }
    if (!body.pages || body.pages.length === 0) {
      return NextResponse.json({ error: "未提供页面图片" }, { status: 400 })
    }

    const apiKey = process.env.MINIMAX_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: "未配置 MINIMAX_API_KEY" }, { status: 500 })
    }

    const ocrResults: string[] = []
    for (const pageBase64 of body.pages) {
      const text = await ocrPage(pageBase64, apiKey)
      if (text.trim()) ocrResults.push(text.trim())
    }

    const fullText = ocrResults.join("\n")
    const paras = fullText.split("\n").map(l => l.trim()).filter(Boolean)
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

    return NextResponse.json({ success: annotations.length, content: true, pages: body.pages.length })
  } catch (e) {
    const msg = e instanceof Error ? e.message : "解析失败"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
