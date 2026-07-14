import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import { UPLOAD_DIR } from "@/lib/uploads";

export const dynamic = "force-dynamic";

const MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  bmp: "image/bmp",
};

// 업로드된 사진(근무일지·도면 등) 서빙 — 영구 볼륨 경로에서 읽어 제공
export async function GET(
  _req: NextRequest,
  { params }: { params: { name: string } }
) {
  const name = params.name;
  // 경로 조작 방지: 파일명만 허용
  if (!name || name.includes("/") || name.includes("\\") || name.includes("..")) {
    return NextResponse.json({ error: "잘못된 파일명" }, { status: 400 });
  }
  try {
    const buf = await readFile(path.join(UPLOAD_DIR, name));
    const ext = (name.split(".").pop() || "").toLowerCase();
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": MIME[ext] || "application/octet-stream",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return NextResponse.json({ error: "파일 없음" }, { status: 404 });
  }
}
