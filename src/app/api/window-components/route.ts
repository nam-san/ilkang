import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// 부재 추가
export async function POST(req: NextRequest) {
  const b = await req.json();
  if (!b.windowTypeId || !b.name?.trim()) {
    return NextResponse.json({ error: "windowTypeId와 부재명이 필요합니다." }, { status: 400 });
  }
  const count = await prisma.windowComponent.count({
    where: { windowTypeId: Number(b.windowTypeId) },
  });
  const comp = await prisma.windowComponent.create({
    data: {
      windowTypeId: Number(b.windowTypeId),
      name: b.name.trim(),
      unitWeight: Number(b.unitWeight) || 0,
      defaultCountW: Number(b.defaultCountW) || 0,
      defaultCountH: Number(b.defaultCountH) || 0,
      sortOrder: count,
    },
  });
  return NextResponse.json(comp, { status: 201 });
}
