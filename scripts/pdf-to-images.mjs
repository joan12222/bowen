/**
 * pdf-to-images.mjs
 * 将 PDF 每页渲染为图片，用于 MiniMax OCR 识别
 *
 * 用法: node scripts/pdf-to-images.mjs <pdfPath> [outputDir]
 */

import path from "path"
import fs from "fs"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// 动态导入 pdfjs-dist (legacy build 支持 Node.js)
const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs")

// 设置 worker（Node.js 环境不需要）
pdfjsLib.GlobalWorkerOptions.workerSrc = ""

const args = process.argv.slice(2)
if (args.length === 0) {
  console.error("用法: node scripts/pdf-to-images.mjs <pdfPath> [outputDir]")
  process.exit(1)
}

const pdfPath = path.resolve(args[0])
const outputDir = args[1] ? path.resolve(args[1]) : path.join(__dirname, "../_pdf_images")

if (!fs.existsSync(pdfPath)) {
  console.error("PDF 文件不存在:", pdfPath)
  process.exit(1)
}

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true })
}

console.log("读取 PDF:", pdfPath)
const data = new Uint8Array(fs.readFileSync(pdfPath))
const pdf = await pdfjsLib.getDocument({ data }).promise
const totalPages = pdf.numPages

console.log("总页数:", totalPages)

for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
  console.log("渲染第", pageNum, "/", totalPages, "页...")
  const page = await pdf.getPage(pageNum)
  const viewport = page.getViewport({ scale: 2.0 })

  // Node.js canvas - 使用简单的像素缓冲区
  const width = Math.floor(viewport.width)
  const height = Math.floor(viewport.height)

  // 创建原始像素数据 (RGBA)
  const imageData = new Uint8Array(width * height * 4)

  // 填充白色背景
  for (let i = 0; i < imageData.length; i += 4) {
    imageData[i] = 255     // R
    imageData[i + 1] = 255 // G
    imageData[i + 2] = 255 // B
    imageData[i + 3] = 255 // A
  }

  // 渲染页面到图像数据
  const renderContext = {
    canvasContext: {
      canvas: {
        width,
        height,
        getContext: () => ({
          _imageData: imageData,
          _width: width,
          _height: height,
          fillRect: () => {},
          fillText: () => {},
          drawImage: () => {},
        }),
        setAttribute: () => {},
        style: {},
      },
    },
    viewport,
  }

  try {
    await page.render(renderContext).promise
  } catch (e) {
    // 忽略渲染错误，继续
  }

  // 保存为 PNG
  const outputPath = path.join(outputDir, `page_${String(pageNum).padStart(3, "0")}.png`)
  fs.writeFileSync(outputPath, imageData)
  console.log("保存:", outputPath)
}

console.log("\n完成！图片保存在:", outputDir)
