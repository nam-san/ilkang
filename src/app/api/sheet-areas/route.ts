import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sheetArea } from "@/lib/sheetArea";

export const dynamic = "force-dynamic";

// 현장별 시트 면적 산출 목록 (이력)
export async function GET(req: NextRequest) {
  const contractId = Number(req.nextUrl.searchParams.get("contractId"));
  if (!contractId) {
    return NextResponse.json({ error: "contractId 필요" }, { status: 400 });
  }
  const items = await prisma.sheetAreaItem.findMany({
    where: { contractId },
    orderBy: [{ location: "asc" }, { sortOrder: "asc" }, { id: "asc" }],
  });
  return NextResponse.json(items);
}

function nums(b: Record<string, unknown>) {
  const n = (k: string, d = 0) => {
    const v = b[k];
    const x = typeof v === "string" ? parseFloat(v) : Number(v);
    return isFinite(x) ? x : d;
  };
  return {
    width: n("width"),
    widthFlange: n("widthFlange"),
    widthWing: n("widthWing"),
    height: n("height"),
    heightFlange: n("heightFlange"),
    heightWing: n("heightWing"),
    qty: n("qty", 1),
  };
}

// 항목 추가
export async function POST(req: NextRequest) {
  const b = await req.json();
  const contractId = Number(b.contractId);
  const location = (b.location ?? "").trim();
  if (!contractId || !location) {
    return NextResponse.json({ error: "현장과 공사 위치는 필수입니다." }, { status: 400 });
  }
  const v = nums(b);
  const last = await prisma.sheetAreaItem.count({ where: { contractId, location } });
  const item = await prisma.sheetAreaItem.create({
    data: {
      contractId,
      location,
      itemName: b.itemName?.trim() || null,
      ...v,
      area: sheetArea(v),
      sortOrder: last,
    },
  });
  return NextResponse.json(item, { status: 201 });
}
