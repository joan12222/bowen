import { NextRequest, NextResponse } from "next/server"
import { writeFile, mkdir } from "fs/promises"
import path from "path"
import { v4 as uuidv4 } from "uuid"

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const formData = await req.formData()
    const images = formData.getAll("images") as File[]
    const pdfFile = formData.get("file") as File | null

    const isPdf = !!(pdfFile && pdfFile.name.toLowerCase().endsWith(".pdf"))
    const isImages = images.length > 0

    if (!isPdf && !isImages) {
      return NextResponse.json({ error: "未提供文件" }, { status: 400 })
    }

    const uploadDir = path.join(process.cwd(), "public", "uploads", id)
    await mkdir(uploadDir, { recursive: true })
    await mkdir(path.join(process.cwd(), "tasks"), { recursive: true })

    const savedFiles: string[] = []

    if (isPdf) {
      const buffer = Buffer.from(await pdfFile!.arrayBuffer())
      const filename = "source.pdf"
      await writeFile(path.join(uploadDir, filename), buffer)
      savedFiles.push("/uploads/" + id + "/" + filename)
    } else {
      for (let i = 0; i < images.length; i++) {
        const file = images[i]
        const ext = file.name.split(".").pop()?.toLowerCase() || "jpg"
        const filename = String(i + 1).padStart(3, "0") + "_" + uuidv4().slice(0, 8) + "." + ext
        const buffer = Buffer.from(await file.arrayBuffer())
        await writeFile(path.join(uploadDir, filename), buffer)
        savedFiles.push("/uploads/" + id + "/" + filename)
      }
    }

    const taskId = uuidv4()
    const task = {
      id: taskId,
      text_id: id,
      type: "wenyan",
      file_type: isPdf ? "pdf" : "images",
      files: savedFiles,
      status: "pending",
      created_at: new Date().toISOString(),
    }
    await writeFile(
      path.join(process.cwd(), "tasks", taskId + ".json"),
      JSON.stringify(task, null, 2)
    )

    return NextResponse.json({ task_id: taskId, files: savedFiles })
  } catch (e) {
    const msg = e instanceof Error ? e.message : "上传失败"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
