#!/usr/bin/env node
/**
 * Import a Word (.docx) file into Bowen app.
 * Usage: node scripts/import-docx.js <textId> [<docxPath>]
 *
 * The docx must follow the format:
 *   Title / Source
 *   原文
 *   ... paragraphs with circled numbers ②③... marking annotated words ...
 *   注释
 *   ① 选自...  (source note – skipped)
 *   ② 【word（pinyin）】answer text
 *   ...
 *   (multiple 节选 sections are merged automatically)
 */

const AdmZip = require("adm-zip")
const path = require("path")
const fs = require("fs")
const https = require("https")
const http = require("http")

// ─── Config ─────────────────────────────────────────────────────────────────

const textId = process.argv[2]
if (!textId) {
  console.error("Usage: node scripts/import-docx.js <textId> [<docxPath>]")
  process.exit(1)
}
const docxPath =
  process.argv[3] || path.join(__dirname, "../齐桓晋文之事.docx")

// Load env from .env.local
const envPath = path.join(__dirname, "../.env.local")
const env = {}
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, "utf8")
    .split("\n")
    .forEach((line) => {
      const m = line.match(/^([^=]+)=(.*)$/)
      if (m) env[m[1].trim()] = m[2].trim()
    })
}

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local")
  process.exit(1)
}

// ─── Circled number helpers ──────────────────────────────────────────────────

// ①-⑳ = U+2460-U+2473,  ㉑-㉚ = U+3251-U+325A,  ㉛-㊿ = U+325B-U+3269 (rarely used)
function circledCharToNum(ch) {
  const code = ch.codePointAt(0)
  if (code >= 0x2460 && code <= 0x2473) return code - 0x2460 + 1   // ①-⑳
  if (code >= 0x3251 && code <= 0x3269) return code - 0x3251 + 21  // ㉑-㊿
  return -1
}

function isCircledChar(ch) {
  return circledCharToNum(ch) >= 0
}

const CIRCLED_RE = /[①-⑳㉑-㊿]/gu
const QUOTE_RE = /[「」]/g

// ─── XML / docx parsing ──────────────────────────────────────────────────────

function extractParagraphs(docxFile) {
  const zip = new AdmZip(docxFile)
  const xml = zip.readAsText("word/document.xml")

  const paras = []
  for (const m of xml.matchAll(/<w:p[ >][\s\S]*?<\/w:p>/g)) {
    const texts = []
    for (const t of m[0].matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g)) {
      texts.push(t[1])
    }
    const combined = texts
      .join("")
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
    if (combined.trim()) paras.push(combined)
  }
  return paras
}

// ─── Annotation parsing ──────────────────────────────────────────────────────

// Format: `⑦ 【word（pinyin）】answer` — pinyin may be embedded anywhere inside 【】
const ANN_RE = /^([①-⑳㉑-㊿])\s+【([^】]+)】(.+)$/u

function parseAnnotationLine(line) {
  const m = line.match(ANN_RE)
  if (!m) return null
  const PINYIN_RE = /^[a-zA-Zāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜüńňǹ\s·]+$/
  const rawBracket = m[2]
  const pinyinParts = []
  let word = rawBracket.replace(/（([^）]+)）/g, (_, inner) => {
    if (PINYIN_RE.test(inner)) { pinyinParts.push(inner); return "" }
    return `（${inner}）`
  }).trim()
  const pinyin = pinyinParts.join(" ")
  return { num: circledCharToNum(m[1]), word, pinyin, answer: m[3].trim() }
}

// ─── Category auto-detection ─────────────────────────────────────────────────

const FUNC_WORDS = new Set(["而", "以", "其", "之", "于", "为", "乎", "且", "者", "也", "则", "乃", "所", "若", "因", "与", "焉", "矣", "哉", "夫", "盖", "虽", "既", "即", "苟", "然", "奚", "何", "安"])

const HSF_WORDS = new Set([
  "爱","安","被","倍","本","鄙","兵","病","察","朝","曾","乘","诚","除","辞","从",
  "殆","当","道","得","度","非","复","负","盖","故","顾","固","归","国","过","何",
  "恨","胡","患","或","疾","及","极","即","计","加","假","间","见","将","就","举",
  "绝","堪","克","类","怜","临","略","论","漫","没","靡","明","名","末","莫","内",
  "难","判","平","期","奇","迁","请","穷","去","劝","却","若","善","稍","涉","胜",
  "识","使","是","适","书","属","数","率","说","私","素","汤","涕","通","徒","途",
  "推","颓","脱","完","亡","望","微","文","闻","问","相","信","行","幸","修","许",
  "徐","宣","寻","业","遗","贻","异","益","阴","因","引","右","原","远","约","再",
  "战","者","之","制","志","致","质","治","终","重","诸","族","卒","坐",
])

