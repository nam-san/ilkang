import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// 팀원 목록 (팀별 정렬)
export async function GET() {
  const workers = await prisma.worker.findMany({
    orderBy: [{ teamName: "asc" }, { name: "asc" }],
  });
  return NextResponse.json(workers);
}

// 팀원 등록
export async function POST(req: NextRequest) {
  const b = await req.json();
  if (!b.name?.trim() || !b.teamName?.trim()) {
    return NextResponse.json(
      { error: "이름과 팀명은 필수입니다." },
      { status: 400 }
    );
  }
  const worker = await prisma.worker.create({
    data: {
      name: b.name.trim(),
      teamName: b.teamName.trim(),
      dailyWage: Number(b.dailyWage) || 0,
    },
  });
  return NextResponse.json(worker, { status: 201 });
}
