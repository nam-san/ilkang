// 원판 절단 최적화 (2차원 네스팅) — 프론트·백엔드 공용 단일 모듈
//
// 조건: 90° 회전 배치 허용(눕혀서 자르는 경우), 톱날 두께 미적용
// 방식: 자유영역(free rectangle) 기반 길로틴 배치.
//       한 장의 원판에 **서로 다른 규격을 함께 배치**하여 자투리를 재활용한다.
// 최적화: 여러 전략(원판 단일 사용 / 혼합 그리디)과 여러 정렬 순서를 모두 시뮬레이션한 뒤
//        총 투입 원판 면적이 가장 작은(=손실률 최소) 결과를 채택한다.

export type Plate = { id?: number; name: string; width: number; height: number };

export type PlateDemand = {
  width: number; // 컷팅 가로(mm)
  height: number; // 컷팅 세로(mm)
  qty: number; // 필요 수량
  plateName?: string | null; // 특정 원판 지정(옵션)
};

export type Placement = {
  x: number;
  y: number;
  w: number; // 판에 놓인 실제 가로(회전 시 규격의 세로값)
  h: number; // 판에 놓인 실제 세로
  specIndex: number; // 몇 번째 컷팅 규격인지
  rotated: boolean; // 90° 눕혀서 배치했는지
};

export type BinCount = {
  specIndex: number;
  width: number; // 규격 원래 가로
  height: number; // 규격 원래 세로
  qty: number;
  rotated: boolean;
};

export type Bin = {
  index: number; // 원판 번호(1부터)
  plate: Plate;
  placements: Placement[];
  counts: BinCount[]; // 이 판에 담긴 규격별 개수 (회전 여부 구분)
  usedArea: number;
  plateArea: number;
  lossRate: number; // 이 판의 손실률 %
};

export type SpecSummary = {
  specIndex: number;
  width: number;
  height: number;
  qty: number; // 요청 수량
  placed: number; // 배치된 수량
};

export type PlateCutResult = {
  bins: Bin[];
  plateUsage: { name: string; count: number }[];
  specs: SpecSummary[];
  totalPlates: number;
  totalPieces: number;
  totalUsedArea: number;
  totalPlateArea: number;
  lossRate: number;
  invalid: PlateDemand[]; // 어떤 원판에도 들어가지 않는 규격
};

type Rect = { x: number; y: number; w: number; h: number };
type Piece = { w: number; h: number; specIndex: number };

const r1 = (n: number) => Math.round(n * 10) / 10;

/** 규격이 원판에 (회전 포함) 들어가는지 */
export function canFitPlate(
  piece: { width: number; height: number },
  plate: Plate
): boolean {
  const w = Number(piece.width) || 0;
  const h = Number(piece.height) || 0;
  if (w <= 0 || h <= 0) return false;
  return (w <= plate.width && h <= plate.height) || (h <= plate.width && w <= plate.height);
}

/** 원판 1매에 몇 개가 들어가는지 (격자 기준 · 회전 포함 유리한 방향 · 참고용) */
export function fitOnPlate(
  piece: { width: number; height: number },
  plate: Plate
): { perRow: number; perCol: number; perPlate: number; rotated: boolean } {
  const w = Number(piece.width) || 0;
  const h = Number(piece.height) || 0;
  if (w <= 0 || h <= 0) return { perRow: 0, perCol: 0, perPlate: 0, rotated: false };
  const grid = (pw: number, ph: number, rotated: boolean) => {
    const perRow = Math.floor(plate.width / pw);
    const perCol = Math.floor(plate.height / ph);
    return { perRow, perCol, perPlate: perRow * perCol, rotated };
  };
  const a = grid(w, h, false);
  const b = grid(h, w, true);
  return b.perPlate > a.perPlate ? b : a;
}

type Orient = { w: number; h: number; rotated: boolean };
/** 방향 편향 — auto: 자유 탐색 / portrait: 세워서 우선 / landscape: 눕혀서 우선 */
type Bias = "auto" | "portrait" | "landscape";

