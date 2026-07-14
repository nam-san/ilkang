import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// 월별 현장별 인건비 종합 (month=YYYY-MM)
export async function GET(req: NextRequest) {
  const month = req.nextUrl.searchParams.get("month");
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: "month=YYYY-MM 필요" }, { status: 400 });
  }
  const from = new Date(`${month}-01T00:00:00`);
  const to = new Date(from);
  to.setMonth(to.getMonth() + 1);

  const rows = await prisma.dailyAssignment.findMany({
    where: { date: { gte: from, lt: to } },
    include: { contract: true, worker: true },
  });

  // 현장별 집계: 연인원(투입 건수), 총 인건비
  const siteMap = new Map<
    number,
    { contractId: number; siteName: string; builderName: string; headcount: number; totalWage: number }
  >();
  // 인원별 집계: 투입 일수, 정산 급여, 적용 일당(최소~최대)
  const workerMap = new Map<
    number,
    {
      workerId: number;
      name: string;
      teamName: string;
      days: number;
      totalWage: number;
      minWage: number;
      maxWage: number;
    }
  >();

  for (const r of rows) {
    const site =
      siteMap.get(r.contractId) ??
      {
        contractId: r.contractId,
        siteName: r.contract.siteName,
        builderName: r.contract.builderName,
        headcount: 0,
        totalWage: 0,
      };
    site.headcount += 1;
    site.totalWage += r.actualWage;
    siteMap.set(r.contractId, site);

    const w =
      workerMap.get(r.workerId) ??
      {
        workerId: r.workerId,
        name: r.worker.name,
        teamName: r.teamName ?? r.worker.teamName,
        days: 0,
        totalWage: 0,
        minWage: r.actualWage,
        maxWage: r.actualWage,
      };
    w.days += 1;
    w.totalWage += r.actualWage;
    w.minWage = Math.min(w.minWage, r.actualWage);
    w.maxWage = Math.max(w.maxWage, r.actualWage);
    workerMap.set(r.workerId, w);
  }

  const summary = Array.from(siteMap.values()).sort((a, b) => b.totalWage - a.totalWage);
  const byWorker = Array.from(workerMap.values()).sort((a, b) => b.totalWage - a.totalWage);
  const grand = {
    headcount: summary.reduce((s, x) => s + x.headcount, 0),
    totalWage: summary.reduce((s, x) => s + x.totalWage, 0),
    workerCount: byWorker.length,
  };
  return NextResponse.json({ month, summary, byWorker, grand });
}
