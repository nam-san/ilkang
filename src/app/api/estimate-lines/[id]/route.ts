import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateLineComponents, recomputeLineTotal, recomputeLineCosts } from "@/lib/estimateServer";

export const dynamic = "force-dynamic";

// 라인 수정 (창호유형 지정, 규격 파싱값 수동보정, 단가 등)
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = Number(params.id);
  const b = await req.json();

  const prev = await prisma.estimateLine.findUnique({ where: { id } });
  if (!prev) return NextResponse.json({ error: "없음" }, { status: 404 });

  const data: Record<string, unknown> = {};
  if ("itemName" in b) data.itemName = String(b.itemName).trim();
  if ("spec" in b) data.spec = b.spec?.trim() || null;
  if ("unit" in b) data.unit = b.unit?.trim() || null;
  if ("quantity" in b) data.quantity = Number(b.quantity) || 0;
  if ("matUnitPrice" in b) data.matUnitPrice = Number(b.matUnitPrice) || 0;
  if ("laborUnitPrice" in b) data.laborUnitPrice = Number(b.laborUnitPrice) || 0;
  if ("expenseUnitPrice" in b) data.expenseUnitPrice = Number(b.expenseUnitPrice) || 0;
  if ("note" in b) data.note = b.note?.trim() || null;
  if ("widthMm" in b) data.widthMm = b.widthMm === "" || b.widthMm == null ? null : Number(b.widthMm);
  if ("heightMm" in b) data.heightMm = b.heightMm === "" || b.heightMm == null ? null : Number(b.heightMm);
  if ("widthMm" in b || "heightMm" in b) data.parseWarning = false; // 수동보정 시 경고 해제
  if ("windowTypeId" in b)
    data.windowTypeId = b.windowTypeId == null || b.windowTypeId === "" ? null : Number(b.windowTypeId);

  // ── 비용 입력 (Phase 2) ──
  let costInputChanged = false;
  if ("barType" in b) { data.barType = b.barType || null; costInputChanged = true; }
  if ("hingeCost" in b) { data.hingeCost = Number(b.hingeCost) || 0; costInputChanged = true; }
  if ("screenCost" in b) { data.screenCost = Number(b.screenCost) || 0; costInputChanged = true; }
  if ("pjInstallCost" in b) { data.pjInstallCost = Number(b.pjInstallCost) || 0; costInputChanged = true; }
  if ("expenseUnitPrice" in b) data.expenseUnitPrice = Number(b.expenseUnitPrice) || 0;

  // 단가 수동조정 / 자동복원
  if ("matUnitPrice" in b) {
    data.matUnitPrice = Number(b.matUnitPrice) || 0;
    data.matOverride = true;
  }
  if (b.matOverride === false) {
    data.matOverride = false;
    if (prev.matTotalCost != null) data.matUnitPrice = prev.matTotalCost;
  }
  if ("laborUnitPrice" in b) {
    data.laborUnitPrice = Number(b.laborUnitPrice) || 0;
    data.laborOverride = true;
  }
  if (b.laborOverride === false) {
    data.laborOverride = false;
    if (prev.laborTotalCost != null) data.laborUnitPrice = prev.laborTotalCost;
  }

  const line = await prisma.estimateLine.update({ where: { id }, data });

  // 비용 입력이 바뀌면 총자재비/시공비 재계산 (+ 미오버라이드 단가 연동)
  if (costInputChanged) {
    await recomputeLineCosts(id);
  }

  // 창호유형이 바뀌면 부재 재생성
  if ("windowTypeId" in b && line.windowTypeId !== prev.windowTypeId) {
    if (line.windowTypeId) {
      await generateLineComponents(id, true);
      await recomputeLineTotal(id);
    } else {
      await prisma.lineComponent.deleteMany({ where: { estimateLineId: id } });
      await prisma.estimateLine.update({ where: { id }, data: { totalWeight: null } });
    }
  }

  const fresh = await prisma.estimateLine.findUnique({
    where: { id },
    include: { components: { orderBy: { sortOrder: "asc" } }, windowType: true },
  });
  return NextResponse.json(fresh);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  await prisma.estimateLine.delete({ where: { id: Number(params.id) } });
  return NextResponse.json({ ok: true });
}