function detectCategory(word, answer) {
  // 通假字: answer mentions 同"X" or 通"X"
  if (/同[「""]/.test(answer) || /通[「""]/.test(answer)) return "tongJia"
  // 古今异义
  if (/古今/.test(answer)) return "guJinYiYi"
  // 词类活用: answer or word context mentions usage change
  if (/活用|名词作|形容词作|动词作|意动|使动/.test(answer)) return "ciLeiHuoYong"
  // 特殊句式
  if (/判断句|被动句|省略句|倒装|宾语前置|状语后置|介词结构|句式/.test(answer)) return "teShüJuShi"
  // 虚词: single-char function word
  if (word.length === 1 && FUNC_WORDS.has(word)) return "xuCi"
  // 多字短语中包含虚词，且answer中只解释了虚词用法
  if (/疑问代词|副词|连词|介词|助词|语气/.test(answer)) return "xuCi"
  return "shiCi"
}

// ─── Loose keywords extraction ────────────────────────────────────────────────

function extractLoose(answer) {
  // Split on Chinese punctuation, keep tokens 1-6 chars, no digits/brackets
  const tokens = answer
    .split(/[，。；、：？！\s（）【】""''《》·]/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 1 && t.length <= 6 && !/^\d+$/.test(t) && !/[①-⑳㉑-㊿]/.test(t))
  // Deduplicate, keep first 5
  const seen = new Set()
  const result = []
  for (const t of tokens) {
    if (!seen.has(t)) { seen.add(t); result.push(t) }
    if (result.length >= 5) break
  }
  return result
}

// ─── Context extraction ───────────────────────────────────────────────────────

const SENT_END = /[。！？]/

/**
 * Given raw content (with circled numbers), find the sentence
 * containing the given circled number and return it (without the number).
 */
function findContext(rawContent, circledChar) {
  // Strip corner-bracket quotes so they don't appear inside annotation words
  const clean = rawContent.replace(QUOTE_RE, "")
  const pos = clean.indexOf(circledChar)
  if (pos === -1) return ""

  // Walk backwards to find sentence start
  let start = pos - 1
  while (start >= 0 && !SENT_END.test(clean[start]) && clean[start] !== "\n") {
    start--
  }
  start = start < 0 ? 0 : start + 1

  // Walk forwards to find sentence end (inclusive)
  let end = pos + 1
  while (end < clean.length && !SENT_END.test(clean[end]) && clean[end] !== "\n") {
    end++
  }
  if (end < clean.length && (SENT_END.test(clean[end]) || clean[end] === "\n")) {
    if (clean[end] !== "\n") end++ // include the punctuation
  }

  const sentence = clean.slice(start, end).replace(CIRCLED_RE, "").trim()
  return sentence
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function parseDocx(filePath) {
  const paras = extractParagraphs(filePath)

  const isContentHeader = (s) => s === "原文" || s.startsWith("原文（") || s.startsWith("原文(")
  const isAnnotHeader  = (s) => s === "注释" || s.startsWith("注释（") || s.startsWith("注释(")

  // Split into sections by "原文" / "注释" headers (also handles "原文（续）" etc.)
  const sections = []
  let i = 0
  while (i < paras.length) {
    if (isContentHeader(paras[i])) {
      const contentStart = i + 1
      let j = contentStart
      while (j < paras.length && !isAnnotHeader(paras[j])) j++
      const contentParas = paras.slice(contentStart, j)
      const annStart = j + 1
      let k = annStart
      while (k < paras.length && !isContentHeader(paras[k])) k++
      const annParas = paras.slice(annStart, k)
      sections.push({ contentParas, annParas })
      i = k
    } else {
      i++
    }
  }

  if (sections.length === 0) {
    throw new Error("No 原文 section found in document")
  }

  console.log(`Found ${sections.length} section(s)`)

  // Build combined raw content (with circled numbers) and annotations
  const allAnnotations = []
  const rawParts = []
  let prevCleanTail = ""
  let titleNote = null

  for (const { contentParas, annParas } of sections) {
    // Join paragraphs: only insert \n at real sentence boundaries.
    // Page-layout breaks mid-sentence are joined directly (no separator).
    let raw = ""
    for (let pi = 0; pi < contentParas.length; pi++) {
      raw += contentParas[pi]
      if (pi < contentParas.length - 1) {
        const stripped = contentParas[pi].replace(CIRCLED_RE, "").trimEnd()
        const last = stripped.slice(-1)
        raw += /[。！？""''）】]/.test(last) ? "\n" : ""
      }
    }
    rawParts.push(raw)

    // Extended raw: prepend cleaned tail of previous section so findContext can
    // walk back across section boundaries.
    const extRaw = prevCleanTail + raw

    // Parse annotations
    const TITLE_NOTE_RE = /^([\u2460-\u2473\u3251-\u3269])\s*(?!【)(.+)$/u
    for (const line of annParas) {
      if (!titleNote) {
        const nm = line.match(TITLE_NOTE_RE)
        if (nm) { titleNote = nm[2].trim(); continue }
      }
      const ann = parseAnnotationLine(line)
      if (!ann) continue
      allAnnotations.push({ ...ann, rawSection: extRaw })
    }

    prevCleanTail = raw.replace(CIRCLED_RE, "").slice(-200)
  }

  // Join sections with smart separator (same logic as intra-section joining).
  let fullRaw = rawParts[0] || ""
  for (let si = 1; si < rawParts.length; si++) {
    const prevStripped = rawParts[si - 1].replace(CIRCLED_RE, "").trimEnd()
    const last = prevStripped.slice(-1)
    fullRaw += /[。！？""''）】]/.test(last) ? "\n" : ""
    fullRaw += rawParts[si]
  }

  // Build clean content (no circled numbers)
  const content = fullRaw.replace(CIRCLED_RE, "").replace(QUOTE_RE, "").trim()

  // Build annotation objects with context
  const annotations = allAnnotations.map(({ num, word, pinyin, answer, rawSection }) => {
    // Find circled char in this section's raw text
    // The num-th circled char in the section corresponds to the annotation
    // But each section resets numbering, so search in section raw text
    let circledChar = null
    for (const ch of rawSection) {
      if (circledCharToNum(ch) === num) { circledChar = ch; break }
    }

    let context = ""
    if (circledChar) {
      // Find context in section raw
      context = findContext(rawSection, circledChar)
    }
    if (!context) context = word // fallback

    return {
      word,
      pinyin,
      context,
      answer,
      loose: extractLoose(answer),
      category: detectCategory(word, answer),
      isHsfWord: HSF_WORDS.has(word),
    }
  })

  if (titleNote) {
    annotations.unshift({
      word: "题注", pinyin: "", context: "", answer: titleNote,
      loose: [], category: "other", isHsfWord: false,
    })
  }

  return { content, annotations }
}

// ─── HTTP helper ──────────────────────────────────────────────────────────────

function requestJson(method, url, headers, body) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body)
    const parsed = new URL(url)
    const lib = parsed.protocol === "https:" ? https : http
    const options = {
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === "https:" ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method,
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payload),
        ...headers,
      },
    }
    const req = lib.request(options, (res) => {
      let data = ""
      res.on("data", (chunk) => (data += chunk))
      res.on("end", () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }) }
        catch { resolve({ status: res.statusCode, body: data }) }
      })
    })
    req.on("error", reject)
    req.write(payload)
    req.end()
  })
}

