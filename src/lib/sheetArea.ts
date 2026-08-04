// 시트 면적 산출 계산 (서버·클라이언트 공용)

export type SheetAreaInput = {
  width: number; // 가로(mm)
  widthFlange: number; // 가로후렌지(mm)
  widthWing: number; // 가로날개(mm)
  height: number; // 세로(mm)
  heightFlange: number; // 세로후렌지(mm)
  heightWing: number; // 세로날개(mm)
  qty: number; // 개수
};

/**
 * 면적(㎡) = (가로 + 가로후렌지 + 가로날개) × (세로 + 세로후렌지 + 세로날개) × 개수 / 1,000,000
 */
export function sheetArea(i: SheetAreaInput): number {
  const w = (i.width || 0) + (i.widthFlange || 0) + (i.widthWing || 0);
  const h = (i.height || 0) + (i.heightFlange || 0) + (i.heightWing || 0);
  return (w * h * (i.qty || 0)) / 1_000_000;
}

/** 전개 폭/높이 (mm) — 화면 표시용 */
export function expandedSize(i: SheetAreaInput): { w: number; h: number } {
  return {
    w: (i.width || 0) + (i.widthFlange || 0) + (i.widthWing || 0),
    h: (i.height || 0) + (i.heightFlange || 0) + (i.heightWing || 0),
  };
}
