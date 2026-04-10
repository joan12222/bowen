import { NextRequest, NextResponse } from "next/server"
import { importAnnotations, importSentences, importRecitationQuestions } from "@/lib/db"
import { supabase } from "@/lib/supabase"
import { HSF_WORDS } from "@/lib/constants"
import { AnnotationCategory } from "@/lib/types"

function parseAnnotations(raw: Record<string, unknown>[]) {
  return raw.map((a) => ({
    word: a.word as string,
    pinyin: (a.pinyin as string) || "",
    context: a.context as string,
    answer: a.answer as string,
    loose: (a.loose as string[]) || [],
    category: a.category as AnnotationCategory,
    isHsfWord: typeof a.isHsfWord === "boolean" ? a.isHsfWord : HSF_WORDS.includes(a.word as string),
    isBuiltin: false,
  }))
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const { type, data } = await req.json()

    // Full import: content + annotations from one JSON
    if (type === "full") {
      let contentSaved = false
      if (typeof data.content === "string" && data.content.trim()) {
        const { error } = await supabase.from("texts").update({ content: data.content.trim() }).eq("id", id)
        if (!error) contentSaved = true
      }
      const annotations = parseAnnotations(data.annotations || [])
      const result = await importAnnotations(id, annotations)
      return NextResponse.json({ ...result, contentSaved })
    }

    if (type === "annotations") {
      const annotations = parseAnnotations(data.annotations || [])
      const result = await importAnnotations(id, annotations)
      return NextResponse.json(result)
    }

    if (type === "sentences") {
      const sentences = (data.sentences || []).map((s: Record<string, unknown>) => ({
        original: s.original as string,
        translation: s.translation as string,
        keyPoints: (s.keyPoints as string[]) || [],
        difficulty: (s.difficulty as number) || 1,
        isBuiltin: false,
      }))
      const result = await importSentences(id, sentences)
      return NextResponse.json(result)
    }

    if (type === "recitations") {
      const questions = (data.recitations || []).map((q: Record<string, unknown>) => ({
        prompt: q.prompt as string,
        answer: q.answer as string,
        answerLines: (q.answerLines as string[]) || [q.answer as string],
        source: (q.source as string) || "模拟题",
        isBuiltin: false,
      }))
      const result = await importRecitationQuestions(id, questions)
      return NextResponse.json(result)
    }

    return NextResponse.json({ error: "Unknown type" }, { status: 400 })
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Import failed"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
