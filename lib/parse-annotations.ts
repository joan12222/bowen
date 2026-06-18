import { AnnotationCategory } from "./types"
import { HSF_WORDS } from "./constants"

// ─── Circled number helpers ───────────────────────────────────────────────────

export function circledCharToNum(ch: string): number {
  const code = ch.codePointAt(0) ?? 0
  if (code >= 0x2460 && code <= 0x2473) return code - 0x2460 + 1  // ①–⑳
  if (code >= 0x3251 && code <= 0x325F) return code - 0x3251 + 21 // ㉑–㉟
  if (code >= 0x32B1 && code <= 0x32BF) return code - 0x32B1 + 36 // ㊱–㊿
  return -1
}

export const CIRCLED_RE = /[\u2460-\u2473\u3251-\u325F\u32B1-\u32BF]/gu
export const QUOTE_RE = /[「」]/g

// ─── Annotation line parsing ──────────────────────────────────────────────────

const ANN_RE = /^([\u2460-\u2473\u3251-\u325F\u32B1-\u32BF])\s+【([^】]+)】(.+)$/u
const PINYIN_RE = /^[a-zA-Zāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜüńňǹăĕĭŏŭ\s·]+$/

export interface RawAnnotation {
  num: number
  word: string
  pinyin: string
  answer: string
  rawSection: string
}

const ANN_RE_NO_BRACKET = /^([\u2460-\u2473\u3251-\u325F\u32B1-\u32BF])\s*(.+)$/u

export function parseAnnotationLine(line: string, rawSection: string): RawAnnotation | null {
  const m = line.match(ANN_RE)
  if (m) {
    const rawBracket = m[2]
    const pinyinParts: string[] = []
    let word = rawBracket.replace(/（([^）]+)）/g, (_, inner) => {
      if (PINYIN_RE.test(inner)) { pinyinParts.push(inner); return "" }
      return `（${inner}）`
    }).trim()
    const pinyin = pinyinParts.join(" ")
    return { num: circledCharToNum(m[1]), word, pinyin, answer: m[3].trim(), rawSection }
  }
  // Fallback: annotation without 【】 brackets (e.g. "① 选自《临川先生文集》……")
  const m2 = line.match(ANN_RE_NO_BRACKET)
  if (m2) {
    return { num: circledCharToNum(m2[1]), word: "", pinyin: "", answer: m2[2].trim(), rawSection }
  }
  return null
}

// ─── Context extraction ───────────────────────────────────────────────────────

const SENT_END = /[。！？]/

export function findContext(rawSection: string, circledChar: string): string {
  const clean = rawSection.replace(QUOTE_RE, "")
  const pos = clean.indexOf(circledChar)
  if (pos === -1) return ""
  let start = pos - 1
  while (start >= 0 && !SENT_END.test(clean[start]) && clean[start] !== "\n") start--
  start = start < 0 ? 0 : start + 1
  let end = pos + 1
  while (end < clean.length && !SENT_END.test(clean[end]) && clean[end] !== "\n") end++
  if (end < clean.length && SENT_END.test(clean[end])) end++
  return clean.slice(start, end).replace(CIRCLED_RE, "").trim()
}

// ─── Category detection ───────────────────────────────────────────────────────

const FUNC_WORD_SET = new Set(["而","以","其","之","于","为","乎","且","者","也","则","乃","所","若","因","与","焉","矣","哉","夫","盖","虽","既","即","苟","然","奚","何","安"])

export function detectCategory(word: string, answer: string): AnnotationCategory {
  if (/同[「""']/.test(answer) || /通[「""']/.test(answer)) return "tongJia"
  if (/古今/.test(answer)) return "guJinYiYi"
  if (/活用|名词作|形容词作|动词作|意动|使动/.test(answer)) return "ciLeiHuoYong"
  if (/判断句|被动句|省略句|倒装|宾语前置|状语后置|句式/.test(answer)) return "teShüJuShi"
  if (word.length === 1 && FUNC_WORD_SET.has(word)) return "xuCi"
  if (/疑问代词|副词|连词|介词|助词|语气词/.test(answer)) return "xuCi"
  return "shiCi"
}

// ─── Loose keywords ───────────────────────────────────────────────────────────

export function extractLoose(answer: string): string[] {
  const tokens = answer
    .split(/[，。；、：？！\s（）【】""''《》·]/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 1 && t.length <= 6 && !/^\d+$/.test(t) && !/[\u2460-\u2473\u3251-\u3269]/.test(t))
  const seen = new Set<string>()
  const result: string[] = []
  for (const t of tokens) {
    if (!seen.has(t)) { seen.add(t); result.push(t) }
    if (result.length >= 5) break
  }
  return result
}

// ─── Shared paragraph-based parser ───────────────────────────────────────────

