import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { warrantyEndYmd } from "@/lib/format";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const contract = await prisma.contract.findUnique({
    where: { id: Number(params.id) },
  });
  if (!contract) {
    return NextResponse.json({ error: "존재하지 않는 현장입니다." }, { status: 404 });
  }
  return NextResponse.json(contract);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const b = await req.json();
  const contract = await prisma.contract.update({
    where: { id: Number(params.id) },
    data: {
      siteName: b.siteName?.trim(),
      builderName: b.builderName?.trim(),
      startDate: b.startDate ? new Date(b.startDate) : null,
      endDate: b.endDate ? new Date(b.endDate) : null,
      contractAmount: Number(b.contractAmount) || 0,
      manager: b.manager?.trim() || null,
      // 하자보수기간: 준공일 기준 자동 3년 (고정)
      warrantyPeriod: warrantyEndYmd(b.endDate) || null,
    },
  });
  return NextResponse.json(contract);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  await prisma.contract.delete({ where: { id: Number(params.id) } });
  return NextResponse.json({ ok: true });
}
