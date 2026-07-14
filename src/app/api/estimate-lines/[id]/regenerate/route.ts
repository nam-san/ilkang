import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateLineComponents, recomputeLineTotal } from "@/lib/estimateServer";

export const dynamic = "force-dynamic";

// 부재 재생성 (창호유형 기본값 + 현재 라인 W/H로 다시 자동채움, 수동조정 초기화)
export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = Number(params.id);
  await generateLineComponents(id, true);
  const total = await recomputeLineTotal(id);
  const line = await prisma.estimateLine.findUnique({
    where: { id },
    include: { components: { orderBy: { sortOrder: "asc" } } },
  });
  return NextResponse.json({ ok: true, totalWeight: total, line });
}