export interface ParsedAnnotation {
  word: string
  pinyin: string
  context: string
  answer: string
  loose: string[]
  category: AnnotationCategory
  isHsfWord: boolean
}

export interface ParseResult {
  content: string
  annotations: ParsedAnnotation[]
}

export function parseParas(paras: string[]): ParseResult {
  const isContentHeader = (s: string) => { s = s.trim(); return /^(【)?原文(】)?$/.test(s) || s.startsWith("原文（") || s.startsWith("原文(") || s.startsWith("【原文】") }
  const isAnnotHeader  = (s: string) => { s = s.trim(); return /^(【)?注释(】)?$/.test(s) || s.startsWith("注释（") || s.startsWith("注释(") || s.startsWith("【注释】") }

  const sections: { contentParas: string[]; annParas: string[] }[] = []
  let i = 0
  while (i < paras.length) {
    if (isContentHeader(paras[i])) {
      const cs = i + 1
      let j = cs
      while (j < paras.length && !isAnnotHeader(paras[j])) j++
      const as = j + 1
      let k = as
      while (k < paras.length && !isContentHeader(paras[k])) k++
      sections.push({ contentParas: paras.slice(cs, j), annParas: paras.slice(as, k) })
      i = k
    } else {
      i++
    }
  }

  if (sections.length === 0) throw new Error("文档中未找到「原文」段落，请检查格式")

  const rawParts: string[] = []
  const rawAnnotations: RawAnnotation[] = []
  let titleNote: string | null = null
  let prevCleanTail = ""

  for (const { contentParas, annParas } of sections) {
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

    const extRaw = prevCleanTail + raw

    for (const line of annParas) {
      if (!titleNote) {
        const noteM = line.match(/^([\u2460-\u2473\u3251-\u325F\u32B1-\u32BF])\s*(?!【)(.+)$/u)
        if (noteM) {
          titleNote = noteM[2].trim()
          continue
        }
      }
      const ann = parseAnnotationLine(line, extRaw)
      if (ann) rawAnnotations.push(ann)
    }

    prevCleanTail = raw.replace(CIRCLED_RE, "").slice(-200)
  }

  let fullRaw = rawParts[0] ?? ""
  for (let si = 1; si < rawParts.length; si++) {
    const prevStripped = rawParts[si - 1].replace(CIRCLED_RE, "").trimEnd()
    const last = prevStripped.slice(-1)
    fullRaw += /[。！？""''）】]/.test(last) ? "\n" : ""
    fullRaw += rawParts[si]
  }
  const content = fullRaw.replace(CIRCLED_RE, "").replace(QUOTE_RE, "").trim()

  const annotations: ParsedAnnotation[] = rawAnnotations.map(({ num, word, pinyin, answer, rawSection }) => {
    let circledChar = ""
    for (const ch of rawSection) {
      if (circledCharToNum(ch) === num) { circledChar = ch; break }
    }
    const context = circledChar ? findContext(rawSection, circledChar) : word
    return {
      word,
      pinyin,
      context,
      answer,
      loose: extractLoose(answer),
      category: detectCategory(word, answer),
      isHsfWord: word.length === 1 && HSF_WORDS.includes(word),
    }
  })

  // Normalize contexts that don't match the sentence positions in content.
  //
  // Two issues can arise from findContext:
  // 1. Cross-section overflow: prevCleanTail is concatenated without \n, so the backward
  //    scan picks up the previous section's tail (e.g. '"（《子罕》）\u3000\u3000子曰："知…').
  //    Fix: trim from the left until we find a substring that exists in content.
  // 2. Leading \u3000 (paragraph indent): after trimming issue 1, the context may still
  //    start with \u3000\u3000. JS .trim() strips \u3000 (Unicode Zs category) from sentences
  //    in splitIntoSentences, so the sentence starts 2 chars later in content than the context.
  //    Fix: also strip leading \u3000 from the normalized context.
  for (const ann of annotations) {
    if (!ann.context) continue
    // Step 1: fix cross-section overflow
    if (content.indexOf(ann.context) === -1) {
      for (let i = 1; i < ann.context.length - 3; i++) {
        const sub = ann.context.slice(i)
        if (content.indexOf(sub) !== -1) {
          ann.context = sub
          break
        }
      }
    }
    // Step 2: strip leading \u3000 (ideographic spaces) so context aligns with trimmed sentences
    const trimmed = ann.context.replace(/^\u3000+/, "")
    if (trimmed && content.indexOf(trimmed) !== -1) {
      ann.context = trimmed
    }
  }

  if (titleNote) {
    annotations.unshift({
      word: "题注",
      pinyin: "",
      context: "",
      answer: titleNote,
      loose: [],
      category: "other",
      isHsfWord: false,
    })
  }

  return { content, annotations }
}
