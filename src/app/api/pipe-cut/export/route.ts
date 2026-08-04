import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { calcPipeCut, formatBar, summarizePatterns, type Demand } from "@/lib/pipeCut";
import { ymd } from "@/lib/format";

export const dynamic = "force-dynamic";

const HEADER_FILL = "FFEFF3F8";
const thin = { style: "thin" as const, color: { argb: "FFCBD5E1" } };
const border = { top: thin, left: thin, bottom: thin, right: thin };

// 절단 패턴 결과 엑셀 다운로드 (현재 계산 결과 또는 히스토리 항목 전송)
export async function POST(req: NextRequest) {
  const b = await req.json();
  const stockLength = Number(b.stockLength) || 0;
  const kerf = Number(b.kerf) || 0;
  const demands: Demand[] = Array.isArray(b.demands) ? b.demands : [];
  const title = (b.title || "").trim();

  if (stockLength <= 0 || demands.length === 0) {
    return NextResponse.json({ error: "원자재 길이와 절단 목록이 필요합니다." }, { status: 400 });
  }
  const r = calcPipeCut(stockLength, kerf, demands); // 서버 재계산

  const wb = new ExcelJS.Workbook();
  wb.creator = "일강이앤지 통합관리시스템";
  const ws = wb.addWorksheet("파이프절단");

  const widths = [12, 46, 14, 14, 14, 14];
  widths.forEach((w, i) => (ws.getColumn(i + 1).width = w));
  const LAST = widths.length;

  const mergeRow = (row: number, value: string, opts?: { bold?: boolean; size?: number; fill?: string }) => {
    ws.mergeCells(row, 1, row, LAST);
    const c = ws.getCell(row, 1);
    c.value = value;
    c.font = { bold: opts?.bold ?? false, size: opts?.size ?? 11 };
    c.alignment = { horizontal: "left", vertical: "middle" };
    if (opts?.fill) c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: opts.fill } };
    return c;
  };

  // 제목
  ws.mergeCells(1, 1, 1, LAST);
  const t = ws.getCell(1, 1);
  t.value = "파이프 절단 산출서";
  t.font = { bold: true, size: 16 };
  t.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(1).height = 28;
  mergeRow(2, `${title ? `${title}   |   ` : ""}출력일 : ${ymd(new Date())}`);

  // ── 요약 ──
  let r0 = 4;
  mergeRow(r0++, "■ 요약", { bold: true, fill: "FFF1F5F9" });
  const summary: [string, string | number][] = [
    ["원자재 길이 (mm)", stockLength],
    ["날 두께 (mm)", kerf],
    ["총 사용 본수 (본)", r.totalBars],
    ["총 절단 수량 (개)", r.totalCuts],
    ["총 원자재 길이 (mm)", r.totalStock],
    ["절단 사용 길이 (mm)", r.totalUsed],
    ["날두께 손실 (mm)", r.totalKerf],
    ["잔여 합계 (mm)", r.totalRemainder],
    ["총 손실 (mm)", r.totalLoss],
    ["평균 손실률 (%)", r.lossRate],
  ];
  for (const [k, v] of summary) {
    const row = ws.getRow(r0++);
    row.getCell(1).value = k;
    ws.mergeCells(row.number, 1, row.number, 2);
    row.getCell(3).value = v;
    row.getCell(3).numFmt = typeof v === "number" && k.includes("%") ? "#,##0.0" : "#,##0";
    [1, 3].forEach((c) => (row.getCell(c).border = border));
    row.getCell(1).font = { bold: true };
    row.getCell(3).alignment = { horizontal: "right" };
    row.getCell(2).border = border;
  }

  // ── 절단 패턴 요약 (같은 조합끼리 묶음) ──
  r0++;
  mergeRow(r0++, "■ 절단 패턴 요약", { bold: true, fill: "FFF1F5F9" });
  const sHead = ws.getRow(r0++);
  ["절단 규격", "본수", "본당 잔여(mm)", "잔여 합계(mm)"].forEach((h, i) => {
    const c = sHead.getCell(i + 1);
    c.value = h;
    c.font = { bold: true, size: 10 };
    c.alignment = { horizontal: "center" };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_FILL } };
    c.border = border;
  });
  for (const s of summarizePatterns(r.bars)) {
    const row = ws.getRow(r0++);
    const vals = [s.label, s.barCount, s.remainder, s.remainder * s.barCount];
    vals.forEach((v, i) => {
      const c = row.getCell(i + 1);
      c.value = v as ExcelJS.CellValue;
      c.border = border;
      if (i >= 1) c.numFmt = "#,##0";
      c.alignment = { horizontal: i === 0 ? "left" : "right", vertical: "middle" };
    });
  }

  // ── 본별 상세 ──
  r0++;
  mergeRow(r0++, "■ 본별 절단 내역", { bold: true, fill: "FFF1F5F9" });
  const heads = ["파이프", "절단 구성", "절단 개수", "사용 길이(mm)", "날두께 손실(mm)", "잔여(mm)"];
  const hr = ws.getRow(r0++);
  heads.forEach((h, i) => {
    const c = hr.getCell(i + 1);
    c.value = h;
    c.font = { bold: true, size: 10 };
    c.alignment = { horizontal: "center", vertical: "middle" };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_FILL } };
    c.border = border;
  });
  for (const bar of r.bars) {
    const row = ws.getRow(r0++);
    const vals = [
      `파이프 ${bar.index}`,
      formatBar(bar),
      bar.pieces.length,
      bar.usedLength,
      bar.kerfLoss,
      bar.remainder,
    ];
    vals.forEach((v, i) => {
      const c = row.getCell(i + 1);
      c.value = v as ExcelJS.CellValue;
      c.border = border;
      if (i >= 2) c.numFmt = "#,##0";
      c.alignment = { horizontal: i <= 1 ? "left" : "right", vertical: "middle" };
    });
  }
  // 합계
  const tr = ws.getRow(r0++);
  tr.getCell(1).value = `합계 (${r.totalBars}본)`;
  tr.getCell(3).value = r.totalCuts;
  tr.getCell(4).value = r.totalUsed;
  tr.getCell(5).value = r.totalKerf;
  tr.getCell(6).value = r.totalRemainder;
  for (let c = 1; c <= LAST; c++) {
    const cell = tr.getCell(c);
    cell.border = border;
    cell.font = { bold: true };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDBEAFE" } };
    if (c >= 3) cell.numFmt = "#,##0";
    cell.alignment = { horizontal: c <= 2 ? "left" : "right", vertical: "middle" };
  }

  // ── 입력 원본 ──
  r0 += 2;
  mergeRow(r0++, "■ 입력 원본 (절단 규격)", { bold: true, fill: "FFF1F5F9" });
  const ih = ws.getRow(r0++);
  ["번호", "절단 길이(mm)", "수량(개)", "소요 길이(mm)"].forEach((h, i) => {
    const c = ih.getCell(i + 1);
    c.value = h;
    c.font = { bold: true, size: 10 };
    c.alignment = { horizontal: "center" };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_FILL } };
    c.border = border;
  });
  const list = demands.filter((d) => Number(d.length) > 0 && Number(d.qty) > 0);
  list.forEach((d, i) => {
    const row = ws.getRow(r0++);
    const vals = [i + 1, Number(d.length), Number(d.qty), Number(d.length) * Number(d.qty)];
    vals.forEach((v, c) => {
      const cell = row.getCell(c + 1);
      cell.value = v;
      cell.numFmt = "#,##0";
      cell.border = border;
      cell.alignment = { horizontal: c === 0 ? "center" : "right" };
    });
  });

  if (r.invalid.length > 0) {
    r0++;
    const c = mergeRow(r0++, `※ 원자재보다 길어 배치할 수 없는 규격: ${r.invalid.map((x) => `${x.length}mm × ${x.qty}개`).join(", ")}`);
    c.font = { color: { argb: "FFDC2626" }, size: 10 };
  }

  const buf = await wb.xlsx.writeBuffer();
  const fname = encodeURIComponent(`파이프절단_${stockLength}mm_${ymd(new Date())}.xlsx`);
  return new NextResponse(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="pipe-cut.xlsx"; filename*=UTF-8''${fname}`,
    },
  });
}
