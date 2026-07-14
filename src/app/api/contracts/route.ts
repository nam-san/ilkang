import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { warrantyEndYmd } from "@/lib/format";

export const dynamic = "force-dynamic";

// 수주내역 목록 (연도별/건설사별 필터)
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const year = sp.get("year"); // 예: "2026"
  const yearBy = sp.get("yearBy") || "end"; // "start" | "end"
  const builder = sp.get("builder");

  const where: Prisma.ContractWhereInput = {};
  if (builder) where.builderName = builder;
  if (year && /^\d{4}$/.test(year)) {
    const from = new Date(`${year}-01-01T00:00:00`);
    const to = new Date(`${Number(year) + 1}-01-01T00:00:00`);
    const field = yearBy === "start" ? "startDate" : "endDate";
    where[field] = { gte: from, lt: to };
  }

  const contracts = await prisma.contract.findMany({
    where,
    orderBy: { startDate: "desc" },
  });
  return NextResponse.json(contracts);
}

// 수주내역 등록
export async function POST(req: NextRequest) {
  const b = await req.json();
  if (!b.siteName?.trim() || !b.builderName?.trim()) {
    return NextResponse.json(
      { error: "현장명과 건설사는 필수입니다." },
      { status: 400 }
    );
  }
  const contract = await prisma.contract.create({
    data: {
      siteName: b.siteName.trim(),
      builderName: b.builderName.trim(),
      startDate: b.startDate ? new Date(b.startDate) : null,
      endDate: b.endDate ? new Date(b.endDate) : null,
      contractAmount: Number(b.contractAmount) || 0,
      manager: b.manager?.trim() || null,
      // 하자보수기간: 준공일 기준 자동 3년 (고정)
      warrantyPeriod: warrantyEndYmd(b.endDate) || null,
    },
  });
  return NextResponse.json(contract, { status: 201 });
}
