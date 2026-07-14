import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// 업체 정보 수정
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const b = await req.json();
  const row = await prisma.subcontractorCompany.update({
    where: { id: Number(params.id) },
    data: {
      name: b.name?.trim(),
      bizNumber: b.bizNumber?.trim() || null,
      ceo: b.ceo?.trim() || null,
      phone: b.phone?.trim() || null,
      email: b.email?.trim() || null,
      category: b.category?.trim() || null,
      address: b.address?.trim() || null,
      note: b.note?.trim() || null,
    },
  });
  return NextResponse.json(row);
}

// 업체 삭제
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  await prisma.subcontractorCompany.delete({ where: { id: Number(params.id) } });
  return NextResponse.json({ ok: true });
}
