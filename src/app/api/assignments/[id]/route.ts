import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// 당일 확정 단가 개별 수정
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const b = await req.json();
  const row = await prisma.dailyAssignment.update({
    where: { id: Number(params.id) },
    data: { actualWage: Number(b.actualWage) || 0 },
  });
  return NextResponse.json(row);
}

// 인원 배제(제거)
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  await prisma.dailyAssignment.delete({ where: { id: Number(params.id) } });
  return NextResponse.json({ ok: true });
}
