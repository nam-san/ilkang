import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { ymd } from "@/lib/format";
import { payableWage, manDay } from "@/lib/labor";

export const dynamic = "force-dynamic";

// 현장별 인건비 써머리.
// month=YYYY-MM 이면 해당 월만, 없으면 전체 기간 누적.
export async function GET(req: NextRequest) {
  const month = req.nextUrl.searchParams.get("month");
  const where: Prisma.DailyAssignmentWhereInput = {};
  if (month) {
    if (!/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json({ error: "month=YYYY-MM 형식" }, { status: 400 });
    }
    const from = new Date(`${month}-01T00:00:00`);
    const to = new Date(from);
    to.setMonth(to.getMonth() + 1);
    where.date = { gte: from, lt: to };
  }

  const rows = await prisma.dailyAssignment.findMany({
    where,
    include: { contract: true, worker: true },
  });

  // 현장별 집계
  const siteMap = new Map<
    number,
    {
      contractId: number;
      siteName: string;
      builderName: string;
      headcount: number; // 투입 건수(연인원)
      manDays: number; // 공수 (반일 0.5)
      totalWage: number;
      days: Set<string>; // 투입 일수
      firstDate: string;
      lastDate: string;
    }
  >();
  // 인원별 집계
  const workerMap = new Map<
    number,
    {
      workerId: number;
      name: string;
      teamName: string;
      days: number; // 투입 건수
      manDays: number;
      totalWage: number;
      minWage: number;
      maxWage: number;
    }
  >();

  for (const r of rows) {
    const d = ymd(r.date);
    const pay = payableWage(r.actualWage, r.halfDay);
    const md = manDay(r.halfDay);

    const site =
      siteMap.get(r.contractId) ??
      {
        contractId: r.contractId,
        siteName: r.contract.siteName,
        builderName: r.contract.builderName,
        headcount: 0,
        manDays: 0,
        totalWage: 0,
        days: new Set<string>(),
        firstDate: d,
        lastDate: d,
      };
    site.headcount += 1;
    site.manDays += md;
    site.totalWage += pay;
    site.days.add(d);
    if (d < site.firstDate) site.firstDate = d;
    if (d > site.lastDate) site.lastDate = d;
    siteMap.set(r.contractId, site);

    const w =
      workerMap.get(r.workerId) ??
      {
        workerId: r.workerId,
        name: r.worker.name,
        teamName: r.teamName ?? r.worker.teamName,
        days: 0,
        manDays: 0,
        totalWage: 0,
        minWage: r.actualWage,
        maxWage: r.actualWage,
      };
    w.days += 1;
    w.manDays += md;
    w.totalWage += pay;
    w.minWage = Math.min(w.minWage, r.actualWage);
    w.maxWage = Math.max(w.maxWage, r.actualWage);
    workerMap.set(r.workerId, w);
  }

  const summary = Array.from(siteMap.values())
    .map((s) => ({
      contractId: s.contractId,
      siteName: s.siteName,
      builderName: s.builderName,
      headcount: s.headcount,
      manDays: s.manDays,
      workDays: s.days.size,
      totalWage: s.totalWage,
      firstDate: s.firstDate,
      lastDate: s.lastDate,
    }))
    .sort((a, b) => b.totalWage - a.totalWage);

  const byWorker = Array.from(workerMap.values()).sort((a, b) => b.totalWage - a.totalWage);

  const grand = {
    headcount: summary.reduce((s, x) => s + x.headcount, 0),
    manDays: summary.reduce((s, x) => s + x.manDays, 0),
    totalWage: summary.reduce((s, x) => s + x.totalWage, 0),
    workerCount: byWorker.length,
    siteCount: summary.length,
  };
  return NextResponse.json({ month: month || null, summary, byWorker, grand });
}
