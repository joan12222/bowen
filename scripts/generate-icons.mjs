// One-off script: rasterizes the app icon (a red rounded square with the
// character "博") into the PWA icon sizes referenced by public/manifest.json.
// Run with: node scripts/generate-icons.mjs
import sharp from "sharp"
import { mkdirSync } from "node:fs"
import { fileURLToPath } from "node:url"
import path from "node:path"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const outDir = path.join(__dirname, "..", "public", "icons")
mkdirSync(outDir, { recursive: true })

const THEME = "#c0392b"

function svgIcon(size, { maskable = false } = {}) {
  // Maskable icons need extra padding so the OS can safely crop to a circle.
  const pad = maskable ? size * 0.2 : size * 0.12
  const radius = maskable ? 0 : size * 0.22
  const fontSize = size - pad * 2
  return `
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${size}" height="${size}" rx="${radius}" fill="${THEME}" />
  <text
    x="50%" y="53%"
    text-anchor="middle"
    dominant-baseline="central"
    font-family="'Microsoft YaHei', 'PingFang SC', 'Noto Sans CJK SC', 'SimHei', sans-serif"
    font-weight="700"
    font-size="${fontSize}"
    fill="#faf8f5"
  >博</text>
</svg>`
}

const targets = [
  { file: "icon-192.png", size: 192 },
  { file: "icon-512.png", size: 512 },
  { file: "maskable-192.png", size: 192, maskable: true },
  { file: "maskable-512.png", size: 512, maskable: true },
  { file: "apple-touch-icon.png", size: 180 },
]

for (const { file, size, maskable } of targets) {
  const svg = svgIcon(size, { maskable })
  await sharp(Buffer.from(svg)).png().toFile(path.join(outDir, file))
  console.log(`wrote ${file}`)
}
