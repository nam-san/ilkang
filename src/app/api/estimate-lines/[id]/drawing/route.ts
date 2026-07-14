import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { writeFile, mkdir, unlink } from "fs/promises";
import path from "path";
import { UPLOAD_DIR, fileUrl, fileNameFromUrl } from "@/lib/uploads";

export const dynamic = "force-dynamic";

async function removeFile(url: string | null | undefined) {
  const name = fileNameFromUrl(url);
  if (!name) return;
  try {
    await unlink(path.join(UPLOAD_DIR, name));
  } catch {
    /* 무시 */
  }
}

// 도면(사진) 업로드 / 교체
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = Number(params.id);
  const line = await prisma.estimateLine.findUnique({ where: { id } });
  if (!line) return NextResponse.json({ error: "라인 없음" }, { status: 404 });

  const form = await req.formData();
  const file = form.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "이미지 파일이 필요합니다." }, { status: 400 });

  const bytes = Buffer.from(await file.arrayBuffer());
  await mkdir(UPLOAD_DIR, { recursive: true });
  const ext = (file.name.split(".").pop() || "png").replace(/[^a-zA-Z0-9]/g, "");
  const fileName = `drawing_${id}_${Date.now()}.${ext}`;
  await writeFile(path.join(UPLOAD_DIR, fileName), bytes);

  // 기존 도면 파일 삭제 (교체 시)
  await removeFile(line.drawingUrl);

  const updated = await prisma.estimateLine.update({
    where: { id },
    data: { drawingUrl: fileUrl(fileName) },
  });
  return NextResponse.json({ ok: true, drawingUrl: updated.drawingUrl }, { status: 201 });
}

// 도면 삭제
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = Number(params.id);
  const line = await prisma.estimateLine.findUnique({ where: { id } });
  await removeFile(line?.drawingUrl);
  await prisma.estimateLine.update({ where: { id }, data: { drawingUrl: null } });
  return NextResponse.json({ ok: true });
}
