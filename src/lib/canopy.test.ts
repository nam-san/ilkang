import { describe, it, expect } from "vitest";
import {
  canopyArea,
  canopyPipeQty,
  calcCanopyRow,
  sumCanopyRows,
  type SheetPriceTable,
  type PipePriceTable,
} from "./canopy";

// 스펙 3장의 단가 마스터
const SHEET: SheetPriceTable = {
  "AL P/N 2.0T": { "2코팅": 70500, "3코팅": 73000 },
  "AL P/N 3.0T": { "2코팅": 93500, "3코팅": 96000 },
  "EGI P/N 1.2T": { "2코팅": 38500, "3코팅": 41000 },
  "EGI P/N 1.6T": { "2코팅": 43500, "3코팅": 46000 },
};
const PIPE: PipePriceTable = {
  "40*40 칼라": { "1.4T": 10362, "2T": 13321, "2.9T": 18534, "4T": null, "4.2T": null, "5.7T": null },
  "40*40 HGI": { "1.4T": 11411, "2T": 14807, "2.9T": 20605, "4T": null, "4.2T": null, "5.7T": null },
  "50*50 칼라": { "1.4T": 12959, "2T": 16948, "2.9T": 23793, "4T": null, "4.2T": null, "5.7T": null },
  "50*50 HGI": { "1.4T": 14337, "2T": 18842, "2.9T": 26457, "4T": null, "4.2T": null, "5.7T": null },
  "75*75 칼라": { "1.4T": 20143, "2T": 26011, "2.9T": 36937, "4T": 50035, "4.2T": 52283, "5.7T": 69469 },
  "75*75 HGI": { "1.4T": 22230, "2T": 28921, "2.9T": 41072, "4T": null, "4.2T": null, "5.7T": null },
  "100*100 칼라": { "1.4T": null, "2T": 35081, "2.9T": 50081, "4T": 68314, "4.2T": 71471, "5.7T": 95927 },
  "100*100 HGI": { "1.4T": null, "2T": 39008, "2.9T": 55694, "4T": null, "4.2T": null, "5.7T": null },
};

const run = (w: number, h: number, l: number, extra: Partial<Parameters<typeof calcCanopyRow>[0]> = {}) =>
  calcCanopyRow({ w, h, l, ...extra }, SHEET, PIPE);

const FULL = {
  sheetType: "AL P/N 2.0T",
  coating: "3코팅",
  pipeSpec: "50*50 HGI",
  pipeThickness: "2T",
};

describe("캐노피 산출 - 스펙 테스트 케이스", () => {
  it("① W1400 H150 L3500 → 면적 10.33 / 본수 6 / 시트 754,090 / 파이프 113,052 / 합계 867,142", () => {
    const r = run(1400, 150, 3500, FULL);
    expect(r.areaM2).toBe(10.33);
    expect(r.pipeQty).toBe(6);
    expect(r.sheetAmount).toBe(754090); // 엑셀 J3 버그(965,855) 아님
    expect(r.pipeAmount).toBe(113052);
    expect(r.totalAmount).toBe(867142);
    expect(r.unsupported).toBe(false);
  });

  it("② W900 H150 L3500 → 6.83 / 5 / 498,590 / 94,210 / 592,800", () => {
    const r = run(900, 150, 3500, FULL);
    expect(r.areaM2).toBe(6.83);
    expect(r.pipeQty).toBe(5);
    expect(r.sheetAmount).toBe(498590);
    expect(r.pipeAmount).toBe(94210);
    expect(r.totalAmount).toBe(592800);
  });

  it("③ W1700 H200 L7600 → 27.36 / 13 / 1,997,280 / 244,946 / 2,242,226", () => {
    const r = run(1700, 200, 7600, FULL);
    expect(r.areaM2).toBe(27.36);
    expect(r.pipeQty).toBe(13);
    expect(r.sheetAmount).toBe(1997280);
    expect(r.pipeAmount).toBe(244946);
    expect(r.totalAmount).toBe(2242226);
  });

  it("④ W800 H150 L8450 (자재 미선택) → 면적 14.79 / 본수 11, 금액 없음", () => {
    const r = run(800, 150, 8450);
    expect(r.areaM2).toBe(14.79);
    expect(r.pipeQty).toBe(11);
    expect(r.sheetAmount).toBeNull();
    expect(r.pipeAmount).toBeNull();
    expect(r.totalAmount).toBeNull();
    expect(r.unsupported).toBe(false); // 미선택은 에러 아님
  });

  it("⑤ W900 H150 L3080 → 면적 6.01 / 본수 5", () => {
    const r = run(900, 150, 3080);
    expect(r.areaM2).toBe(6.01);
    expect(r.pipeQty).toBe(5);
  });

  it("⑥ W900 H200 L1900 → 면적 3.80 / 본수 4", () => {
    const r = run(900, 200, 1900);
    expect(r.areaM2).toBe(3.8);
    expect(r.pipeQty).toBe(4);
  });
});

describe("캐노피 산출 - 경계/예외", () => {
  it("L = 6000 도 #N/A 없이 계산 (여유분 +1 적용)", () => {
    const q = canopyPipeQty(1400, 6000);
    // (1400×(6+2) + 12000) × 2 / 6000 = (11200+12000)×2/6000 = 7.733 → 8 + 1 = 9
    expect(q).toBe(9);
    const r = run(1400, 150, 6000, FULL);
    expect(r.pipeQty).toBe(9);
    expect(Number.isFinite(r.areaM2)).toBe(true);
  });

  it("L = 6001 은 +2 적용", () => {
    expect(canopyPipeQty(1400, 6001)).toBe(canopyPipeQty(1400, 6000) + 1);
  });

  it("100*100 HGI + 4T → 미취급 처리 (금액 제외)", () => {
    const r = run(1400, 150, 3500, { ...FULL, pipeSpec: "100*100 HGI", pipeThickness: "4T" });
    expect(r.unsupported).toBe(true);
    expect(r.pipeUnitPrice).toBeNull();
    expect(r.pipeAmount).toBeNull();
  });

  it("면적 반올림 - 부동소수 오차 없이 6.825 → 6.83", () => {
    expect(canopyArea(900, 150, 3500)).toBe(6.83);
  });

  it("W·H·L 미입력 시 면적/본수 0", () => {
    expect(canopyArea(0, 150, 3500)).toBe(0);
    expect(canopyPipeQty(0, 3500)).toBe(0);
  });
});

describe("캐노피 합계", () => {
  it("미취급 조합은 금액 합계에서 제외하고 건수로 보고", () => {
    const rows = [
      run(1400, 150, 3500, FULL), // 867,142
      run(900, 150, 3500, FULL), // 592,800
      run(1400, 150, 3500, { ...FULL, pipeSpec: "100*100 HGI", pipeThickness: "4T" }), // 미취급
    ];
    const s = sumCanopyRows(rows);
    expect(s.totalAmount).toBe(867142 + 592800);
    expect(s.unsupportedCount).toBe(1);
    expect(s.areaM2).toBe(27.49); // 합계도 소수 2자리로 정규화 (부동소수 오차 제거)
    expect(s.pipeQty).toBe(6 + 5 + 6);
  });
});
