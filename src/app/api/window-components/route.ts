import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// 부재 추가 (창호: 치수기반 M / SSD: EA·MT)
export async function POST(req: NextRequest) {
  const b = await req.json();
  if (!b.windowTypeId || !b.name?.trim()) {
    return NextResponse.json({ error: "windowTypeId와 부재명이 필요합니다." }, { status: 400 });
  }
  const count = await prisma.windowComponent.count({
    where: { windowTypeId: Number(b.windowTypeId) },
  });
  const unit = ["M", "EA", "MT"].includes(b.unit) ? b.unit : "M";
  const comp = await prisma.windowComponent.create({
    data: {
      windowTypeId: Number(b.windowTypeId),
      name: b.name.trim(),
      groupName: b.groupName?.trim() || null,
      unit,
      unitWeight: Number(b.unitWeight) || 0,
      unitQty: Number(b.unitQty) || 0,
      defaultCountW: Number(b.defaultCountW) || 0,
      defaultCountH: Number(b.defaultCountH) || 0,
      sortOrder: count,
    },
  });
  return NextResponse.json(comp, { status: 201 });
}
