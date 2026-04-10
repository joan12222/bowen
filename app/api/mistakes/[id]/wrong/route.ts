import { NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"
import { getNextReviewDate } from "@/lib/constants"

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const body = await req.json().catch(() => ({}))
    const { data: existing } = await supabase.from("mistakes").select("review_count").eq("id", id).single()
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })
    const newCount = (existing.review_count as number) + 1
    const nextReview = getNextReviewDate(newCount)
    await supabase.from("mistakes").update({
      review_count: newCount,
      next_review_at: nextReview.toISOString(),
      user_answer: body.userAnswer || "",
    }).eq("id", id)
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 })
  }
}