function orientsFor(p: Piece, bias: Bias): Orient[][] {
  const flat: Orient = { w: p.w, h: p.h, rotated: false };
  if (p.w === p.h) return [[flat]]; // 정방형은 회전해도 동일
  const turned: Orient = { w: p.h, h: p.w, rotated: true };
  if (bias === "auto") return [[flat, turned]]; // 두 방향을 한 번에 비교
  // 선호 방향을 먼저 시도하고, 안 들어갈 때만 반대 방향
  const portraitFirst = p.w <= p.h ? [flat, turned] : [turned, flat];
  const ordered = bias === "portrait" ? portraitFirst : [portraitFirst[1], portraitFirst[0]];
  return [[ordered[0]], [ordered[1]]];
}

/** 원판 1장에 가능한 한 많이 배치 (자유영역 + 길로틴 분할, 90° 회전 허용) */
function packOneBin(
  plate: Plate,
  pieces: Piece[],
  taken: boolean[],
  bias: Bias
): { placements: Placement[]; usedIdx: number[]; usedArea: number } {
  const free: Rect[] = [{ x: 0, y: 0, w: plate.width, h: plate.height }];
  const placements: Placement[] = [];
  const usedIdx: number[] = [];
  let usedArea = 0;

  for (let i = 0; i < pieces.length; i++) {
    if (taken[i]) continue;
    const p = pieces[i];

    // Best Area Fit (남는 면적 최소, 동률이면 짧은 변 여유 최소)
    let best = -1;
    let bestOrient: Orient = { w: p.w, h: p.h, rotated: false };
    for (const group of orientsFor(p, bias)) {
      let bestLeftover = Infinity;
      let bestShort = Infinity;
      for (let f = 0; f < free.length; f++) {
        const fr = free[f];
        for (const o of group) {
          if (o.w > fr.w || o.h > fr.h) continue;
          const leftover = fr.w * fr.h - o.w * o.h;
          const shortSide = Math.min(fr.w - o.w, fr.h - o.h);
          if (leftover < bestLeftover || (leftover === bestLeftover && shortSide < bestShort)) {
            bestLeftover = leftover;
            bestShort = shortSide;
            best = f;
            bestOrient = o;
          }
        }
      }
      if (best >= 0) break; // 선호 방향으로 자리를 찾았으면 반대 방향은 보지 않음
    }
    if (best < 0) continue;

    const fr = free[best];
    const o = bestOrient;
    placements.push({ x: fr.x, y: fr.y, w: o.w, h: o.h, specIndex: p.specIndex, rotated: o.rotated });
    usedIdx.push(i);
    usedArea += o.w * o.h;

    // 길로틴 분할: 오른쪽 조각 + 아래쪽 조각
    const right: Rect = { x: fr.x + o.w, y: fr.y, w: fr.w - o.w, h: o.h };
    const bottom: Rect = { x: fr.x, y: fr.y + o.h, w: fr.w, h: fr.h - o.h };
    free.splice(best, 1);
    if (right.w > 0 && right.h > 0) free.push(right);
    if (bottom.w > 0 && bottom.h > 0) free.push(bottom);
  }
  return { placements, usedIdx, usedArea };
}

type Strategy = { kind: "single"; plate: Plate } | { kind: "ratio" } | { kind: "waste" };

