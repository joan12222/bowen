import { NextRequest, NextResponse } from "next/server"
import { getText, deleteText, updateTextTranslation } from "@/lib/db"

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const text = await getText(id)
    if (!text) return NextResponse.json({ error: "Not found" }, { status: 404 })
    return NextResponse.json(text)
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    await deleteText(id)
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const { translation, appreciation } = await req.json()
    await updateTextTranslation(id, { translation, appreciation })
    const updated = await getText(id)
    return NextResponse.json(updated)
  } catch {
    return NextResponse.json({ error: "Failed to update" }, { status: 500 })
  }
}
