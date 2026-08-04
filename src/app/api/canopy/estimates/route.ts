import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { loadPriceTables, buildItemData } from "@/lib/canopyServer";

export const dynamic = "force-dynamic";

// 현장별 캐노피 산출서 목록 (이력)
export async function GET(req: NextRequest) {
  const contractId = Number(req.nextUrl.searchParams.get("contractId"));
  if (!contractId) {
    return NextResponse.json({ error: "contractId 필요" }, { status: 400 });
  }
  const list = await prisma.canopyEstimate.findMany({
    where: { contractId },
    orderBy: { createdAt: "desc" },
    include: { items: { orderBy: { seq: "asc" } } },
  });
  // 목록용 요약 (합계는 미취급 제외)
  const rows = list.map((e) => {
    const ok = e.items.filter((i) => !i.unsupported);
    return {
      id: e.id,
      name: e.name,
      note: e.note,
      createdAt: e.createdAt,
      updatedAt: e.updatedAt,
      itemCount: e.items.length,
      areaM2: Math.round(e.items.reduce((s, i) => s + i.areaM2, 0) * 100) / 100,
      pipeQty: e.items.reduce((s, i) => s + i.pipeQty, 0),
      totalAmount: ok.reduce((s, i) => s + (i.totalAmount ?? 0), 0),
      unsupportedCount: e.items.length - ok.length,
    };
  });
  return NextResponse.json(rows);
}

// 산출서 저장 (신규)
export async function POST(req: NextRequest) {
  const b = await req.json();
  const contractId = Number(b.contractId);
  const name = (b.name ?? "").trim();
  if (!contractId || !name) {
    return NextResponse.json({ error: "현장과 산출서 이름은 필수입니다." }, { status: 400 });
  }
  const items = Array.isArray(b.items) ? b.items : [];
  if (items.length === 0) {
    return NextResponse.json({ error: "산출 항목이 없습니다." }, { status: 400 });
  }

  const { sheetTable, pipeTable } = await loadPriceTables();
  const data = buildItemData(items, sheetTable, pipeTable); // 서버 재검증

  const created = await prisma.canopyEstimate.create({
    data: {
      contractId,
      name,
      note: b.note?.trim() || null,
      createdBy: b.createdBy?.trim() || null,
      items: { create: data },
    },
    include: { items: { orderBy: { seq: "asc" } } },
  });
  return NextResponse.json(created, { status: 201 });
}
