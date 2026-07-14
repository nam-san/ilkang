import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

// 하도급 견적 목록 / 품명 검색 (q=품명)
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim();
  const where: Prisma.SubcontractorEstimateWhereInput = q
    ? { itemName: { contains: q } }
    : {};
  const rows = await prisma.subcontractorEstimate.findMany({
    where,
    orderBy: { date: "desc" },
  });
  return NextResponse.json(rows);
}

// 하도급 견적 등록
export async function POST(req: NextRequest) {
  const b = await req.json();
  if (!b.companyName?.trim() || !b.itemName?.trim() || !b.date) {
    return NextResponse.json(
      { error: "날짜, 업체명, 품명은 필수입니다." },
      { status: 400 }
    );
  }
  const row = await prisma.subcontractorEstimate.create({
    data: {
      date: new Date(`${b.date}T00:00:00`),
      companyName: b.companyName.trim(),
      itemName: b.itemName.trim(),
      quantity: Number(b.quantity) || 0,
      unitPrice: Number(b.unitPrice) || 0,
      note: b.note?.trim() || null,
    },
  });
  return NextResponse.json(row, { status: 201 });
}
