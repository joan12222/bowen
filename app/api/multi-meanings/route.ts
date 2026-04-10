import { NextRequest, NextResponse } from "next/server"
import { getMultiMeanings } from "@/lib/db"

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const character = searchParams.get("character")
  if (!character) return NextResponse.json([])
  try {
    const items = await getMultiMeanings(character)
    return NextResponse.json(items)
  } catch {
    return NextResponse.json([], { status: 500 })
  }
}
