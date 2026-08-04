import { describe, it, expect } from "vitest";
import {
  fitOnPlate, canFitPlate, calcPlateCut, formatBin, toM2, type Plate, type Bin,
} from "./plateCut";

// 기본 원판 기준값
const PLATES: Plate[] = [
  { name: "1*3", width: 1000, height: 3000 },
  { name: "1*4", width: 1000, height: 4000 },
  { name: "4*4", width: 1220, height: 4000 },
  { name: "4*8", width: 1220, height: 2430 },
  { name: "4*3", width: 1220, height: 3000 },
];

/** 배치가 원판을 벗어나지 않고 서로 겹치지 않는지 검증 */
function assertValidLayout(bin: Bin) {
  for (const p of bin.placements) {
    expect(p.x).toBeGreaterThanOrEqual(0);
    expect(p.y).toBeGreaterThanOrEqual(0);
    expect(p.x + p.w).toBeLessThanOrEqual(bin.plate.width);
    expect(p.y + p.h).toBeLessThanOrEqual(bin.plate.height);
  }
  for (let i = 0; i < bin.placements.length; i++) {
    for (let j = i + 1; j < bin.placements.length; j++) {
      const a = bin.placements[i];
      const b = bin.placements[j];
      const overlap =
        a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
      expect(overlap).toBe(false);
    }
  }
}

describe("원판 배치 기본 (90° 회전 허용)", () => {
  it("1000×1000 → 1*3 원판에 3개 (가로1 × 세로3)", () => {
    expect(fitOnPlate({ width: 1000, height: 1000 }, PLATES[0])).toEqual({
      perRow: 1, perCol: 3, perPlate: 3, rotated: false,
    });
  });

  it("600×500 → 4*3 원판(1220×3000)에 12개 (가로2 × 세로6)", () => {
    expect(fitOnPlate({ width: 600, height: 500 }, PLATES[4])).toEqual({
      perRow: 2, perCol: 6, perPlate: 12, rotated: false,
    });
  });

  it("눕히면 더 많이 들어가면 회전 방향을 택한다", () => {
    // 3000×1000 은 그대로면 1*3(1000×3000)에 0개, 눕히면 1000×3000 으로 1개
    const f = fitOnPlate({ width: 3000, height: 1000 }, PLATES[0]);
    expect(f).toEqual({ perRow: 1, perCol: 1, perPlate: 1, rotated: true });
  });

  it("어느 방향으로도 안 들어가면 배치 불가", () => {
    expect(canFitPlate({ width: 1500, height: 3500 }, PLATES[0])).toBe(false);
    expect(canFitPlate({ width: 3000, height: 100 }, PLATES[0])).toBe(true); // 눕히면 100×3000
  });
});

describe("긴 규격의 회전 배치", () => {
  it("3000×100 은 제외되지 않고 눕혀서 배치된다", () => {
    const r = calcPlateCut(PLATES, [{ width: 3000, height: 100, qty: 5 }]);
    expect(r.invalid).toEqual([]);
    expect(r.specs[0].placed).toBe(5);
    // 100×3000 으로 눕혀 1*3(1000×3000) 한 장에 10개까지 → 1매
    expect(r.totalPlates).toBe(1);
    expect(r.bins[0].placements.every((p) => p.rotated)).toBe(true);
    expect(r.bins[0].placements.every((p) => p.w === 100 && p.h === 3000)).toBe(true);
    r.bins.forEach(assertValidLayout);
  });

  it("회전 배치는 내역에 (회전) 으로 표기", () => {
    const r = calcPlateCut(PLATES, [{ width: 3000, height: 100, qty: 2 }]);
    expect(r.bins[0].counts[0]).toMatchObject({ width: 3000, height: 100, qty: 2, rotated: true });
    expect(formatBin(r.bins[0])).toBe("3,000×100 × 2(회전)");
  });
});

