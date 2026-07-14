import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// 입찰 상세 + 견적 항목
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const bid = await prisma.bid.findUnique({
    where: { id: Number(params.id) },
    include: { items: { orderBy: { id: "asc" } } },
  });
  if (!bid) {
    return NextResponse.json({ error: "존재하지 않는 입찰입니다." }, { status: 404 });
  }
  return NextResponse.json(bid);
}

// 입찰 정보 수정
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const b = await req.json();
  const bid = await prisma.bid.update({
    where: { id: Number(params.id) },
    data: {
      builderName: b.builderName?.trim(),
      siteName: b.siteName?.trim(),
      startDate: b.startDate ? new Date(`${b.startDate}T00:00:00`) : null,
      endDate: b.endDate ? new Date(`${b.endDate}T00:00:00`) : null,
      dueDate: b.dueDate ? new Date(`${b.dueDate}T00:00:00`) : null,
    },
  });
  return NextResponse.json(bid);
}

// 입찰 삭제 (견적 항목 함께 삭제)
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  await prisma.bid.delete({ where: { id: Number(params.id) } });
  return NextResponse.json({ ok: true });
}
