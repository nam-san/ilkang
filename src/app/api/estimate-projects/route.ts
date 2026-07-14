import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// 공사(견적 프로젝트) 목록.
// 공사 생성은 견적 관리의 입찰 등록을 통해서만 가능 (POST /api/bids/{id}/estimate-project).
export async function GET() {
  const projects = await prisma.estimateProject.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { lines: true, windowTypes: true } } },
  });
  return NextResponse.json(projects);
}
