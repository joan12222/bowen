import { readFileSync } from "fs"
import { fileURLToPath } from "url"
import { dirname, join } from "path"

const __dirname = dirname(fileURLToPath(import.meta.url))

const SUPABASE_URL = "https://xjkpobwewbwrfgsqcbzd.supabase.co"
const SUPABASE_KEY = "sb_publishable_LSm0e5wGbqiG1jeiVZSBGQ_SKGvfUK4"

const FILES = [
  "zilu-zengxi-rangyou-gongxihua.json",
  "dengyueyanlou.json",
  "guizhi-jinling.json",
  "niannujiao-guodonting.json",
]

async function supabaseFetch(path, options = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...options.headers,
    },
  })
  const text = await res.text()
  return { ok: res.ok, status: res.status, data: text ? JSON.parse(text) : null }
}

for (const file of FILES) {
  const filePath = join(__dirname, "../data/recitations", file)
  const { title, recitations } = JSON.parse(readFileSync(filePath, "utf8"))

  // 查找 text_id
  const { ok, data: texts } = await supabaseFetch(
    `/texts?select=id,title&title=eq.${encodeURIComponent(title)}`
  )
  if (!ok || !texts?.length) {
    console.error(`[跳过] 未找到篇目：${title}`)
    continue
  }
  const textId = texts[0].id
  console.log(`[${title}] id=${textId}`)

  // 查已有 prompt，去重
  const { data: existing } = await supabaseFetch(
    `/recitation_questions?select=prompt&text_id=eq.${textId}`
  )
  const existingPrompts = new Set((existing || []).map((r) => r.prompt))

  const toInsert = recitations
    .filter((q) => !existingPrompts.has(q.prompt))
    .map((q) => ({
      text_id: textId,
      prompt: q.prompt,
      answer: q.answer,
      answer_lines: q.answerLines,
      source: q.source,
      is_builtin: false,
    }))

  if (toInsert.length === 0) {
    console.log(`  全部 ${recitations.length} 条已存在，跳过`)
    continue
  }

  const { ok: insOk, data: insData } = await supabaseFetch("/recitation_questions", {
    method: "POST",
    body: JSON.stringify(toInsert),
  })

  if (insOk) {
    console.log(`  新增 ${toInsert.length} 条，跳过重复 ${recitations.length - toInsert.length} 条`)
  } else {
    console.error(`  插入失败：`, insData)
  }
}
