import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const b = await req.json();
  const comp = await prisma.windowComponent.update({
    where: { id: Number(params.id) },
    data: {
      name: b.name?.trim(),
      unitWeight: Number(b.unitWeight) || 0,
      defaultCountW: Number(b.defaultCountW) || 0,
      defaultCountH: Number(b.defaultCountH) || 0,
    },
  });
  return NextResponse.json(comp);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  await prisma.windowComponent.delete({ where: { id: Number(params.id) } });
  return NextResponse.json({ ok: true });
}
