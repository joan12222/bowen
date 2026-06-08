import { NextRequest, NextResponse } from "next/server"
import { getTextsWithCounts, createText } from "@/lib/db"
import { VolumeId } from "@/lib/types"

export async function GET() {
  try {
    const texts = await getTextsWithCounts()
    return NextResponse.json(texts)
  } catch (error) {
    return NextResponse.json([], { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const text = await createText({
      title: body.title,
      author: body.author,
      dynasty: body.dynasty || "",
      source: body.source || "",
      volumeId: (body.volumeId || "custom") as VolumeId,
      textOrder: body.textOrder || 999,
      content: body.content || "",
      isBuiltin: false,
    })
    return NextResponse.json(text)
  } catch (error) {
    return NextResponse.json({ error: "Failed to create text" }, { status: 500 })
  }
}
