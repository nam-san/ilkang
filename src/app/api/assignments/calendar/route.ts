import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { ymd } from "@/lib/format";
import { payableWage, manDay } from "@/lib/labor";

export const dynamic = "force-dynamic";

// 투입 캘린더: 날짜 × 현장 × 팀 별 투입 인원수 집계
// month=YYYY-MM (필수), contractId=현장 필터(옵션)
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const month = sp.get("month");
  const contractId = Number(sp.get("contractId")) || null;

  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: "month=YYYY-MM 필요" }, { status: 400 });
  }
  const from = new Date(`${month}-01T00:00:00`);
  const to = new Date(from);
  to.setMonth(to.getMonth() + 1);

  const where: Prisma.DailyAssignmentWhereInput = { date: { gte: from, lt: to } };
  if (contractId) where.contractId = contractId;

  const rows = await prisma.dailyAssignment.findMany({
    where,
    include: { contract: true, worker: true },
    orderBy: [{ date: "asc" }, { id: "asc" }],
  });

  // 날짜 + 현장 + 팀 으로 묶어 인원수/인건비 집계
  const map = new Map<
    string,
    {
      date: string;
      contractId: number;
      siteName: string;
      teamName: string;
      count: number;
      manDays: number;
      totalWage: number;
      workers: string[];
    }
  >();

  for (const r of rows) {
    const date = ymd(r.date);
    const teamName = r.teamName ?? r.worker.teamName ?? "미지정";
    const key = `${date}|${r.contractId}|${teamName}`;
    const cur =
      map.get(key) ?? {
        date,
        contractId: r.contractId,
        siteName: r.contract.siteName,
        teamName,
        count: 0,
        manDays: 0,
        totalWage: 0,
        workers: [],
      };
    cur.count += 1;
    cur.manDays += manDay(r.halfDay);
    cur.totalWage += payableWage(r.actualWage, r.halfDay);
    cur.workers.push(`${r.worker.name}${r.halfDay ? "(반)" : ""}`);
    map.set(key, cur);
  }

  const items = Array.from(map.values()).sort(
    (a, b) => a.date.localeCompare(b.date) || a.teamName.localeCompare(b.teamName)
  );
  return NextResponse.json(items);
}
