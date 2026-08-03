// 창호 견적 - 서버측 DB 계산 오케스트레이션 (계산은 windowCalc의 순수함수 사용)
import { prisma } from "@/lib/prisma";
import {
  componentWeightByUnit,
  totalMaterialCost,
  installCost,
  totalLaborCost,
} from "@/lib/windowCalc";

/** 라인의 창호유형 부재들로 LineComponent를 생성(없을 때만). 라인 W/H + 부재 기본개수로 자동채움 */
export async function generateLineComponents(lineId: number, force = false) {
  const line = await prisma.estimateLine.findUnique({
    where: { id: lineId },
    include: { components: true, windowType: { include: { components: { orderBy: { sortOrder: "asc" } } } } },
  });
  if (!line || !line.windowType) return;

  if (force) {
    await prisma.lineComponent.deleteMany({ where: { estimateLineId: lineId } });
  } else if (line.components.length > 0) {
    return; // 이미 생성됨(수동조정 보존)
  }

  const w = line.widthMm ?? 0;
  const h = line.heightMm ?? 0;
  const data = line.windowType.components.map((c, idx) => {
    const unit = c.unit || "M";
    const qty = unit === "M" ? 0 : c.unitQty;
    const { lengthM, weightKg } = componentWeightByUnit({
      unit,
      unitWeight: c.unitWeight,
      qty,
      widthMm: w,
      countW: c.defaultCountW,
      heightMm: h,
      countH: c.defaultCountH,
    });
    return {
      estimateLineId: lineId,
      windowComponentId: c.id,
      compName: c.name,
      groupName: c.groupName,
      unit,
      unitWeight: c.unitWeight,
      qty,
      widthMm: w,
      countW: c.defaultCountW,
      heightMm: h,
      countH: c.defaultCountH,
      lengthM,
      weightKg,
      sortOrder: idx,
    };
  });
  if (data.length) await prisma.lineComponent.createMany({ data });
}

/** 라인 총중량 재계산 (부재 중량 합) 후 저장 */
export async function recomputeLineTotal(lineId: number): Promise<number> {
  const comps = await prisma.lineComponent.findMany({ where: { estimateLineId: lineId } });
  const total = comps.reduce((s, c) => s + c.weightKg, 0);
  await prisma.estimateLine.update({ where: { id: lineId }, data: { totalWeight: total } });
  return total;
}

/**
 * 비용 계산(Phase 2): 총자재비/시공비/총시공비 산출 + 단가 자동연동.
 * 수동조정(override)된 단가는 유지하고, 아니면 자동값으로 연동.
 */
export async function recomputeLineCosts(lineId: number) {
  const line = await prisma.estimateLine.findUnique({
    where: { id: lineId },
    include: { project: { include: { costParam: true } } },
  });
  if (!line || line.isGroup) return;
  const cp = line.project.costParam;
  const weight = line.totalWeight ?? 0;

  let barPrices: Record<string, number> = {};
  try {
    barPrices = cp?.barPrices ? JSON.parse(cp.barPrices) : {};
  } catch {
    barPrices = {};
  }
  // barType 미지정 시 일반바 → 첫 항목 순으로 기본
  const barKey = line.barType || (barPrices["일반바"] != null ? "일반바" : Object.keys(barPrices)[0]);
  const barPrice = (barKey ? barPrices[barKey] : 0) || 0;
  const wagePerKg = cp?.wagePerKg ?? 0;

  const matTotalCost = totalMaterialCost(barPrice, weight, line.hingeCost, line.screenCost);
  const installCostCalc = installCost(weight, wagePerKg);
  const laborTotalCost = totalLaborCost(installCostCalc, line.pjInstallCost);

  await prisma.estimateLine.update({
    where: { id: lineId },
    data: {
      matTotalCost,
      installCostCalc,
      laborTotalCost,
      // 자동연동 (수동조정 시 유지)
      ...(line.matOverride ? {} : { matUnitPrice: matTotalCost }),
      ...(line.laborOverride ? {} : { laborUnitPrice: laborTotalCost }),
    },
  });
}
