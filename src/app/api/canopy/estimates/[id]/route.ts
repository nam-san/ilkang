import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { loadPriceTables, buildItemData } from "@/lib/canopyServer";

export const dynamic = "force-dynamic";

// 산출서 불러오기
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const est = await prisma.canopyEstimate.findUnique({
    where: { id: Number(params.id) },
    include: { items: { orderBy: { seq: "asc" } }, contract: true },
  });
  if (!est) return NextResponse.json({ error: "산출서 없음" }, { status: 404 });
  return NextResponse.json(est);
}

// 산출서 수정 (항목 전체 교체 + 서버 재계산)
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = Number(params.id);
  const b = await req.json();
  const exists = await prisma.canopyEstimate.findUnique({ where: { id } });
  if (!exists) return NextResponse.json({ error: "산출서 없음" }, { status: 404 });

  const items = Array.isArray(b.items) ? b.items : [];
  const { sheetTable, pipeTable } = await loadPriceTables();
  const data = buildItemData(items, sheetTable, pipeTable);

  await prisma.canopyEstimateItem.deleteMany({ where: { estimateId: id } });
  const updated = await prisma.canopyEstimate.update({
    where: { id },
    data: {
      name: typeof b.name === "string" && b.name.trim() ? b.name.trim() : exists.name,
      note: "note" in b ? b.note?.trim() || null : exists.note,
      items: { create: data },
    },
    include: { items: { orderBy: { seq: "asc" } } },
  });
  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  await prisma.canopyEstimate.delete({ where: { id: Number(params.id) } });
  return NextResponse.json({ ok: true });
}
