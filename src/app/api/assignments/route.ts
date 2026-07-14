import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

function dayRange(dateStr: string) {
  const from = new Date(`${dateStr}T00:00:00`);
  const to = new Date(from);
  to.setDate(to.getDate() + 1);
  return { from, to };
}

// GET: 특정 현장의 하루(date=YYYY-MM-DD) 또는 한달(month=YYYY-MM) 투입 현황
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const contractId = Number(sp.get("contractId"));
  const date = sp.get("date");
  const month = sp.get("month");
  if (!contractId) {
    return NextResponse.json({ error: "contractId 필요" }, { status: 400 });
  }

  const where: Prisma.DailyAssignmentWhereInput = { contractId };
  if (date) {
    const { from, to } = dayRange(date);
    where.date = { gte: from, lt: to };
  } else if (month && /^\d{4}-\d{2}$/.test(month)) {
    const from = new Date(`${month}-01T00:00:00`);
    const to = new Date(from);
    to.setMonth(to.getMonth() + 1);
    where.date = { gte: from, lt: to };
  }

  const rows = await prisma.dailyAssignment.findMany({
    where,
    include: { worker: true },
    orderBy: [{ date: "asc" }, { id: "asc" }],
  });
  return NextResponse.json(rows);
}

// POST: 팀 전체 투입({teamName}) 또는 개별 인원 추가({workerId})
export async function POST(req: NextRequest) {
  const b = await req.json();
  const contractId = Number(b.contractId);
  const dateStr: string = b.date;
  if (!contractId || !dateStr) {
    return NextResponse.json(
      { error: "현장과 날짜를 선택하세요." },
      { status: 400 }
    );
  }
  const date = new Date(`${dateStr}T00:00:00`);
  const { from, to } = dayRange(dateStr);

  // 이미 해당 날짜에 배정된 workerId (중복 방지)
  const existing = await prisma.dailyAssignment.findMany({
    where: { contractId, date: { gte: from, lt: to } },
    select: { workerId: true },
  });
  const existingIds = new Set(existing.map((e) => e.workerId));

  let targets: { id: number; dailyWage: number; teamName: string }[] = [];

  if (b.teamName) {
    const team = await prisma.worker.findMany({
      where: { teamName: b.teamName, active: true },
    });
    targets = team.map((w) => ({
      id: w.id,
      dailyWage: w.dailyWage,
      teamName: w.teamName,
    }));
  } else if (b.workerId) {
    const w = await prisma.worker.findUnique({ where: { id: Number(b.workerId) } });
    if (w) targets = [{ id: w.id, dailyWage: w.dailyWage, teamName: w.teamName }];
  }

  const toCreate = targets.filter((t) => !existingIds.has(t.id));
  if (toCreate.length === 0) {
    return NextResponse.json(
      { error: "추가할 인원이 없습니다 (이미 배정되었거나 팀원이 없음)." },
      { status: 400 }
    );
  }

  await prisma.dailyAssignment.createMany({
    data: toCreate.map((t) => ({
      contractId,
      date,
      workerId: t.id,
      actualWage: t.dailyWage,
      teamName: t.teamName,
    })),
  });
  return NextResponse.json({ ok: true, added: toCreate.length }, { status: 201 });
}
