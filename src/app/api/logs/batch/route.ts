import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { UPLOAD_DIR, fileUrl } from "@/lib/uploads";

export const dynamic = "force-dynamic";

const ALLOWED = ["근무일지", "작업사진", "기타"];

// 근무일지/현장사진 묶음 업로드
// FormData: contractId, category, files[] (여러 장), dates (JSON 배열, files와 같은 순서)
export async function POST(req: NextRequest) {
  const form = await req.formData();
  const contractId = Number(form.get("contractId"));
  const categoryRaw = String(form.get("category") || "근무일지");
  const category = ALLOWED.includes(categoryRaw) ? categoryRaw : "근무일지";
  const files = form.getAll("files").filter((f): f is File => f instanceof File);

  let dates: string[] = [];
  try {
    dates = JSON.parse(String(form.get("dates") || "[]"));
  } catch {
    dates = [];
  }

  if (!contractId) {
    return NextResponse.json({ error: "현장을 선택하세요." }, { status: 400 });
  }
  if (files.length === 0) {
    return NextResponse.json({ error: "업로드할 사진을 선택하세요." }, { status: 400 });
  }

  await mkdir(UPLOAD_DIR, { recursive: true });

  const created: { date: string; imageUrl: string }[] = [];
  const failed: string[] = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const dateStr = dates[i];
    if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      failed.push(`${file.name}: 날짜 미지정`);
      continue;
    }
    try {
      const bytes = Buffer.from(await file.arrayBuffer());
      const ext = (file.name.split(".").pop() || "jpg").replace(/[^a-zA-Z0-9]/g, "");
      const fileName = `${contractId}_${dateStr}_${Date.now()}_${i}.${ext}`;
      await writeFile(path.join(UPLOAD_DIR, fileName), bytes);
      const log = await prisma.dailyLog.create({
        data: {
          contractId,
          date: new Date(`${dateStr}T00:00:00`),
          category,
          imageUrl: fileUrl(fileName),
        },
      });
      created.push({ date: dateStr, imageUrl: log.imageUrl });
    } catch {
      failed.push(`${file.name}: 저장 실패`);
    }
  }

  return NextResponse.json(
    { ok: true, count: created.length, failed },
    { status: created.length ? 201 : 400 }
  );
}
