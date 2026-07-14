import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// 입찰 → 창호 견적산출 공사 연동 (없으면 생성, 있으면 반환)
export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const bidId = Number(params.id);
  const bid = await prisma.bid.findUnique({ where: { id: bidId } });
  if (!bid) {
    return NextResponse.json({ error: "존재하지 않는 입찰입니다." }, { status: 404 });
  }

  const existing = await prisma.estimateProject.findUnique({ where: { bidId } });
  if (existing) {
    return NextResponse.json({ projectId: existing.id, created: false });
  }

  const project = await prisma.estimateProject.create({
    data: {
      bidId,
      siteName: bid.siteName,
      builderName: bid.builderName,
      workType: "AL창호공사",
      costParam: { create: {} },
    },
  });
  return NextResponse.json({ projectId: project.id, created: true }, { status: 201 });
}
