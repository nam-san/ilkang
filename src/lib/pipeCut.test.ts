import { describe, it, expect } from "vitest";
import { calcPipeCut, formatBar, summarizePatterns } from "./pipeCut";

describe("파이프 절단 최적화 — 레퍼런스 예시 재현", () => {
  // 파이프 6000 / 날두께 4 / 1300×4, 1700×8, 1900×5, 300×7, 1000×4
  const r = calcPipeCut(6000, 4, [
    { length: 1300, qty: 4 },
    { length: 1700, qty: 8 },
    { length: 1900, qty: 5 },
    { length: 300, qty: 7 },
    { length: 1000, qty: 4 },
  ]);

  it("총 6본 / 절단 28개", () => {
    expect(r.totalBars).toBe(6);
    expect(r.totalCuts).toBe(28);
  });

  it("본별 잔여가 레퍼런스와 일치 (288 / 184 / 280 / 280 / 80 / 376)", () => {
    expect(r.bars.map((b) => b.remainder)).toEqual([288, 184, 280, 280, 80, 376]);
  });

  it("본별 절단 구성이 레퍼런스와 일치", () => {
    expect(r.bars.map((b) => formatBar(b))).toEqual([
      "1900 × 3",
      "300 + 1700 + 1900 × 2",
      "300 × 2 + 1700 × 3",
      "300 × 2 + 1700 × 3",
      "300 + 1300 × 3 + 1700",
      "300 + 1000 × 4 + 1300",
    ]);
  });

  it("손실률 4.4% (잔여 1,488 + 날두께 112 = 1,600 / 36,000)", () => {
    expect(r.totalRemainder).toBe(1488);
    expect(r.totalKerf).toBe(112); // 28개 × 4mm
    expect(r.totalLoss).toBe(1600);
    expect(r.totalStock).toBe(36000);
    expect(r.lossRate).toBe(4.4);
  });

  it("요청 수량이 모두 배치됨", () => {
    const count = (len: number) =>
      r.bars.reduce((s, b) => s + b.pieces.filter((p) => p === len).length, 0);
    expect(count(1900)).toBe(5);
    expect(count(1700)).toBe(8);
    expect(count(1300)).toBe(4);
    expect(count(1000)).toBe(4);
    expect(count(300)).toBe(7);
  });
});

describe("파이프 절단 — 손실 모델", () => {
  it("잔여 = 원자재 − Σ절단 − (절단개수 × 날두께)", () => {
    const r = calcPipeCut(6000, 4, [{ length: 1900, qty: 3 }]);
    expect(r.bars[0].usedLength).toBe(5700);
    expect(r.bars[0].kerfLoss).toBe(12);
    expect(r.bars[0].remainder).toBe(288);
  });

  it("날두께 0(미적용)이면 손실은 잔여뿐", () => {
    const r = calcPipeCut(6000, 0, [{ length: 2000, qty: 3 }]);
    expect(r.totalBars).toBe(1);
    expect(r.bars[0].remainder).toBe(0);
    expect(r.totalKerf).toBe(0);
    expect(r.lossRate).toBe(0);
  });

  it("날두께 때문에 한 본에 못 들어가면 본수가 늘어난다", () => {
    // 2000×3 = 6000 이지만 날두께 4 적용 시 6012 → 2본
    const r = calcPipeCut(6000, 4, [{ length: 2000, qty: 3 }]);
    expect(r.totalBars).toBe(2);
  });
});

describe("파이프 절단 — 패턴 요약", () => {
  it("같은 절단 조합끼리 묶어 본수로 집계", () => {
    // 750 + 5200 = 5950, 날두께 8 → 잔여 42 (10본) / 300×2 + 2650×2 = 5900, 날두께 16 → 잔여 84
    const r = calcPipeCut(6000, 4, [
      { length: 5200, qty: 10 },
      { length: 750, qty: 10 },
      { length: 2650, qty: 4 },
      { length: 300, qty: 4 },
    ]);
    const s = summarizePatterns(r.bars);
    const first = s[0];
    expect(first.label).toBe("750mm, 5,200mm");
    expect(first.barCount).toBe(10);
    expect(first.remainder).toBe(42);
    // 요약 본수 합 = 전체 본수
    expect(s.reduce((a, x) => a + x.barCount, 0)).toBe(r.totalBars);
  });

  it("수량이 여러 개인 조합은 '× n' 으로 표기", () => {
    const r = calcPipeCut(6000, 4, [
      { length: 2650, qty: 4 },
      { length: 300, qty: 4 },
    ]);
    const s = summarizePatterns(r.bars);
    expect(s[0].label).toBe("300mm × 2, 2,650mm × 2");
    expect(s[0].barCount).toBe(2);
    expect(s[0].remainder).toBe(84);
  });
});

describe("파이프 절단 — 예외 처리", () => {
  it("원자재보다 긴 규격은 배치 불가로 분리", () => {
    const r = calcPipeCut(6000, 4, [
      { length: 7000, qty: 2 },
      { length: 1000, qty: 2 },
    ]);
    expect(r.invalid).toEqual([{ length: 7000, qty: 2 }]);
    expect(r.totalCuts).toBe(2); // 유효분만 계산
    expect(r.totalBars).toBe(1);
  });

  it("정확히 원자재 길이인 규격도 날두께가 있으면 불가", () => {
    const r = calcPipeCut(6000, 4, [{ length: 6000, qty: 1 }]);
    expect(r.invalid.length).toBe(1);
    expect(r.totalBars).toBe(0);
  });

  it("수량·길이 0 이하 입력은 무시", () => {
    const r = calcPipeCut(6000, 4, [
      { length: 0, qty: 5 },
      { length: 1000, qty: 0 },
      { length: 1000, qty: 2 },
    ]);
    expect(r.totalCuts).toBe(2);
  });

  it("원자재 길이 미입력이면 빈 결과", () => {
    expect(calcPipeCut(0, 4, [{ length: 1000, qty: 1 }]).totalBars).toBe(0);
  });
});
