/**
 * process-task.mjs
 * 处理导入任务
 * 用法: node scripts/process-task.mjs <taskFile.json>
 */

import { readFile, rm } from "fs/promises"
import { readFileSync } from "fs"
import { createClient } from "@supabase/supabase-js"
import path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// 加载 .env.local
const envFile = readFileSync(path.join(__dirname, "../.env.local"), "utf-8")
const env = {}
for (const line of envFile.split("\n")) {
  const [key, ...vals] = line.split("=")
  if (key && vals.length > 0) {
    env[key.trim()] = vals.join("=").trim()
  }
}

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

// 圆圈数字映射
function circledCharToNum(ch) {
  const code = ch.codePointAt(0)
  if (code >= 0x2460 && code <= 0x2473) return code - 0x2460 + 1
  if (code >= 0x3251 && code <= 0x3269) return code - 0x3251 + 21
  return -1
}

// 解析 OCR 结果
function parseOCRResult(text) {
  const lines = text.split("\n").map(l => l.trim()).filter(l => l)

  // 找到【原文】和【注释】的分隔
  let contentStart = -1
  let annotStart = -1

  for (let i = 0; i < lines.length; i++) {
    const l = lines[i]
    if (l === "原文" || l === "【原文】") {
      contentStart = i + 1
    }
    if (l === "注释" || l === "【注释】") {
      annotStart = i + 1
      break
    }
  }

  if (contentStart === -1 || annotStart === -1) {
    throw new Error("无法解析格式：未找到【原文】或【注释】标记")
  }

  // 提取原文（到注释之前的所有内容）
  const contentLines = lines.slice(contentStart, annotStart - 1)
  let content = contentLines.join("\n")

  // 提取注释
  const annotLines = lines.slice(annotStart)

  // 解析注释行 - 支持多种格式
  const annotations = []
  for (const line of annotLines) {
    if (!line.trim()) continue

    // 匹配格式1: ⑩【词语】释义
    // 匹配格式2: ⑩词语（拼音） 释义
    // 匹配格式3: ⑩某 释义（无拼音）
    let match = line.match(/^([\u2460-\u2473\u3251-\u3269])\s*【([^】]+)】(.+)$/u)
    if (!match) {
      // 尝试格式2/3：圆圈数字 + 空格 + 词语（可能带拼音）+ 空格 + 释义
      match = line.match(/^([\u2460-\u2473\u3251-\u3269])([^\s\u2460-\u2473\u3251-\u3269]+(?:\([^)]+\))?)\s+(.+)$/u)
    }

    if (match) {
      const num = circledCharToNum(match[1])
      const bracket = match[2].trim()
      const answer = match[3].trim()

      // 提取拼音
      const pinyinMatch = bracket.match(/（([^）]+)）/g)
      let word = bracket
      let pinyin = ""
      if (pinyinMatch) {
        pinyin = pinyinMatch.map(p => p.slice(1, -1)).join(" ")
        word = bracket.replace(/（[^）]+）/g, "")
      }

      // 提取上下文 - 在原始 content 中查找 word，确保 context 以 word 开头
      // 策略：在 content 中找到 word 的每个出现位置，取第一个作为正确的匹配
      let context = word
      let foundIdx = -1
      // 在 content 中查找 word（可能有多个出现）
      for (let i = 0; i < content.length - word.length + 1; i++) {
        if (content.slice(i, i + word.length) === word) {
          foundIdx = i
          break
        }
      }
      if (foundIdx !== -1) {
        // context = word + 后面最多 20 个字符
        let end = Math.min(content.length, foundIdx + word.length + 20)
        context = content.slice(foundIdx, end)
      }

      annotations.push({
        word,
        pinyin,
        context,
        answer,
        num,
      })
    }
  }

  return { content, annotations }
}

async function processTask(taskFile) {
  console.log("读取任务:", taskFile)
  const content = await readFile(taskFile, "utf-8")
  const task = JSON.parse(content)
  const { id: taskId, text_id: textId, images } = task

  console.log("任务ID:", taskId)
  console.log("文章ID:", textId)
  console.log("图片数量:", images.length)

  // 读取 OCR 结果文件
  const ocrResultFile = path.join(__dirname, "../_ocr_results/" + taskId + ".txt")
  let ocrText
  try {
    ocrText = await readFile(ocrResultFile, "utf-8")
  } catch {
    console.error("未找到 OCR 结果文件:", ocrResultFile)
    return
  }

  console.log("解析 OCR 结果...")
  const { content: articleContent, annotations } = parseOCRResult(ocrText)

  console.log("原文长度:", articleContent.length)
  console.log("注释数量:", annotations.length)

  // 更新 texts 表
  console.log("更新 texts 表...")
  const { error: updateErr } = await supabase
    .from("texts")
    .update({ content: articleContent })
    .eq("id", textId)

  if (updateErr) {
    console.error("更新 texts 失败:", updateErr)
    return
  }

  // 删除旧 annotations
  console.log("删除旧 annotations...")
  await supabase.from("annotations").delete().eq("text_id", textId)

  // 插入新 annotations
  console.log("插入新 annotations...")
  const rows = annotations.map(a => ({
    text_id: textId,
    word: a.word,
    pinyin: a.pinyin,
    context: a.context,
    answer: a.answer,
    loose: [],
    category: "other",
    is_hsf_word: false,
    is_builtin: false,
  }))

  if (rows.length > 0) {
    const { error: insertErr } = await supabase.from("annotations").insert(rows)
    if (insertErr) {
      console.error("插入 annotations 失败:", insertErr)
      return
    }
  }

  // 删除任务文件和图片
  console.log("清理文件...")
  await rm(taskFile, { force: true })
  await rm(ocrResultFile, { force: true })

  // 删除图片
  for (const imgPath of images) {
    const fullPath = path.join(__dirname, "../public" + imgPath)
    await rm(fullPath, { force: true })
  }

  console.log("任务完成!")
}

const taskFile = process.argv[2]
if (!taskFile) {
  console.error("用法: node scripts/process-task.mjs <taskFile.json>")
  process.exit(1)
}

processTask(path.resolve(taskFile)).catch(console.error)
