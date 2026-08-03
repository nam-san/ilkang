import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const b = await req.json();
  const data: Record<string, unknown> = {};
  if ("name" in b) data.name = b.name?.trim();
  if ("groupName" in b) data.groupName = b.groupName?.trim() || null;
  if ("unit" in b && ["M", "EA", "MT"].includes(b.unit)) data.unit = b.unit;
  if ("unitWeight" in b) data.unitWeight = Number(b.unitWeight) || 0;
  if ("unitQty" in b) data.unitQty = Number(b.unitQty) || 0;
  if ("defaultCountW" in b) data.defaultCountW = Number(b.defaultCountW) || 0;
  if ("defaultCountH" in b) data.defaultCountH = Number(b.defaultCountH) || 0;

  const comp = await prisma.windowComponent.update({
    where: { id: Number(params.id) },
    data,
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
