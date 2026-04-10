import { NextRequest, NextResponse } from "next/server"
import { getRecitationQuestions } from "@/lib/db"

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const textId = searchParams.get("textId")
  // source filter is done client side for now
  try {
    const questions = await getRecitationQuestions(textId || undefined)
    return NextResponse.json(questions)
  } catch {
    return NextResponse.json([], { status: 500 })
  }
}