async function main() {
  console.log(`Parsing: ${docxPath}`)
  const { content, annotations } = parseDocx(docxPath)

  console.log(`Content: ${content.length} chars`)
  console.log(`Annotations: ${annotations.length} total`)
  annotations.slice(0, 3).forEach((a, i) => {
    console.log(`  [${i}] ${a.word} (${a.category}) — ${a.answer.slice(0, 40)}`)
    console.log(`       context: ${a.context.slice(0, 60)}`)
  })

  // POST to Supabase REST API via the import endpoint
  // We call Supabase directly to update the texts table and annotations
  // First: update content
  console.log("\nUpdating content in Supabase...")
  const contentRes = await requestJson(
    "PATCH",
    `${SUPABASE_URL}/rest/v1/texts?id=eq.${textId}`,
    {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      Prefer: "return=minimal",
    },
    { content }
  )
  if (contentRes.status >= 300) {
    console.error("Failed to update content:", contentRes.body)
    process.exit(1)
  }
  console.log("✓ Content saved")

  // Insert annotations (skip duplicates by word+context)
  // First fetch existing to avoid duplicates
  const existingRes = await new Promise((resolve, reject) => {
    const url = new URL(`${SUPABASE_URL}/rest/v1/annotations?text_id=eq.${textId}&select=word,context`)
    const lib = url.protocol === "https:" ? https : http
    const req = lib.request({
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname + url.search,
      method: "GET",
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
    }, (res) => {
      let data = ""
      res.on("data", (c) => (data += c))
      res.on("end", () => resolve(JSON.parse(data)))
    })
    req.on("error", reject)
    req.end()
  })

  const existingKeys = new Set(
    (existingRes || []).map((a) => `${a.word}||${a.context}`)
  )

  const toInsert = annotations
    .filter((a) => !existingKeys.has(`${a.word}||${a.context}`))
    .map((a) => ({
      text_id: textId,
      word: a.word,
      pinyin: a.pinyin || "",
      context: a.context,
      answer: a.answer,
      loose: a.loose,
      category: a.category,
      is_hsf_word: a.isHsfWord,
      is_builtin: false,
    }))

  const skipped = annotations.length - toInsert.length
  console.log(`\nInserting ${toInsert.length} annotations (${skipped} duplicates skipped)...`)

  if (toInsert.length > 0) {
    const insertRes = await requestJson(
      "POST",
      `${SUPABASE_URL}/rest/v1/annotations`,
      {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        Prefer: "return=minimal",
      },
      toInsert
    )
    if (insertRes.status >= 300) {
      console.error("Failed to insert annotations:", insertRes.body)
      process.exit(1)
    }
  }

  console.log(`✓ Done: ${toInsert.length} inserted, ${skipped} skipped`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
