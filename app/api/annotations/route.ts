import { NextRequest, NextResponse } from "next/server"
import { getAllAnnotations, createAnnotation } from "@/lib/db"
import { AnnotationCategory } from "@/lib/types"
import { HSF_WORDS } from "@/lib/constants"

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const textIds = searchParams.getAll("textId")
  const category = searchParams.get("category") as AnnotationCategory | null
  const hsfOnly = searchParams.get("hsfOnly") === "true"
  try {
    const annotations = await getAllAnnotations({
      textIds: textIds.length > 0 ? textIds : undefined,
      category: category || undefined,
      hsfOnly,
    })
    return NextResponse.json(annotations)
  } catch {
    return NextResponse.json([], { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const ann = await createAnnotation({
      textId: body.textId,
      word: body.word,
      pinyin: body.pinyin || "",
      context: body.context,
      answer: body.answer,
      loose: body.loose || [],
      category: body.category,
      isHsfWord: body.isHsfWord ?? HSF_WORDS.includes(body.word),
      isBuiltin: false,
    })
    return NextResponse.json(ann)
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 })
  }
}
