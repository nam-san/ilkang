import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ymd } from "@/lib/format";

export const dynamic = "force-dynamic";

// 메모가 있는 날짜 목록 (캘린더 표시용). month=YYYY-MM 이면 해당 월만.
export async function GET(req: NextRequest) {
  const month = req.nextUrl.searchParams.get("month");
  let where = {};
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    const from = new Date(`${month}-01T00:00:00`);
    const to = new Date(from);
    to.setMonth(to.getMonth() + 1);
    where = { date: { gte: from, lt: to } };
  }
  const memos = await prisma.memo.findMany({
    where,
    orderBy: { date: "asc" },
    select: { date: true, content: true },
  });
  // 내용이 있는 날짜만 반환
  const dates = memos
    .filter((m) => m.content.trim().length > 0)
    .map((m) => ({ date: ymd(m.date), preview: m.content.trim().slice(0, 40) }));
  return NextResponse.json(dates);
}
