// One-time export of all builtin content from Supabase to JSON, before the
// migration to local-first SQLite cuts off Supabase access (see the plan in
// C:\Users\joan\.claude\plans\bowen-supabase-rustling-frost.md). These JSON
// files become the seed data for first-launch local DB initialization.
//
// Usage: node scripts/export-builtin-data.mjs

import { writeFileSync, mkdirSync } from "fs"
import { fileURLToPath } from "url"
import { dirname, join } from "path"

const __dirname = dirname(fileURLToPath(import.meta.url))
// Lives in public/ so the worker can `fetch()` it as a static asset at
// runtime (see lib/sqlite/seed.ts) instead of bundling ~2.6MB of JSON into
// the worker's JS chunk.
const SEED_DIR = join(__dirname, "../public/seed")

const SUPABASE_URL = "https://xjkpobwewbwrfgsqcbzd.supabase.co"
const SUPABASE_KEY = "sb_publishable_LSm0e5wGbqiG1jeiVZSBGQ_SKGvfUK4"

const PAGE_SIZE = 1000

// Supabase REST paginates via the Range header (max 1000 rows per request).
// Loop until a page comes back smaller than PAGE_SIZE.
async function fetchAll(table, query) {
  const rows = []
  let offset = 0
  for (;;) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        Range: `${offset}-${offset + PAGE_SIZE - 1}`,
      },
    })
    if (!res.ok) {
      throw new Error(`${table} fetch failed: ${res.status} ${await res.text()}`)
    }
    const page = await res.json()
    rows.push(...page)
    if (page.length < PAGE_SIZE) break
    offset += PAGE_SIZE
  }
  return rows
}

async function main() {
  mkdirSync(SEED_DIR, { recursive: true })

  console.log("Fetching builtin texts...")
  const texts = await fetchAll("texts", "is_builtin=eq.true&order=volume_id,text_order")
  const textIds = texts.map((t) => t.id)
  console.log(`  ${texts.length} texts`)

  // IMPORTANT: in production, `is_builtin` on annotations/sentences/
  // recitation_questions/multi_meanings is always `false` (verified by probing
  // counts directly — the flag is apparently never set on child rows, only on
  // `texts`). The reliable way to scope "builtin content" for these tables is
  // by `text_id IN (<builtin text ids>)`, not by their own `is_builtin` column.
  const inFilter = `text_id=in.(${textIds.join(",")})`

  console.log("Fetching annotations for builtin texts...")
  const annotations = await fetchAll("annotations", `${inFilter}&order=text_id`)
  console.log(`  ${annotations.length} annotations`)

  console.log("Fetching sentences for builtin texts...")
  const sentences = await fetchAll("sentences", `${inFilter}&order=text_id`)
  console.log(`  ${sentences.length} sentences`)

  console.log("Fetching recitation questions for builtin texts...")
  const recitationQuestions = await fetchAll("recitation_questions", `${inFilter}&order=text_id`)
  console.log(`  ${recitationQuestions.length} recitation questions`)

  console.log("Fetching multi-meanings for builtin texts...")
  const multiMeanings = await fetchAll("multi_meanings", `${inFilter}&order=character`)
  console.log(`  ${multiMeanings.length} multi-meanings`)

  const builtinContent = { texts, annotations, sentences, recitationQuestions, multiMeanings }
  writeFileSync(join(SEED_DIR, "builtin-content.json"), JSON.stringify(builtinContent, null, 2))
  console.log(`Wrote lib/seed/builtin-content.json`)

  console.log("\nFetching shici cards...")
  const poemCards = await fetchAll("poem_cards", "order=id")
  console.log(`  ${poemCards.length} poem cards`)

  console.log("Fetching shici words...")
  const shiciWords = await fetchAll("shici_words", "order=id")
  console.log(`  ${shiciWords.length} shici words`)

  console.log("Fetching shici senses...")
  const shiciSenses = await fetchAll("shici_senses", "order=word_id,sense_order")
  console.log(`  ${shiciSenses.length} shici senses`)

  const shiciSeed = { poemCards, shiciWords, shiciSenses }
  writeFileSync(join(SEED_DIR, "shici-seed.json"), JSON.stringify(shiciSeed, null, 2))
  console.log(`Wrote lib/seed/shici-seed.json`)

  console.log("\nDone.")
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
