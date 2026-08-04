import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import ExcelJS from "exceljs";
import { ymd } from "@/lib/format";

export const dynamic = "force-dynamic";

const HEADER_FILL = "FFEFF3F8";
const thin = { style: "thin" as const, color: { argb: "FFCBD5E1" } };
const border = { top: thin, left: thin, bottom: thin, right: thin };

// 시트 면적 산출서 엑셀 다운로드
export async function GET(req: NextRequest) {
  const contractId = Number(req.nextUrl.searchParams.get("contractId"));
  if (!contractId) {
    return NextResponse.json({ error: "contractId 필요" }, { status: 400 });
  }
  const contract = await prisma.contract.findUnique({ where: { id: contractId } });
  if (!contract) return NextResponse.json({ error: "현장 없음" }, { status: 404 });

  const items = await prisma.sheetAreaItem.findMany({
    where: { contractId },
    orderBy: [{ location: "asc" }, { sortOrder: "asc" }, { id: "asc" }],
  });

  const wb = new ExcelJS.Workbook();
  wb.creator = "일강이앤지 통합관리시스템";
  const ws = wb.addWorksheet("시트면적산출");

  const widths = [16, 22, 11, 12, 11, 11, 12, 11, 12, 12, 9, 13];
  widths.forEach((w, i) => (ws.getColumn(i + 1).width = w));
  const LAST = widths.length;

  // 제목
  ws.mergeCells(1, 1, 1, LAST);
  const t = ws.getCell(1, 1);
  t.value = "시 트 면 적 산 출 서";
  t.font = { bold: true, size: 16 };
  t.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(1).height = 28;

  ws.mergeCells(2, 1, 2, LAST);
  const s = ws.getCell(2, 1);
  s.value = `현장명 : ${contract.siteName}   |   건설사 : ${contract.builderName}   |   출력일 : ${ymd(new Date())}`;
  s.alignment = { horizontal: "left", vertical: "middle" };
  ws.getRow(2).height = 20;

  // 헤더
  const heads = [
    "공사 위치", "항목", "가로", "가로후렌지", "가로날개",
    "세로", "세로후렌지", "세로날개", "전개 가로", "전개 세로", "개수", "면적(㎡)",
  ];
  const hr = ws.getRow(4);
  heads.forEach((h, i) => {
    const cell = hr.getCell(i + 1);
    cell.value = h;
    cell.font = { bold: true, size: 10 };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_FILL } };
    cell.border = border;
  });

  // 위치별 그룹 + 소계
  let r = 5;
  let grand = 0;
  const groups = new Map<string, typeof items>();
  for (const it of items) {
    if (!groups.has(it.location)) groups.set(it.location, []);
    groups.get(it.location)!.push(it);
  }

  for (const [loc, list] of groups) {
    let sub = 0;
    for (const it of list) {
      const ew = it.width + it.widthFlange + it.widthWing;
      const eh = it.height + it.heightFlange + it.heightWing;
      const row = ws.getRow(r);
      const vals = [
        loc, it.itemName ?? "", it.width, it.widthFlange, it.widthWing,
        it.height, it.heightFlange, it.heightWing, ew, eh, it.qty, it.area,
      ];
      vals.forEach((v, i) => {
        const cell = row.getCell(i + 1);
        cell.value = v as ExcelJS.CellValue;
        cell.border = border;
        if (i >= 2 && i <= 10) cell.numFmt = "#,##0";
        if (i === 11) cell.numFmt = "#,##0.000";
        cell.alignment = { horizontal: i <= 1 ? "left" : "right", vertical: "middle" };
      });
      sub += it.area;
      grand += it.area;
      r++;
    }
    // 위치 소계
    const sr = ws.getRow(r);
    ws.mergeCells(r, 1, r, 11);
    sr.getCell(1).value = `${loc} 소계 (${list.length}건)`;
    sr.getCell(12).value = sub;
    sr.getCell(12).numFmt = "#,##0.000";
    for (let c = 1; c <= LAST; c++) {
      const cell = sr.getCell(c);
      cell.border = border;
      cell.font = { bold: true };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };
      cell.alignment = { horizontal: c === 1 ? "right" : "right", vertical: "middle" };
    }
    r++;
  }

  // 총계
  const tr = ws.getRow(r);
  ws.mergeCells(r, 1, r, 11);
  tr.getCell(1).value = `총 합계 (${items.length}건)`;
  tr.getCell(12).value = grand;
  tr.getCell(12).numFmt = "#,##0.000";
  for (let c = 1; c <= LAST; c++) {
    const cell = tr.getCell(c);
    cell.border = border;
    cell.font = { bold: true, size: 11 };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDBEAFE" } };
    cell.alignment = { horizontal: "right", vertical: "middle" };
  }

  ws.views = [{ state: "frozen", ySplit: 4 }];

  const buf = await wb.xlsx.writeBuffer();
  const fname = encodeURIComponent(`시트면적산출_${contract.siteName}_${ymd(new Date())}.xlsx`);
  return new NextResponse(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="sheet-area.xlsx"; filename*=UTF-8''${fname}`,
    },
  });
}
