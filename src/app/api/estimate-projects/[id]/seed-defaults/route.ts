import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { DEFAULT_WINDOW_TYPES, DEFAULT_COST_PARAM } from "@/lib/windowDefaults";

export const dynamic = "force-dynamic";

// 기본 기준값(창호유형·부재·단위중량 + 비용파라미터) 채우기
export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const projectId = Number(params.id);

  // 이미 존재하는 유형명은 건너뜀 (중복 생성 방지 — 재실행 안전)
  const existing = await prisma.windowType.findMany({
    where: { projectId },
    select: { name: true },
  });
  const existingNames = new Set(existing.map((t) => t.name));

  let added = 0;
  for (let i = 0; i < DEFAULT_WINDOW_TYPES.length; i++) {
    const t = DEFAULT_WINDOW_TYPES[i];
    if (existingNames.has(t.name)) continue;
    added++;
    await prisma.windowType.create({
      data: {
        projectId,
        name: t.name,
        sortOrder: i,
        components: {
          create: t.components.map((c, idx) => ({
            name: c.name,
            unitWeight: c.unitWeight,
            defaultCountW: c.defaultCountW,
            defaultCountH: c.defaultCountH,
            sortOrder: idx,
          })),
        },
      },
    });
  }

  await prisma.costParam.upsert({
    where: { projectId },
    create: {
      projectId,
      barPrices: JSON.stringify(DEFAULT_COST_PARAM.barPrices),
      wagePerKg: DEFAULT_COST_PARAM.wagePerKg,
      hingeCost: DEFAULT_COST_PARAM.hingeCost,
      screenCost: DEFAULT_COST_PARAM.screenCost,
      pjInstallCost: DEFAULT_COST_PARAM.pjInstallCost,
    },
    update: {
      barPrices: JSON.stringify(DEFAULT_COST_PARAM.barPrices),
      wagePerKg: DEFAULT_COST_PARAM.wagePerKg,
    },
  });

  return NextResponse.json({ ok: true, added, skipped: DEFAULT_WINDOW_TYPES.length - added });
}
