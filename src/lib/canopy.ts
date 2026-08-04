// 캐노피 면적·금액 산출 공용 계산 모듈 (프론트/백엔드 공용 · 단일 소스)
//
// 엑셀 원본 수식을 이식하되 아래 2가지 버그를 수정했다.
//  1) 시트금액 INDEX 행/열 인자가 뒤바뀌어 잘못된 단가를 조회 → [시트두께][코팅] 순서로 정정
//  2) IFS(L<6000 …, L>6000 …) 가 L=6000 에서 #N/A → L <= 6000 으로 경계를 닫음

export type Coating = "2코팅" | "3코팅";

/** 시트 단가표: { "AL P/N 2.0T": { "2코팅": 70500, "3코팅": 73000 }, ... } */
export type SheetPriceTable = Record<string, Partial<Record<string, number>>>;
/** 파이프 단가표: { "50*50 HGI": { "2T": 18842, ... } } — 미취급 조합은 값 없음(null) */
export type PipePriceTable = Record<string, Partial<Record<string, number | null>>>;

export type CanopyInput = {
  w: number; // 폭 (mm)
  h: number; // 높이 (mm)
  l: number; // 길이 (mm)
  sheetType?: string | null;
  coating?: string | null;
  pipeSpec?: string | null;
  pipeThickness?: string | null;
};

export type CanopyResult = {
  areaM2: number; // 면적 (소수 2자리)
  pipeQty: number; // 각파이프 본수 (정수)
  sheetUnitPrice: number | null; // 적용 시트 단가
  pipeUnitPrice: number | null; // 적용 파이프 단가
  sheetAmount: number | null; // 시트금액 (원)
  pipeAmount: number | null; // 각파이프금액 (원)
  totalAmount: number | null; // 합계 (원)
  unsupported: boolean; // 미취급 조합 (선택했으나 단가표에 없음)
};

/** 면적(㎡) = ROUND((W×2 + H) × L / 1,000,000, 2)
 *  (부동소수 오차 방지를 위해 정수 영역에서 반올림) */
export function canopyArea(w: number, h: number, l: number): number {
  const W = Number(w) || 0;
  const H = Number(h) || 0;
  const L = Number(l) || 0;
  if (W <= 0 || H <= 0 || L <= 0) return 0;
  return Math.round(((W * 2 + H) * L) / 10000) / 100;
}

/** 각파이프 본수 = ROUNDUP(((W×(INT(L/1000)+2) + L×2) × 2) / 6000) + (L ≤ 6000 ? 1 : 2) */
export function canopyPipeQty(w: number, l: number): number {
  const W = Number(w) || 0;
  const L = Number(l) || 0;
  if (W <= 0 || L <= 0) return 0;
  const base = (W * (Math.floor(L / 1000) + 2) + L * 2) * 2;
  return Math.ceil(base / 6000) + (L <= 6000 ? 1 : 2);
}

/** 단가표 조회 (없으면 null = 미취급) */
export function findSheetPrice(
  table: SheetPriceTable,
  sheetType?: string | null,
  coating?: string | null
): number | null {
  if (!sheetType || !coating) return null;
  const v = table[sheetType]?.[coating];
  return typeof v === "number" ? v : null;
}

export function findPipePrice(
  table: PipePriceTable,
  spec?: string | null,
  thickness?: string | null
): number | null {
  if (!spec || !thickness) return null;
  const v = table[spec]?.[thickness];
  return typeof v === "number" ? v : null;
}

/** 한 행(캐노피 항목) 전체 계산 */
export function calcCanopyRow(
  input: CanopyInput,
  sheetTable: SheetPriceTable,
  pipeTable: PipePriceTable
): CanopyResult {
  const areaM2 = canopyArea(input.w, input.h, input.l);
  const pipeQty = canopyPipeQty(input.w, input.l);

  const sheetSelected = !!input.sheetType && !!input.coating;
  const pipeSelected = !!input.pipeSpec && !!input.pipeThickness;

  const sheetUnitPrice = findSheetPrice(sheetTable, input.sheetType, input.coating);
  const pipeUnitPrice = findPipePrice(pipeTable, input.pipeSpec, input.pipeThickness);

  // 선택했는데 단가표에 없으면 미취급 조합
  const unsupported =
    (sheetSelected && sheetUnitPrice === null) || (pipeSelected && pipeUnitPrice === null);

  const sheetAmount = sheetUnitPrice !== null ? Math.round(sheetUnitPrice * areaM2) : null;
  const pipeAmount = pipeUnitPrice !== null ? Math.round(pipeUnitPrice * pipeQty) : null;
  const totalAmount =
    sheetAmount === null && pipeAmount === null ? null : (sheetAmount ?? 0) + (pipeAmount ?? 0);

  return {
    areaM2,
    pipeQty,
    sheetUnitPrice,
    pipeUnitPrice,
    sheetAmount,
    pipeAmount,
    totalAmount,
    unsupported,
  };
}

/** 여러 행 합계 (미취급 조합은 금액 합계에서 제외) */
export function sumCanopyRows(results: CanopyResult[]) {
  let area = 0,
    qty = 0,
    sheet = 0,
    pipe = 0,
    total = 0,
    unsupportedCount = 0;
  for (const r of results) {
    area += r.areaM2;
    qty += r.pipeQty;
    if (r.unsupported) {
      unsupportedCount++;
      continue; // 금액 합계에서 제외
    }
    sheet += r.sheetAmount ?? 0;
    pipe += r.pipeAmount ?? 0;
    total += r.totalAmount ?? 0;
  }
  return {
    areaM2: Math.round(area * 100) / 100,
    pipeQty: qty,
    sheetAmount: sheet,
    pipeAmount: pipe,
    totalAmount: total,
    unsupportedCount,
  };
}
