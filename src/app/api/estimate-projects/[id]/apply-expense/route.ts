import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * 경비 단가 일괄 적용: 경비단가 = ROUND(노무비단가 × 비율)
 * body: { ratio: number }  예) 0.24 → 노무비의 24%
 * 비율은 CostParam.expenseRatio 에 저장되어 다음 조회 시 유지된다.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const projectId = Number(params.id);
  const b = await req.json();
  const ratio = Number(b.ratio);
  if (!isFinite(ratio) || ratio < 0) {
    return NextResponse.json({ error: "비율을 올바르게 입력하세요." }, { status: 400 });
  }

  await prisma.costParam.upsert({
    where: { projectId },
    create: { projectId, expenseRatio: ratio },
    update: { expenseRatio: ratio },
  });

  const lines = await prisma.estimateLine.findMany({
    where: { projectId, isGroup: false },
    select: { id: true, laborUnitPrice: true },
  });
  let applied = 0;
  for (const l of lines) {
    const expense = Math.round((l.laborUnitPrice || 0) * ratio);
    await prisma.estimateLine.update({
      where: { id: l.id },
      data: { expenseUnitPrice: expense },
    });
    applied++;
  }
  return NextResponse.json({ ok: true, applied, ratio });
}
