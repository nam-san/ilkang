// 캐노피 산출 서버 헬퍼 — 저장 시 공용 계산 모듈로 재검증하여 스냅샷 저장
import { prisma } from "@/lib/prisma";
import { calcCanopyRow, type SheetPriceTable, type PipePriceTable } from "@/lib/canopy";

export async function loadPriceTables(): Promise<{
  sheetTable: SheetPriceTable;
  pipeTable: PipePriceTable;
}> {
  const [sheet, pipe] = await Promise.all([
    prisma.canopySheetPrice.findMany(),
    prisma.canopyPipePrice.findMany(),
  ]);
  const sheetTable: SheetPriceTable = {};
  for (const s of sheet) (sheetTable[s.sheetType] ??= {})[s.coating] = s.unitPrice;
  const pipeTable: PipePriceTable = {};
  for (const p of pipe) (pipeTable[p.spec] ??= {})[p.thickness] = p.unitPrice;
  return { sheetTable, pipeTable };
}

export type ItemInput = {
  w?: unknown;
  h?: unknown;
  l?: unknown;
  sheetType?: string | null;
  coating?: string | null;
  pipeSpec?: string | null;
  pipeThickness?: string | null;
};

const num = (v: unknown) => {
  const n = typeof v === "string" ? parseFloat(v) : Number(v);
  return isFinite(n) ? n : 0;
};

/** 클라이언트가 보낸 항목을 서버에서 재계산하여 저장용 데이터로 변환 */
export function buildItemData(
  items: ItemInput[],
  sheetTable: SheetPriceTable,
  pipeTable: PipePriceTable
) {
  return items.map((it, idx) => {
    const input = {
      w: num(it.w),
      h: num(it.h),
      l: num(it.l),
      sheetType: it.sheetType || null,
      coating: it.coating || null,
      pipeSpec: it.pipeSpec || null,
      pipeThickness: it.pipeThickness || null,
    };
    const r = calcCanopyRow(input, sheetTable, pipeTable);
    return {
      seq: idx,
      w: input.w,
      h: input.h,
      l: input.l,
      sheetType: input.sheetType,
      coating: input.coating,
      pipeSpec: input.pipeSpec,
      pipeThickness: input.pipeThickness,
      areaM2: r.areaM2,
      pipeQty: r.pipeQty,
      sheetUnitPrice: r.sheetUnitPrice,
      pipeUnitPrice: r.pipeUnitPrice,
      sheetAmount: r.sheetAmount,
      pipeAmount: r.pipeAmount,
      totalAmount: r.totalAmount,
      unsupported: r.unsupported,
    };
  });
}