/** 한 전략으로 전체를 포장 → 사용 원판 목록 */
function packWithStrategy(
  plates: Plate[],
  pieces: Piece[],
  strategy: Strategy,
  bias: Bias
): Bin[] | null {
  const taken = new Array(pieces.length).fill(false);
  let remaining = pieces.length;
  const bins: Bin[] = [];
  const candidates = strategy.kind === "single" ? [strategy.plate] : plates;

  let guard = 0;
  while (remaining > 0) {
    if (++guard > pieces.length + 5) return null; // 안전장치

    let chosen: { plate: Plate; res: ReturnType<typeof packOneBin> } | null = null;
    let bestScore = -Infinity;

    for (const plate of candidates) {
      const res = packOneBin(plate, pieces, taken, bias);
      if (res.usedIdx.length === 0) continue;
      const plateArea = plate.width * plate.height;
      // ratio: 이용률 최대 / waste: 남는 면적 최소 / single: 후보가 1개
      const score =
        strategy.kind === "waste" ? -(plateArea - res.usedArea) : res.usedArea / plateArea;
      if (score > bestScore) {
        bestScore = score;
        chosen = { plate, res };
      }
    }
    if (!chosen) return null; // 남은 조각을 담을 원판이 없음

    for (const i of chosen.res.usedIdx) taken[i] = true;
    remaining -= chosen.res.usedIdx.length;

    const plateArea = chosen.plate.width * chosen.plate.height;
    // 규격 + 회전 여부로 묶어 집계 (회전분은 눕혀서 잘라야 하므로 구분 표기)
    const countMap = new Map<string, BinCount>();
    for (const pl of chosen.res.placements) {
      const key = `${pl.specIndex}|${pl.rotated}`;
      const c = countMap.get(key);
      if (c) c.qty += 1;
      else
        countMap.set(key, {
          specIndex: pl.specIndex,
          width: pl.rotated ? pl.h : pl.w, // 규격 원래 치수로 환산
          height: pl.rotated ? pl.w : pl.h,
          qty: 1,
          rotated: pl.rotated,
        });
    }

    bins.push({
      index: bins.length + 1,
      plate: chosen.plate,
      placements: chosen.res.placements,
      counts: [...countMap.values()].sort((a, b) => b.width * b.height - a.width * a.height),
      usedArea: chosen.res.usedArea,
      plateArea,
      lossRate: r1(((plateArea - chosen.res.usedArea) / plateArea) * 100),
    });
  }
  return bins;
}

