import { NextResponse } from "next/server"
import { getTodayReviewQueue } from "@/lib/db"

export async function GET() {
  try {
    const queue = await getTodayReviewQueue()
    return NextResponse.json(queue)
  } catch {
    return NextResponse.json([], { status: 500 })
  }
}
