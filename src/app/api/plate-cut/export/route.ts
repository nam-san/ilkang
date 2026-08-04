import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import ExcelJS from "exceljs";
import { calcPlateCut, formatBin, toM2, type PlateDemand } from "@/lib/plateCut";
import { ymd } from "@/lib/format";

export const dynamic = "force-dynamic";

const HEADER_FILL = "FFEFF3F8";
const thin = { style: "thin" as const, color: { argb: "FFCBD5E1" } };
const border = { top: thin, left: thin, bottom: thin, right: thin };

// 원판 절단 결과 엑셀 다운로드
export async function POST(req: NextRequest) {
  const b = await req.json();
  const demands: PlateDemand[] = Array.isArray(b.demands) ? b.demands : [];
  const title = (b.title || "").trim();
  if (demands.length === 0) {
    return NextResponse.json({ error: "컷팅 규격이 필요합니다." }, { status: 400 });
  }

  const plates = await prisma.plateSpec.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } });
  const r = calcPlateCut(plates, demands); // 서버 재계산

  const wb = new ExcelJS.Workbook();
  wb.creator = "일강이앤지 통합관리시스템";
  const ws = wb.addWorksheet("원판절단");

  const widths = [10, 14, 18, 42, 14, 16, 16, 12];
  widths.forEach((w, i) => (ws.getColumn(i + 1).width = w));
  const LAST = widths.length;

  const mergeRow = (row: number, value: string, opts?: { bold?: boolean; fill?: string }) => {
    ws.mergeCells(row, 1, row, LAST);
    const c = ws.getCell(row, 1);
    c.value = value;
    c.font = { bold: opts?.bold ?? false, size: 11 };
    c.alignment = { horizontal: "left", vertical: "middle" };
    if (opts?.fill) c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: opts.fill } };
    return c;
  };

  ws.mergeCells(1, 1, 1, LAST);
  const t = ws.getCell(1, 1);
  t.value = "원판 절단 산출서";
  t.font = { bold: true, size: 16 };
  t.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(1).height = 28;
  mergeRow(2, `${title ? `${title}   |   ` : ""}출력일 : ${ymd(new Date())}`);

  // ── 요약 ──
  let r0 = 4;
  mergeRow(r0++, "■ 요약", { bold: true, fill: "FFF1F5F9" });
  const summary: [string, string | number][] = [
    ["총 사용 원판 (매)", r.totalPlates],
    ["총 절단 수량 (개)", r.totalPieces],
    ["투입 원판 면적 (㎡)", toM2(r.totalPlateArea)],
    ["실제 사용 면적 (㎡)", toM2(r.totalUsedArea)],
    ["손실 면적 (㎡)", toM2(r.totalPlateArea - r.totalUsedArea)],
    ["평균 손실률 (%)", r.lossRate],
  ];
  for (const [k, v] of summary) {
    const row = ws.getRow(r0++);
    ws.mergeCells(row.number, 1, row.number, 2);
    row.getCell(1).value = k;
    row.getCell(1).font = { bold: true };
    row.getCell(3).value = v;
    row.getCell(3).numFmt = String(k).includes("㎡") || String(k).includes("%") ? "#,##0.00" : "#,##0";
    row.getCell(3).alignment = { horizontal: "right" };
    [1, 2, 3].forEach((c) => (row.getCell(c).border = border));
  }

  // ── 원판별 사용 매수 ──
  r0++;
  mergeRow(r0++, "■ 원판별 사용 매수", { bold: true, fill: "FFF1F5F9" });
  const uh = ws.getRow(r0++);
  ["원판명", "사용 매수"].forEach((h, i) => {
    const c = uh.getCell(i + 1);
    c.value = h;
    c.font = { bold: true, size: 10 };
    c.alignment = { horizontal: "center" };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_FILL } };
    c.border = border;
  });
  for (const u of r.plateUsage) {
    const row = ws.getRow(r0++);
    row.getCell(1).value = u.name;
    row.getCell(2).value = u.count;
    row.getCell(2).numFmt = "#,##0";
    row.getCell(2).alignment = { horizontal: "right" };
    [1, 2].forEach((c) => (row.getCell(c).border = border));
  }

  // ── 규격별 배치 현황 ──
  r0++;
  mergeRow(r0++, "■ 컷팅 규격별 배치 현황", { bold: true, fill: "FFF1F5F9" });
  const sh = ws.getRow(r0++);
  ["번호", "가로(mm)", "세로(mm)", "요청 수량", "배치 수량", "사용 면적(㎡)"].forEach((h, i) => {
    const c = sh.getCell(i + 1);
    c.value = h;
    c.font = { bold: true, size: 10 };
    c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_FILL } };
    c.border = border;
  });
  for (const s of r.specs) {
    const row = ws.getRow(r0++);
    const vals = [s.specIndex + 1, s.width, s.height, s.qty, s.placed, toM2(s.width * s.height * s.placed)];
    vals.forEach((v, i) => {
      const c = row.getCell(i + 1);
      c.value = v;
      c.border = border;
      c.numFmt = i === 5 ? "#,##0.00" : "#,##0";
      c.alignment = { horizontal: i === 0 ? "center" : "right", vertical: "middle" };
    });
  }

  // ── 원판별 배치 상세 (한 판에 여러 규격 혼합) ──
  r0++;
  mergeRow(r0++, "■ 원판별 배치 상세 (혼합 배치)", { bold: true, fill: "FFF1F5F9" });
  const heads = [
    "판 번호", "원판명", "원판 규격(mm)", "배치 내역",
    "배치 수량(개)", "사용 면적(㎡)", "손실 면적(㎡)", "손실률(%)",
  ];
  const hr = ws.getRow(r0++);
  heads.forEach((h, i) => {
    const c = hr.getCell(i + 1);
    c.value = h;
    c.font = { bold: true, size: 10 };
    c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_FILL } };
    c.border = border;
  });
  for (const bin of r.bins) {
    const row = ws.getRow(r0++);
    const vals = [
      bin.index,
      bin.plate.name,
      `${bin.plate.width} × ${bin.plate.height}`,
      formatBin(bin),
      bin.placements.length,
      toM2(bin.usedArea),
      toM2(bin.plateArea - bin.usedArea),
      bin.lossRate,
    ];
    vals.forEach((v, i) => {
      const c = row.getCell(i + 1);
      c.value = v as ExcelJS.CellValue;
      c.border = border;
      if (i === 4) c.numFmt = "#,##0";
      if (i >= 5) c.numFmt = "#,##0.00";
      c.alignment = {
        horizontal: i === 0 ? "center" : i >= 4 ? "right" : "left",
        vertical: "middle",
      };
    });
  }
  // 합계
  const tr = ws.getRow(r0++);
  ws.mergeCells(r0 - 1, 1, r0 - 1, 3);
  tr.getCell(1).value = `합계 (${r.totalPlates}매)`;
  tr.getCell(5).value = r.totalPieces;
  tr.getCell(6).value = toM2(r.totalUsedArea);
  tr.getCell(7).value = toM2(r.totalPlateArea - r.totalUsedArea);
  tr.getCell(8).value = r.lossRate;
  for (let c = 1; c <= LAST; c++) {
    const cell = tr.getCell(c);
    cell.border = border;
    cell.font = { bold: true };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDBEAFE" } };
    if (c === 5) cell.numFmt = "#,##0";
    if (c >= 6) cell.numFmt = "#,##0.00";
    cell.alignment = { horizontal: c === 1 ? "center" : "right", vertical: "middle" };
  }

  // ── 입력 원본 ──
  r0 += 2;
  mergeRow(r0++, "■ 입력 원본 (컷팅 규격)", { bold: true, fill: "FFF1F5F9" });
  const ih = ws.getRow(r0++);
  ["번호", "가로(mm)", "세로(mm)", "수량(개)"].forEach((h, i) => {
    const c = ih.getCell(i + 1);
    c.value = h;
    c.font = { bold: true, size: 10 };
    c.alignment = { horizontal: "center" };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_FILL } };
    c.border = border;
  });
  demands
    .filter((d) => Number(d.width) > 0 && Number(d.height) > 0 && Number(d.qty) > 0)
    .forEach((d, i) => {
      const row = ws.getRow(r0++);
      [i + 1, Number(d.width), Number(d.height), Number(d.qty)].forEach((v, c) => {
        const cell = row.getCell(c + 1);
        cell.value = v;
        cell.numFmt = "#,##0";
        cell.border = border;
        cell.alignment = { horizontal: c === 0 ? "center" : "right" };
      });
    });

  if (r.invalid.length > 0) {
    r0++;
    const c = mergeRow(
      r0++,
      `※ 등록된 원판에 배치할 수 없는 규격: ${r.invalid.map((x) => `${x.width}×${x.height} × ${x.qty}개`).join(", ")}`
    );
    c.font = { color: { argb: "FFDC2626" }, size: 10 };
  }

  const buf = await wb.xlsx.writeBuffer();
  const fname = encodeURIComponent(`원판절단_${ymd(new Date())}.xlsx`);
  return new NextResponse(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="plate-cut.xlsx"; filename*=UTF-8''${fname}`,
    },
  });
}
