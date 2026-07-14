import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateLineComponents, recomputeLineTotal } from "@/lib/estimateServer";

export const dynamic = "force-dynamic";

// 자재 산출: 창호유형이 지정된 라인의 부재 물량 생성(없을 때) + 총중량 재계산
export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const projectId = Number(params.id);
  const lines = await prisma.estimateLine.findMany({
    where: { projectId, isGroup: false, windowTypeId: { not: null } },
    select: { id: true },
  });

  for (const l of lines) {
    await generateLineComponents(l.id); // 없을 때만 생성 (수동조정 보존)
    await recomputeLineTotal(l.id);
  }

  const calculated = lines.length;
  const noType = await prisma.estimateLine.count({
    where: { projectId, isGroup: false, windowTypeId: null },
  });
  return NextResponse.json({ ok: true, calculated, noTypeLines: noType });
}
