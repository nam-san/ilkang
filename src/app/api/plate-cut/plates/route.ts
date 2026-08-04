import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// 원판 기준값 목록
export async function GET() {
  const rows = await prisma.plateSpec.findMany({
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
  });
  return NextResponse.json(rows);
}

// 원판 추가
export async function POST(req: NextRequest) {
  const b = await req.json();
  const name = (b.name ?? "").trim();
  const width = Number(b.width) || 0;
  const height = Number(b.height) || 0;
  if (!name || width <= 0 || height <= 0) {
    return NextResponse.json({ error: "원판명·가로·세로를 입력하세요." }, { status: 400 });
  }
  const dup = await prisma.plateSpec.findUnique({ where: { name } });
  if (dup) return NextResponse.json({ error: "이미 있는 원판명입니다." }, { status: 400 });

  const count = await prisma.plateSpec.count();
  const plate = await prisma.plateSpec.create({
    data: { name, width, height, sortOrder: count },
  });
  return NextResponse.json(plate, { status: 201 });
}
