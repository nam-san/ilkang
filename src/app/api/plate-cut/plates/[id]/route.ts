import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// 원판 수정
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = Number(params.id);
  const b = await req.json();
  const data: Record<string, unknown> = {};
  if (typeof b.name === "string" && b.name.trim()) data.name = b.name.trim();
  if (b.width != null && Number(b.width) > 0) data.width = Number(b.width);
  if (b.height != null && Number(b.height) > 0) data.height = Number(b.height);
  if (typeof b.active === "boolean") data.active = b.active;

  try {
    const plate = await prisma.plateSpec.update({ where: { id }, data });
    return NextResponse.json(plate);
  } catch {
    return NextResponse.json({ error: "이미 있는 원판명이거나 수정할 수 없습니다." }, { status: 400 });
  }
}

// 원판 삭제
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  await prisma.plateSpec.delete({ where: { id: Number(params.id) } });
  return NextResponse.json({ ok: true });
}
