import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const b = await req.json();
  const data: Record<string, unknown> = {};
  if (typeof b.name === "string") data.name = b.name.trim();
  if (typeof b.active === "boolean") data.active = b.active;
  if (typeof b.sortOrder === "number") data.sortOrder = b.sortOrder;
  const type = await prisma.windowType.update({ where: { id: Number(params.id) }, data });
  return NextResponse.json(type);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  await prisma.windowType.delete({ where: { id: Number(params.id) } });
  return NextResponse.json({ ok: true });
}
