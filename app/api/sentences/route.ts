import { NextRequest, NextResponse } from "next/server"
import { getSentences } from "@/lib/db"

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const textId = searchParams.get("textId")
  const difficulty = searchParams.get("difficulty")
  try {
    const sentences = await getSentences(
      textId || undefined,
      difficulty ? Number(difficulty) : undefined
    )
    return NextResponse.json(sentences)
  } catch {
    return NextResponse.json([], { status: 500 })
  }
}