/** 전체 계산 — 여러 전략을 시뮬레이션해 손실 최소 결과 채택 */
export function calcPlateCut(plates: Plate[], demands: PlateDemand[]): PlateCutResult {
  const empty: PlateCutResult = {
    bins: [], plateUsage: [], specs: [], totalPlates: 0, totalPieces: 0,
    totalUsedArea: 0, totalPlateArea: 0, lossRate: 0, invalid: [],
  };
  const usable = plates.filter((p) => Number(p.width) > 0 && Number(p.height) > 0);
  if (usable.length === 0) return empty;

  // 규격 정리 + 배치 불가 분리
  const specs: SpecSummary[] = [];
  const invalid: PlateDemand[] = [];
  const forcedBySpec = new Map<number, string>();

  demands.forEach((d) => {
    const width = Number(d.width) || 0;
    const height = Number(d.height) || 0;
    const qty = Math.floor(Number(d.qty) || 0);
    if (width <= 0 || height <= 0 || qty <= 0) return;

    const fitsAnywhere = usable.some((p) => canFitPlate({ width, height }, p));
    if (!fitsAnywhere) {
      invalid.push({ width, height, qty });
      return;
    }
    const idx = specs.length;
    specs.push({ specIndex: idx, width, height, qty, placed: 0 });
    if (d.plateName) forcedBySpec.set(idx, d.plateName);
  });
  if (specs.length === 0) return { ...empty, invalid };

  // 원판을 지정한 규격 / 자동 최적화 규격 분리
  const forcedGroups = new Map<string, Piece[]>();
  const autoPieces: Piece[] = [];
  for (const s of specs) {
    const forced = forcedBySpec.get(s.specIndex);
    for (let i = 0; i < s.qty; i++) {
      const piece: Piece = { w: s.width, h: s.height, specIndex: s.specIndex };
      if (forced && usable.some((p) => p.name === forced && canFitPlate(s, p))) {
        const arr = forcedGroups.get(forced) ?? [];
        arr.push(piece);
        forcedGroups.set(forced, arr);
      } else {
        autoPieces.push(piece);
      }
    }
  }

  const allOrderings: ((a: Piece, b: Piece) => number)[] = [
    (a, b) => b.w * b.h - a.w * a.h, // 면적 큰 순
    (a, b) => Math.max(b.w, b.h) - Math.max(a.w, a.h), // 최대변 큰 순
    (a, b) => b.h - a.h || b.w - a.w, // 세로 큰 순
  ];
  const allBiases: Bias[] = ["auto", "portrait", "landscape"];
  // 조각 수가 많으면 탐색 조합을 줄여 계산 시간을 제한
  const pieceCount =
    autoPieces.length + [...forcedGroups.values()].reduce((s, a) => s + a.length, 0);
  const orderings =
    pieceCount > 400 ? allOrderings.slice(0, 1) : pieceCount > 150 ? allOrderings.slice(0, 2) : allOrderings;
  const biases = pieceCount > 150 ? allBiases.slice(0, 2) : allBiases;

  /** 조각 묶음을 최적으로 포장 (전략 × 정렬 조합 중 최소 면적) */
  const packBest = (pieces: Piece[], allowed: Plate[]): Bin[] => {
    if (pieces.length === 0) return [];
    const strategies: Strategy[] = [
      ...allowed.map((p) => ({ kind: "single" as const, plate: p })),
      { kind: "ratio" },
      { kind: "waste" },
    ];
    let best: Bin[] | null = null;
    let bestArea = Infinity;
    for (const order of orderings) {
      const sorted = [...pieces].sort(order);
      for (const bias of biases) {
        for (const st of strategies) {
          const bins = packWithStrategy(allowed, sorted, st, bias);
          if (!bins) continue;
          const area = bins.reduce((s, b) => s + b.plateArea, 0);
          if (area < bestArea) {
            bestArea = area;
            best = bins;
          }
        }
      }
    }
    return best ?? [];
  };

  const bins: Bin[] = [];
  // ① 원판 지정 규격은 해당 원판만 사용
  for (const [plateName, pieces] of forcedGroups) {
    const only = usable.filter((p) => p.name === plateName);
    bins.push(...packBest(pieces, only));
  }
  // ② 나머지는 전체 원판 대상으로 최적화
  bins.push(...packBest(autoPieces, usable));

  // 번호 재부여 + 집계
  bins.forEach((b, i) => (b.index = i + 1));
  for (const b of bins) for (const pl of b.placements) specs[pl.specIndex].placed += 1;

  const usage = new Map<string, number>();
  for (const b of bins) usage.set(b.plate.name, (usage.get(b.plate.name) ?? 0) + 1);

  const totalUsedArea = bins.reduce((s, b) => s + b.usedArea, 0);
  const totalPlateArea = bins.reduce((s, b) => s + b.plateArea, 0);

  return {
    bins,
    plateUsage: [...usage.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count),
    specs,
    totalPlates: bins.length,
    totalPieces: specs.reduce((s, x) => s + x.placed, 0),
    totalUsedArea,
    totalPlateArea,
    lossRate: totalPlateArea > 0 ? r1(((totalPlateArea - totalUsedArea) / totalPlateArea) * 100) : 0,
    invalid,
  };
}

/** 판별 배치 내역 문자열 (예: "1,000×600 × 3 + 300×300 × 2(회전)") */
export function formatBin(bin: Bin): string {
  return bin.counts
    .map(
      (c) =>
        `${c.width.toLocaleString()}×${c.height.toLocaleString()}` +
        `${c.qty > 1 ? ` × ${c.qty}` : ""}${c.rotated ? "(회전)" : ""}`
    )
    .join(" + ");
}

/** ㎟ → ㎡ (소수 2자리) */
export function toM2(mm2: number): number {
  return Math.round((mm2 / 1_000_000) * 100) / 100;
}
