import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"
import { SEED_TEXTS } from "@/lib/seed-data"

export async function POST() {
  try {
    let created = 0
    let skipped = 0

    for (const text of SEED_TEXTS) {
      const { data: existing } = await supabase
        .from("texts")
        .select("id")
        .eq("title", text.title)
        .eq("volume_id", text.volumeId)
        .single()

      if (existing) {
        skipped++
        continue
      }

      const { error } = await supabase.from("texts").insert({
        title: text.title,
        author: text.author,
        dynasty: text.dynasty,
        source: text.source,
        volume_id: text.volumeId,
        text_type: text.textType,
        text_order: text.textOrder,
        content: text.content,
        is_builtin: text.isBuiltin,
      })

      if (!error) created++
    }

    return NextResponse.json({ success: true, created, skipped })
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Seed failed"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({ message: "POST to this endpoint to seed the database" })
}
