import { describe, it, expect } from "vitest";
import {
  parseSpec,
  componentLengthM,
  componentWeightKg,
  lineTotalWeight,
  recommendWindowType,
  lineAmount,
  componentWeightByUnit,
  roundUp100,
  totalMaterialCost,
  installCost,
  totalLaborCost,
} from "./windowCalc";

describe("규격 파싱 (3-1)", () => {
  it("표준 형식 '1.100 x 1.150 = 1.265 / ...' → W1100 H1150", () => {
    const p = parseSpec("1.100 x 1.150 = 1.265 / [일반Bar] / ...");
    expect(p).toEqual({ widthMm: 1100, heightMm: 1150, ok: true });
  });
  it("면적 표기 '3.300 x 3.050 = 10.065' → W3300 H3050", () => {
    const p = parseSpec("3.300 x 3.050 = 10.065");
    expect(p.widthMm).toBe(3300);
    expect(p.heightMm).toBe(3050);
  });
  it("전각 × 및 콤마 표기도 처리", () => {
    const p = parseSpec("1,200 × 1,500");
    expect(p).toEqual({ widthMm: 1200, heightMm: 1500, ok: true });
  });
  it("형식 불일치 → ok=false (수동입력 허용)", () => {
    expect(parseSpec("환기창 특이규격").ok).toBe(false);
    expect(parseSpec("").ok).toBe(false);
  });
});

describe("부재 물량 계산 (3-2) — 엑셀 R23 대사", () => {
  it("고정창: W1010×3 + H1150×2 → 길이 5.33M, 중량 5.89498kg (단위중량 1.106)", () => {
    const len = componentLengthM(1010, 3, 1150, 2);
    expect(len).toBeCloseTo(5.33, 5);
    expect(componentWeightKg(len, 1.106)).toBeCloseTo(5.89498, 5);
  });
  it("PJ창: W1010×2 + H600×2 → 길이 3.22M, 중량 2.9141kg (단위중량 0.905)", () => {
    const len = componentLengthM(1010, 2, 600, 2);
    expect(len).toBeCloseTo(3.22, 5);
    expect(componentWeightKg(len, 0.905)).toBeCloseTo(2.9141, 4);
  });
  it("라인 총중량 O = 부재 중량 합 = 8.80908 (엑셀 O열)", () => {
    const w1 = componentWeightKg(componentLengthM(1010, 3, 1150, 2), 1.106);
    const w2 = componentWeightKg(componentLengthM(1010, 2, 600, 2), 0.905);
    expect(lineTotalWeight([w1, w2])).toBeCloseTo(8.80908, 5);
  });
});

describe("부재 중량 - 단위 방식별 (SSD 포함)", () => {
  it("M(치수기반): (W×개수W + H×개수H)/1000 × 단위중량", () => {
    const r = componentWeightByUnit({
      unit: "M", unitWeight: 1.106, widthMm: 1010, countW: 3, heightMm: 1150, countH: 2,
    });
    expect(r.lengthM).toBeCloseTo(5.33, 5);
    expect(r.weightKg).toBeCloseTo(5.89498, 5);
  });
  it("EA(투입갯수): 수량 × 단위중량(kg/EA)", () => {
    const r = componentWeightByUnit({ unit: "EA", unitWeight: 35, qty: 4 });
    expect(r.lengthM).toBe(0);
    expect(r.weightKg).toBe(140);
  });
  it("MT(중량): 수량 × 1000kg (단위중량 미지정 시 기본)", () => {
    expect(componentWeightByUnit({ unit: "MT", unitWeight: 0, qty: 1.5 }).weightKg).toBe(1500);
  });
});

describe("창호유형 자동추천 (3-5-2)", () => {
  const types = ["갤러리창", "T5 미서기창", "FIX+PJ창 (T5)", "T24 미서기 이중창"];
  it("이름 직접 포함 우선", () => {
    expect(recommendWindowType("갤러리창 / DA", types)).toBe("갤러리창");
  });
  it("AGW → AW+AG 복합 유형 우선 매칭", () => {
    const t = [...types, "AGW (AW+AG)"];
    expect(recommendWindowType("AGW12x15 / EV기계실 / 미서기창 및 그릴창", t)).toBe("AGW (AW+AG)");
  });
  it("SSD 품명 → SSD 유형 매칭", () => {
    const t = [...types, "SSD (스틸도어)"];
    expect(recommendWindowType("SSD 방화문 W900", t)).toBe("SSD (스틸도어)");
  });
  it("키워드 '고정창'+'PJ' → FIX+PJ 유형", () => {
    expect(recommendWindowType("AW / 고정창 및 PJ창", types)).toBe("FIX+PJ창 (T5)");
  });
  it("미매칭 → null", () => {
    expect(recommendWindowType("기타 자재", types)).toBeNull();
  });
});

describe("금액 계산 (3-4) — TRUNC 버림", () => {
  it("단가×수량 버림", () => {
    expect(lineAmount(123000, 320)).toBe(39360000);
    expect(lineAmount(1234.9, 3)).toBe(3704); // 3704.7 → 3704
  });
});

describe("비용 계산 (3-3) — 엑셀 R23 대사", () => {
  const weight = 8.80908; // R23 총중량 O
  it("ROUNDUP(-2): 100원 단위 올림", () => {
    expect(roundUp100(111923.7)).toBe(112000);
    expect(roundUp100(45000)).toBe(45000);
    expect(roundUp100(44926.3)).toBe(45000);
  });
  it("총자재비 = ROUNDUP(9300×8.80908 + 0 + 30000, -2) = 112,000 (엑셀 BQ)", () => {
    expect(totalMaterialCost(9300, weight, 0, 30000)).toBe(112000);
  });
  it("시공비 = ROUNDUP(8.80908×5100, -2) = 45,000 (엑셀 BR)", () => {
    expect(installCost(weight, 5100)).toBe(45000);
  });
  it("총시공비 = 시공비 45,000 + PJ시공비 22,000 = 67,000 (엑셀 BT)", () => {
    expect(totalLaborCost(installCost(weight, 5100), 22000)).toBe(67000);
  });
});
