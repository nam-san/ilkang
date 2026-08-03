import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { componentWeightByUnit } from "@/lib/windowCalc";
import { recomputeLineTotal } from "@/lib/estimateServer";

export const dynamic = "force-dynamic";

// 부재 물량 수동 조정 (치수/개수/단위중량, SSD는 수량) → 길이·중량·라인 총중량 재계산
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = Number(params.id);
  const b = await req.json();
  const existing = await prisma.lineComponent.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "없음" }, { status: 404 });

  const unit = ["M", "EA", "MT"].includes(b.unit) ? b.unit : existing.unit;
  const compName = typeof b.compName === "string" && b.compName.trim() ? b.compName.trim() : existing.compName;
  const unitWeight = b.unitWeight != null ? Number(b.unitWeight) || 0 : existing.unitWeight;
  const qty = b.qty != null ? Number(b.qty) || 0 : existing.qty;
  const widthMm = b.widthMm != null ? Number(b.widthMm) || 0 : existing.widthMm;
  const countW = b.countW != null ? Number(b.countW) || 0 : existing.countW;
  const heightMm = b.heightMm != null ? Number(b.heightMm) || 0 : existing.heightMm;
  const countH = b.countH != null ? Number(b.countH) || 0 : existing.countH;

  const { lengthM, weightKg } = componentWeightByUnit({
    unit,
    unitWeight,
    qty,
    widthMm,
    countW,
    heightMm,
    countH,
  });

  const comp = await prisma.lineComponent.update({
    where: { id },
    data: { compName, unit, unitWeight, qty, widthMm, countW, heightMm, countH, lengthM, weightKg },
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
