import { describe, it, expect } from "vitest";
import { sheetArea, expandedSize } from "./sheetArea";

describe("시트 면적 산출", () => {
  it("(가로+후렌지+날개) × (세로+후렌지+날개) × 개수 / 1,000,000", () => {
    // (1000+30+20) × (2000+30+20) × 2 / 1e6 = 1050 × 2050 × 2 / 1e6 = 4.305
    const area = sheetArea({
      width: 1000, widthFlange: 30, widthWing: 20,
      height: 2000, heightFlange: 30, heightWing: 20,
      qty: 2,
    });
    expect(area).toBeCloseTo(4.305, 6);
  });

  it("후렌지·날개가 0이면 단순 가로×세로", () => {
    const area = sheetArea({
      width: 1200, widthFlange: 0, widthWing: 0,
      height: 2400, heightFlange: 0, heightWing: 0,
      qty: 1,
    });
    expect(area).toBeCloseTo(2.88, 6); // 1.2m × 2.4m
  });

  it("개수 0이면 면적 0", () => {
    expect(
      sheetArea({ width: 1000, widthFlange: 10, widthWing: 10, height: 1000, heightFlange: 10, heightWing: 10, qty: 0 })
    ).toBe(0);
  });

  it("전개 치수(mm) 계산", () => {
    expect(
      expandedSize({ width: 900, widthFlange: 25, widthWing: 15, height: 1800, heightFlange: 25, heightWing: 15, qty: 1 })
    ).toEqual({ w: 940, h: 1840 });
  });
});
