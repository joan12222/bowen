import type { Metadata, Viewport } from "next"
import "./globals.css"
import BottomNav from "@/components/BottomNav"

export const metadata: Metadata = {
  title: "博文 · 文言文学习",
  description: "高中文言文练习工具，覆盖人教统编版全部篇目",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "博文",
  },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN">
      <body>
        <div className="page-content min-h-screen">
          {children}
        </div>
        <BottomNav />
      </body>
    </html>
  )
}
