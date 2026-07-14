import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { unlink } from "fs/promises";
import path from "path";
import { UPLOAD_DIR, fileNameFromUrl } from "@/lib/uploads";

export const dynamic = "force-dynamic";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = Number(params.id);
  const log = await prisma.dailyLog.findUnique({ where: { id } });
  const name = fileNameFromUrl(log?.imageUrl);
  if (name) {
    try {
      await unlink(path.join(UPLOAD_DIR, name));
    } catch {
      /* 무시 */
    }
  }
  await prisma.dailyLog.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
