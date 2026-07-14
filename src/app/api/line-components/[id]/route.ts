import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { componentLengthM, componentWeightKg } from "@/lib/windowCalc";
import { recomputeLineTotal } from "@/lib/estimateServer";

export const dynamic = "force-dynamic";

// 부재 물량 수동 조정 (W/개수/H/개수/단위중량) → 길이·중량·라인 총중량 재계산
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = Number(params.id);
  const b = await req.json();
  const widthMm = Number(b.widthMm) || 0;
  const countW = Number(b.countW) || 0;
  const heightMm = Number(b.heightMm) || 0;
  const countH = Number(b.countH) || 0;
  const unitWeight = b.unitWeight != null ? Number(b.unitWeight) || 0 : undefined;

  const existing = await prisma.lineComponent.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "없음" }, { status: 404 });
  const uw = unitWeight ?? existing.unitWeight;

  const lengthM = componentLengthM(widthMm, countW, heightMm, countH);
  const weightKg = componentWeightKg(lengthM, uw);

  const comp = await prisma.lineComponent.update({
    where: { id },
    data: { widthMm, countW, heightMm, countH, unitWeight: uw, lengthM, weightKg },
  });
  const total = await recomputeLineTotal(existing.estimateLineId);
  return NextResponse.json({ component: comp, totalWeight: total });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const comp = await prisma.lineComponent.findUnique({ where: { id: Number(params.id) } });
  await prisma.lineComponent.delete({ where: { id: Number(params.id) } });
  if (comp) await recomputeLineTotal(comp.estimateLineId);
  return NextResponse.json({ ok: true });
}
