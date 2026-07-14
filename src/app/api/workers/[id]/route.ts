import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const b = await req.json();
  const worker = await prisma.worker.update({
    where: { id: Number(params.id) },
    data: {
      name: b.name?.trim(),
      teamName: b.teamName?.trim(),
      dailyWage: Number(b.dailyWage) || 0,
      ...(typeof b.active === "boolean" ? { active: b.active } : {}),
    },
  });
  return NextResponse.json(worker);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  await prisma.worker.delete({ where: { id: Number(params.id) } });
  return NextResponse.json({ ok: true });
}
