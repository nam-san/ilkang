import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { dayStart, ymd } from "@/lib/format";

export const dynamic = "force-dynamic";

/** 요청의 date 파라미터(없으면 오늘) → 로컬 자정 Date */
function targetDate(v: unknown): Date {
  return dayStart(v) ?? dayStart(ymd(new Date()))!;
}

// 특정 날짜(기본: 오늘)의 공용 메모 조회
export async function GET(req: NextRequest) {
  const date = targetDate(req.nextUrl.searchParams.get("date"));
  const memo = await prisma.memo.findUnique({ where: { date } });
  return NextResponse.json(
    memo ?? { id: null, date, content: "", updatedBy: null, updatedAt: null }
  );
}

// 해당 날짜의 메모 저장 (없으면 생성)
export async function PUT(req: NextRequest) {
  const body = await req.json();
  const date = targetDate(body.date);
  const content = typeof body.content === "string" ? body.content : "";
  const updatedBy = body.updatedBy?.trim() || null;

  const memo = await prisma.memo.upsert({
    where: { date },
    create: { date, content, updatedBy },
    update: { content, updatedBy },
  });
  return NextResponse.json(memo);
}
