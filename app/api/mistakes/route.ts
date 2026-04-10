import { NextRequest, NextResponse } from "next/server"
import { getMistakes, addMistake } from "@/lib/db"
import { Mistake } from "@/lib/types"

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const questionType = searchParams.get("questionType") as Mistake["questionType"] | null
  const isMastered = searchParams.get("isMastered")
  try {
    const mistakes = await getMistakes({
      questionType: questionType || undefined,
      isMastered: isMastered === "true" ? true : isMastered === "false" ? false : undefined,
    })
    return NextResponse.json(mistakes)
  } catch {
    return NextResponse.json([], { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const mistake = await addMistake({
      questionType: body.questionType,
      referenceId: body.referenceId,
      userAnswer: body.userAnswer,
      correctAnswer: body.correctAnswer,
    })
    return NextResponse.json(mistake)
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 })
  }
}
