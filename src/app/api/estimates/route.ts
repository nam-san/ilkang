import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// 특정 입찰의 견적 항목 목록 (bidId 필수)
export async function GET(req: NextRequest) {
  const bidId = Number(req.nextUrl.searchParams.get("bidId"));
  if (!bidId) {
    return NextResponse.json({ error: "bidId 필요" }, { status: 400 });
  }
  const items = await prisma.estimateItem.findMany({
    where: { bidId },
    orderBy: { id: "asc" },
  });
  return NextResponse.json(items);
}

// 견적 항목 단건 추가
export async function POST(req: NextRequest) {
  const b = await req.json();
  const bidId = Number(b.bidId);
  if (!bidId || !b.itemName?.trim()) {
    return NextResponse.json(
      { error: "입찰과 품명은 필수입니다." },
      { status: 400 }
    );
  }
  const item = await prisma.estimateItem.create({
    data: {
      bidId,
      itemName: b.itemName.trim(),
      spec: b.spec?.trim() || null,
      quantity: Number(b.quantity) || 0,
      unit: b.unit?.trim() || null,
      unitPrice:
        b.unitPrice === "" || b.unitPrice === null || b.unitPrice === undefined
          ? null
          : Number(b.unitPrice),
    },
  });
  return NextResponse.json(item, { status: 201 });
}
