import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { componentWeightByUnit } from "@/lib/windowCalc";
import { recomputeLineTotal } from "@/lib/estimateServer";

export const dynamic = "force-dynamic";

// 라인에 부재 수동 추가 (옵션 부재 등)
export async function POST(req: NextRequest) {
  const b = await req.json();
  const estimateLineId = Number(b.estimateLineId);
  if (!estimateLineId || !b.compName?.trim()) {
    return NextResponse.json({ error: "라인과 부재명이 필요합니다." }, { status: 400 });
  }
  const line = await prisma.estimateLine.findUnique({ where: { id: estimateLineId } });
  if (!line) return NextResponse.json({ error: "라인 없음" }, { status: 404 });

  const unit = ["M", "EA", "MT"].includes(b.unit) ? b.unit : "M";
  const unitWeight = Number(b.unitWeight) || 0;
  const qty = Number(b.qty) || 0;
  // 치수 미지정 시 라인의 W/H 사용
  const widthMm = b.widthMm != null && b.widthMm !== "" ? Number(b.widthMm) : line.widthMm ?? 0;
  const heightMm = b.heightMm != null && b.heightMm !== "" ? Number(b.heightMm) : line.heightMm ?? 0;
  const countW = Number(b.countW) || 0;
  const countH = Number(b.countH) || 0;

  const { lengthM, weightKg } = componentWeightByUnit({
    unit,
    unitWeight,
    qty,
    widthMm,
    countW,
    heightMm,
    countH,
  });

  const last = await prisma.lineComponent.count({ where: { estimateLineId } });
  const comp = await prisma.lineComponent.create({
    data: {
      estimateLineId,
      windowComponentId: null, // 수동 추가
      compName: b.compName.trim(),
      groupName: b.groupName?.trim() || null,
      unit,
      unitWeight,
      qty,
      widthMm,
      countW,
      heightMm,
      countH,
      lengthM,
      weightKg,
      sortOrder: last,
    },
  });
  const total = await recomputeLineTotal(estimateLineId);
  return NextResponse.json({ component: comp, totalWeight: total }, { status: 201 });
}
