import { NextRequest, NextResponse } from "next/server"
import { writeFile, mkdir, rm } from "fs/promises"
import path from "path"
import { v4 as uuidv4 } from "uuid"

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const formData = await req.formData()
    const files = formData.getAll("images") as File[]

    if (!files || files.length === 0) {
      return NextResponse.json({ error: "未提供图片" }, { status: 400 })
    }

    // 保存图片到临时目录
    const uploadDir = path.join(process.cwd(), "public", "uploads", id)
    await mkdir(uploadDir, { recursive: true })

    // 创建 tasks 目录
    const tasksDir = path.join(process.cwd(), "tasks")
    await mkdir(tasksDir, { recursive: true })

    const imagePaths: string[] = []
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const ext = file.name.split(".").pop() || "jpg"
      const filename = uuidv4() + "." + ext
      const filepath = path.join(uploadDir, filename)
      const buffer = Buffer.from(await file.arrayBuffer())
      await writeFile(filepath, buffer)
      imagePaths.push("/uploads/" + id + "/" + filename)
    }

    // 创建本地任务文件
    const taskId = uuidv4()
    const taskFile = path.join(tasksDir, taskId + ".json")
    const task = {
      id: taskId,
      text_id: id,
      images: imagePaths,
      status: "pending",
      created_at: new Date().toISOString(),
    }
    await writeFile(taskFile, JSON.stringify(task, null, 2))

    return NextResponse.json({ task_id: taskId, images: imagePaths, count: files.length })
  } catch (e) {
    const msg = e instanceof Error ? e.message : "上传失败"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const { searchParams } = new URL(req.url)
    const imagePath = searchParams.get("path")
    if (imagePath) {
      const fullPath = path.join(process.cwd(), "public", imagePath)
      await rm(fullPath, { force: true })
    }
    return NextResponse.json({ success: true })
  } catch (e) {
    return NextResponse.json({ error: "删除失败" }, { status: 500 })
  }
}
