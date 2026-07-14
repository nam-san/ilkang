import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { UPLOAD_DIR, fileUrl } from "@/lib/uploads";

export const dynamic = "force-dynamic";

// 근무일지 사진 목록 (contractId 필수, month 옵션)
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const contractId = Number(sp.get("contractId"));
  const month = sp.get("month");
  if (!contractId) {
    return NextResponse.json({ error: "contractId 필요" }, { status: 400 });
  }
  const where: Prisma.DailyLogWhereInput = { contractId };
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    const from = new Date(`${month}-01T00:00:00`);
    const to = new Date(from);
    to.setMonth(to.getMonth() + 1);
    where.date = { gte: from, lt: to };
  }
  const logs = await prisma.dailyLog.findMany({
    where,
    orderBy: { date: "desc" },
  });
  return NextResponse.json(logs);
}

// 근무일지 사진 업로드 (multipart/form-data)
export async function POST(req: NextRequest) {
  const form = await req.formData();
  const contractId = Number(form.get("contractId"));
  const dateStr = String(form.get("date") || "");
  const note = String(form.get("note") || "");
  const file = form.get("file") as File | null;
  const allowed = ["근무일지", "작업사진", "기타"];
  const categoryRaw = String(form.get("category") || "근무일지");
  const category = allowed.includes(categoryRaw) ? categoryRaw : "근무일지";

  if (!contractId || !dateStr || !file) {
    return NextResponse.json(
      { error: "현장, 날짜, 사진 파일이 필요합니다." },
      { status: 400 }
    );
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  await mkdir(UPLOAD_DIR, { recursive: true });
  const safeExt = (file.name.split(".").pop() || "jpg").replace(/[^a-zA-Z0-9]/g, "");
  const fileName = `${contractId}_${dateStr}_${Date.now()}.${safeExt}`;
  await writeFile(path.join(UPLOAD_DIR, fileName), bytes);

  const log = await prisma.dailyLog.create({
    data: {
      contractId,
      date: new Date(`${dateStr}T00:00:00`),
      category,
      imageUrl: fileUrl(fileName),
      note: note.trim() || null,
    },
  });
  return NextResponse.json(log, { status: 201 });
}
