import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// 입찰 목록 (연동된 견적산출 공사 + 라인 수 포함)
export async function GET() {
  const bids = await prisma.bid.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      estimateProject: { select: { id: true, _count: { select: { lines: true } } } },
    },
  });
  return NextResponse.json(bids);
}

// 입찰 등록
export async function POST(req: NextRequest) {
  const b = await req.json();
  if (!b.builderName?.trim() || !b.siteName?.trim()) {
    return NextResponse.json(
      { error: "건설사명과 현장명은 필수입니다." },
      { status: 400 }
    );
  }
  const bid = await prisma.bid.create({
    data: {
      builderName: b.builderName.trim(),
      siteName: b.siteName.trim(),
      startDate: b.startDate ? new Date(`${b.startDate}T00:00:00`) : null,
      endDate: b.endDate ? new Date(`${b.endDate}T00:00:00`) : null,
      dueDate: b.dueDate ? new Date(`${b.dueDate}T00:00:00`) : null,
    },
  });
  return NextResponse.json(bid, { status: 201 });
}
