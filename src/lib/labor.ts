// 인건비 계산 공용 로직

/** 실제 지급 인건비 = 확정 단가 × (반일이면 0.5) */
export function payableWage(actualWage: number, halfDay: boolean): number {
  return (actualWage || 0) * (halfDay ? 0.5 : 1);
}

/** 투입 공수 (종일 1.0 / 반일 0.5) */
export function manDay(halfDay: boolean): number {
  return halfDay ? 0.5 : 1;
}
