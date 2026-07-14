import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// 창호유형 추가
export async function POST(req: NextRequest) {
  const b = await req.json();
  if (!b.projectId || !b.name?.trim()) {
    return NextResponse.json({ error: "projectId와 유형명이 필요합니다." }, { status: 400 });
  }
  const count = await prisma.windowType.count({ where: { projectId: Number(b.projectId) } });
  const type = await prisma.windowType.create({
    data: {
      projectId: Number(b.projectId),
      name: b.name.trim(),
      sortOrder: count,
    },
  });
  return NextResponse.json(type, { status: 201 });
}
