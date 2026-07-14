import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// 프로젝트의 견적 라인 목록 (withComponents=1 이면 부재 포함)
export async function GET(req: NextRequest) {
  const projectId = Number(req.nextUrl.searchParams.get("projectId"));
  if (!projectId) {
    return NextResponse.json({ error: "projectId 필요" }, { status: 400 });
  }
  const withComponents = req.nextUrl.searchParams.get("withComponents") === "1";
  const lines = await prisma.estimateLine.findMany({
    where: { projectId },
    orderBy: { sortOrder: "asc" },
    include: withComponents
      ? { components: { orderBy: { sortOrder: "asc" } }, windowType: true }
      : { windowType: true },
  });
  return NextResponse.json(lines);
}
