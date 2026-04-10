import { NextResponse } from "next/server"
import { getTodayReviewCount } from "@/lib/db"

export async function GET() {
  try {
    const count = await getTodayReviewCount()
    return NextResponse.json({ count })
  } catch {
    return NextResponse.json({ count: 0 })
  }
}