describe("서로 다른 규격을 한 판에 혼합 배치 (로스율 최소화)", () => {
  it("1000×600 7개 + 300×300 2개 → 4*4 1매 (눕혀 배치 + 자투리 재활용)", () => {
    const r = calcPlateCut(PLATES, [
      { width: 1000, height: 600, qty: 7 },
      { width: 300, height: 300, qty: 2 },
    ]);
    // 600×1000 으로 눕히면 1220 폭에 2열이 서서 4*4(1220×4000) 한 장에 모두 들어간다
    expect(r.totalPlates).toBe(1);
    expect(r.plateUsage).toEqual([{ name: "4*4", count: 1 }]);
    expect(r.totalPieces).toBe(9);

    // 한 판에 두 규격이 함께 배치된다
    const bin = r.bins[0];
    expect(bin.counts.length).toBe(2);
    expect(bin.counts.find((c) => c.width === 1000)!.rotated).toBe(true);

    // 손실률 = (1220×4000 − (7×600,000 + 2×90,000)) / (1220×4000)
    expect(r.lossRate).toBe(10.2);
    r.bins.forEach(assertValidLayout);
  });

  it("규격별 개별 배치보다 총 원판 매수가 적거나 같다", () => {
    const demands = [
      { width: 1000, height: 600, qty: 7 },
      { width: 300, height: 300, qty: 2 },
    ];
    const mixed = calcPlateCut(PLATES, demands);
    const separate = demands
      .map((d) => calcPlateCut(PLATES, [d]).totalPlates)
      .reduce((a, b) => a + b, 0);
    expect(mixed.totalPlates).toBeLessThan(separate);
  });

  it("요청 수량이 모두 배치된다", () => {
    const r = calcPlateCut(PLATES, [
      { width: 900, height: 700, qty: 5 },
      { width: 400, height: 350, qty: 9 },
      { width: 250, height: 200, qty: 14 },
    ]);
    r.specs.forEach((s) => expect(s.placed).toBe(s.qty));
    expect(r.totalPieces).toBe(28);
    r.bins.forEach(assertValidLayout);
  });
});

describe("집계·검증", () => {
  it("딱 맞아 떨어지면 손실률 0%", () => {
    const r = calcPlateCut(PLATES, [{ width: 1000, height: 1000, qty: 3 }]);
    expect(r.totalPlates).toBe(1);
    expect(r.bins[0].plate.name).toBe("1*3");
    expect(r.lossRate).toBe(0);
  });

  it("원판별 사용 매수 합계 = 총 매수", () => {
    const r = calcPlateCut(PLATES, [
      { width: 1000, height: 1000, qty: 3 },
      { width: 1000, height: 1500, qty: 2 },
    ]);
    expect(r.plateUsage.reduce((s, u) => s + u.count, 0)).toBe(r.totalPlates);
  });

  it("판별 손실률·면적이 총계와 일치", () => {
    const r = calcPlateCut(PLATES, [
      { width: 800, height: 900, qty: 6 },
      { width: 500, height: 400, qty: 5 },
    ]);
    expect(r.totalUsedArea).toBe(r.bins.reduce((s, b) => s + b.usedArea, 0));
    expect(r.totalPlateArea).toBe(r.bins.reduce((s, b) => s + b.plateArea, 0));
    const expected = Math.round(((r.totalPlateArea - r.totalUsedArea) / r.totalPlateArea) * 1000) / 10;
    expect(r.lossRate).toBe(expected);
  });

  it("사용자가 원판을 지정하면 그 원판만 사용", () => {
    const r = calcPlateCut(PLATES, [{ width: 1000, height: 1000, qty: 5, plateName: "1*4" }]);
    expect(r.bins.every((b) => b.plate.name === "1*4")).toBe(true);
    expect(r.totalPlates).toBe(2); // 1*4 한 장에 4개
  });

  it("어떤 원판에도 안 들어가는 규격은 invalid 로 분리", () => {
    const r = calcPlateCut(PLATES, [
      { width: 2000, height: 5000, qty: 1 },
      { width: 1000, height: 1000, qty: 3 },
    ]);
    expect(r.invalid).toEqual([{ width: 2000, height: 5000, qty: 1 }]);
    expect(r.specs.length).toBe(1);
    expect(r.totalPlates).toBe(1);
  });

  it("원판 목록이 비면 빈 결과", () => {
    expect(calcPlateCut([], [{ width: 100, height: 100, qty: 1 }]).totalPlates).toBe(0);
  });

  it("판별 배치 내역 문자열", () => {
    const r = calcPlateCut(PLATES, [
      { width: 1000, height: 600, qty: 7 },
      { width: 300, height: 300, qty: 2 },
    ]);
    const mixed = r.bins.find((b) => b.counts.length > 1)!;
    expect(formatBin(mixed)).toContain("1,000×600");
    expect(formatBin(mixed)).toContain("300×300");
    expect(formatBin(mixed)).toContain("+");
  });

  it("면적 ㎡ 변환", () => {
    expect(toM2(6_000_000)).toBe(6);
    expect(toM2(1_234_567)).toBe(1.23);
  });
});
