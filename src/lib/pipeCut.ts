// 파이프 절단 최적화 (1차원 커팅 스톡 / 빈 패킹) — 프론트·백엔드 공용 단일 모듈
//
// 손실 모델: 절단 1회마다 톱날 두께(kerf)만큼 손실이 발생한다.
//   원자재 사용량 = Σ(절단 길이) + (절단 개수 × 날두께)
//   잔여          = 원자재 길이 − 사용량
// 배치 알고리즘: FFD(First Fit Decreasing, 내림차순 우선적합)

export type Demand = { length: number; qty: number };

export type Bar = {
  index: number; // 파이프 번호 (1부터)
  pieces: number[]; // 절단 길이 목록 (내림차순 배치 순서)
  groups: { length: number; qty: number }[]; // 표시용 묶음 (예: 300×2 + 1700×3)
  usedLength: number; // 절단 길이 합
  kerfLoss: number; // 날두께 손실
  remainder: number; // 잔여 길이
};

export type PipeCutResult = {
  bars: Bar[];
  totalBars: number; // 총 사용 본수
  totalCuts: number; // 총 절단 개수
  totalStock: number; // 총 원자재 길이
  totalUsed: number; // 실제 사용(절단) 길이 합
  totalKerf: number; // 날두께 총 손실
  totalRemainder: number; // 잔여 총합
  totalLoss: number; // 총 손실 (잔여 + 날두께)
  lossRate: number; // 손실률 % (소수 1자리)
  invalid: Demand[]; // 원자재보다 길어 배치 불가한 규격
};

/** 절단 길이 목록을 "길이×수량" 묶음으로 변환 (표시용, 길이 오름차순) */
function toGroups(pieces: number[]): { length: number; qty: number }[] {
  const m = new Map<number, number>();
  for (const p of pieces) m.set(p, (m.get(p) ?? 0) + 1);
  return [...m.entries()]
    .map(([length, qty]) => ({ length, qty }))
    .sort((a, b) => a.length - b.length);
}

/**
 * 절단 최적화 계산
 * @param stockLength 원자재(정척) 길이 mm
 * @param kerf 톱날 두께 mm (미적용 시 0)
 * @param demands 절단 규격·수량 목록
 */
export function calcPipeCut(
  stockLength: number,
  kerf: number,
  demands: Demand[]
): PipeCutResult {
  const stock = Number(stockLength) || 0;
  const k = Math.max(0, Number(kerf) || 0);

  const empty: PipeCutResult = {
    bars: [], totalBars: 0, totalCuts: 0, totalStock: 0, totalUsed: 0,
    totalKerf: 0, totalRemainder: 0, totalLoss: 0, lossRate: 0, invalid: [],
  };
  if (stock <= 0) return empty;

  // 유효/불가 규격 분리 (한 번 자르면 날두께가 붙으므로 length + kerf 가 정척을 넘으면 불가)
  const valid: Demand[] = [];
  const invalid: Demand[] = [];
  for (const d of demands) {
    const len = Number(d.length) || 0;
    const qty = Math.floor(Number(d.qty) || 0);
    if (len <= 0 || qty <= 0) continue;
    if (len + k > stock) invalid.push({ length: len, qty });
    else valid.push({ length: len, qty });
  }
  if (valid.length === 0) return { ...empty, invalid };

  // 전개 후 내림차순 정렬 (FFD)
  const pieces: number[] = [];
  for (const d of valid) for (let i = 0; i < d.qty; i++) pieces.push(d.length);
  pieces.sort((a, b) => b - a);

  // 우선적합 배치
  const bins: { pieces: number[]; used: number }[] = []; // used = 절단합 + 날두께
  for (const p of pieces) {
    const need = p + k;
    let placed = false;
    for (const b of bins) {
      if (b.used + need <= stock) {
        b.pieces.push(p);
        b.used += need;
        placed = true;
        break;
      }
    }
    if (!placed) bins.push({ pieces: [p], used: need });
  }

  const bars: Bar[] = bins.map((b, i) => {
    const usedLength = b.pieces.reduce((s, x) => s + x, 0);
    const kerfLoss = b.pieces.length * k;
    return {
      index: i + 1,
      pieces: b.pieces,
      groups: toGroups(b.pieces),
      usedLength,
      kerfLoss,
      remainder: stock - usedLength - kerfLoss,
    };
  });

  const totalBars = bars.length;
  const totalCuts = pieces.length;
  const totalStock = totalBars * stock;
  const totalUsed = bars.reduce((s, b) => s + b.usedLength, 0);
  const totalKerf = bars.reduce((s, b) => s + b.kerfLoss, 0);
  const totalRemainder = bars.reduce((s, b) => s + b.remainder, 0);
  const totalLoss = totalKerf + totalRemainder;
  const lossRate = totalStock > 0 ? Math.round((totalLoss / totalStock) * 1000) / 10 : 0;

  return {
    bars, totalBars, totalCuts, totalStock, totalUsed,
    totalKerf, totalRemainder, totalLoss, lossRate, invalid,
  };
}

/** 본별 절단 구성 문자열 (예: "300 × 2 + 1700 × 3") */
export function formatBar(bar: Bar): string {
  return bar.groups
    .map((g) => (g.qty > 1 ? `${g.length} × ${g.qty}` : `${g.length}`))
    .join(" + ");
}

/** 동일한 절단 조합끼리 묶은 요약 */
export type PatternSummary = {
  groups: { length: number; qty: number }[];
  label: string; // "300mm × 2, 2650mm × 2"
  barCount: number; // 같은 조합의 본수
  remainder: number; // 본당 잔여
  barIndexes: number[]; // 해당 파이프 번호들
};

/**
 * 절단 규격이 같은 파이프들을 묶어 요약
 * 예) 750mm, 5200mm — 10본 / 300mm × 2, 2650mm × 2 — 7본
 */
export function summarizePatterns(bars: Bar[]): PatternSummary[] {
  const map = new Map<string, PatternSummary>();
  for (const b of bars) {
    const key = b.groups.map((g) => `${g.length}x${g.qty}`).join("|");
    const cur = map.get(key);
    if (cur) {
      cur.barCount += 1;
      cur.barIndexes.push(b.index);
      continue;
    }
    map.set(key, {
      groups: b.groups,
      label: b.groups
        .map((g) => (g.qty > 1 ? `${g.length.toLocaleString()}mm × ${g.qty}` : `${g.length.toLocaleString()}mm`))
        .join(", "),
      barCount: 1,
      remainder: b.remainder,
      barIndexes: [b.index],
    });
  }
  return [...map.values()].sort((a, b) => b.barCount - a.barCount || a.remainder - b.remainder);
}
