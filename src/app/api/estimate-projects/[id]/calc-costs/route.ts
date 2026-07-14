import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { recomputeLineCosts } from "@/lib/estimateServer";

export const dynamic = "force-dynamic";

// 비용 계산: 총중량이 산출된 라인의 총자재비/시공비/총시공비 계산 + 단가 자동연동
export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const projectId = Number(params.id);
  const lines = await prisma.estimateLine.findMany({
    where: { projectId, isGroup: false, totalWeight: { not: null } },
    select: { id: true },
  });
  for (const l of lines) {
    await recomputeLineCosts(l.id);
  }
  const overrides = await prisma.estimateLine.count({
    where: { projectId, OR: [{ matOverride: true }, { laborOverride: true }] },
  });
  return NextResponse.json({ ok: true, calculated: lines.length, overrides });
}
