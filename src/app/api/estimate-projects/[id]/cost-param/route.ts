import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// 비용 파라미터 저장 (upsert)
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const projectId = Number(params.id);
  const b = await req.json();
  const barPrices = JSON.stringify(b.barPrices ?? {});
  const data = {
    barPrices,
    wagePerKg: Number(b.wagePerKg) || 0,
    hingeCost: Number(b.hingeCost) || 0,
    screenCost: Number(b.screenCost) || 0,
    pjInstallCost: Number(b.pjInstallCost) || 0,
  };
  const cp = await prisma.costParam.upsert({
    where: { projectId },
    create: { projectId, ...data },
    update: data,
  });
  return NextResponse.json(cp);
}
