import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// 공용 메모장은 단일 레코드(id=1)로 관리
async function getMemo() {
  let memo = await prisma.memo.findFirst();
  if (!memo) {
    memo = await prisma.memo.create({ data: { content: "" } });
  }
  return memo;
}

export async function GET() {
  const memo = await getMemo();
  return NextResponse.json(memo);
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  const memo = await getMemo();
  const updated = await prisma.memo.update({
    where: { id: memo.id },
    data: { content: body.content ?? "", updatedBy: body.updatedBy?.trim() || null },
  });
  return NextResponse.json(updated);
}
