import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// 견적 항목 수정
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const b = await req.json();
  const item = await prisma.estimateItem.update({
    where: { id: Number(params.id) },
    data: {
      itemName: b.itemName?.trim(),
      spec: b.spec?.trim() || null,
      quantity: Number(b.quantity) || 0,
      unit: b.unit?.trim() || null,
      unitPrice:
        b.unitPrice === "" || b.unitPrice === null || b.unitPrice === undefined
          ? null
          : Number(b.unitPrice),
    },
  });
  return NextResponse.json(item);
}

// 견적 항목 삭제
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  await prisma.estimateItem.delete({ where: { id: Number(params.id) } });
  return NextResponse.json({ ok: true });
}
