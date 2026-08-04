import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import ExcelJS from "exceljs";
import { ymd } from "@/lib/format";

export const dynamic = "force-dynamic";

const HEADER_FILL = "FFEFF3F8";
const thin = { style: "thin" as const, color: { argb: "FFCBD5E1" } };
const border = { top: thin, left: thin, bottom: thin, right: thin };

// 캐노피 산출서 엑셀 다운로드 (원본 엑셀과 동일한 컬럼 순서)
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const est = await prisma.canopyEstimate.findUnique({
    where: { id: Number(params.id) },
    include: { items: { orderBy: { seq: "asc" } }, contract: true },
  });
  if (!est) return NextResponse.json({ error: "산출서 없음" }, { status: 404 });

  const wb = new ExcelJS.Workbook();
  wb.creator = "일강이앤지 통합관리시스템";
  const ws = wb.addWorksheet("캐노피산출");

  // W H L M2 각파이프본수 시트두께 시트코팅 각파이프두께 각파이프규격 시트금액 각파이프금액 합계
  const widths = [10, 10, 10, 11, 13, 15, 11, 13, 14, 14, 15, 15];
  widths.forEach((w, i) => (ws.getColumn(i + 1).width = w));
  const LAST = widths.length;

  ws.mergeCells(1, 1, 1, LAST);
  const t = ws.getCell(1, 1);
  t.value = "캐노피 시트 · 각파이프 금액 산출서";
  t.font = { bold: true, size: 15 };
  t.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(1).height = 26;

  ws.mergeCells(2, 1, 2, LAST);
  ws.getCell(2, 1).value =
    `현장명 : ${est.contract.siteName}   |   산출서 : ${est.name}   |   출력일 : ${ymd(new Date())}`;
  ws.getCell(2, 1).alignment = { horizontal: "left", vertical: "middle" };

  const heads = [
    "W", "H", "L", "M2", "각파이프 본수", "시트 두께", "시트 코팅",
    "각파이프 두께", "각파이프 규격", "시트금액", "각파이프 금액", "합계",
  ];
  const hr = ws.getRow(4);
  heads.forEach((h, i) => {
    const c = hr.getCell(i + 1);
    c.value = h;
    c.font = { bold: true, size: 10 };
    c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_FILL } };
    c.border = border;
  });

  let r = 5;
  let area = 0, qty = 0, sheetSum = 0, pipeSum = 0, totalSum = 0, unsupported = 0;
  for (const it of est.items) {
    const row = ws.getRow(r);
    const vals = [
      it.w, it.h, it.l, it.areaM2, it.pipeQty,
      it.sheetType ?? "", it.coating ?? "", it.pipeThickness ?? "", it.pipeSpec ?? "",
      it.unsupported ? "미취급" : it.sheetAmount ?? "",
      it.unsupported ? "미취급" : it.pipeAmount ?? "",
      it.unsupported ? "미취급" : it.totalAmount ?? "",
    ];
    vals.forEach((v, i) => {
      const c = row.getCell(i + 1);
      c.value = v as ExcelJS.CellValue;
      c.border = border;
      if (i <= 2 || i === 4) c.numFmt = "#,##0";
      if (i === 3) c.numFmt = "#,##0.00";
      if (i >= 9 && typeof v === "number") c.numFmt = "#,##0";
      c.alignment = {
        horizontal: i >= 5 && i <= 8 ? "left" : "right",
        vertical: "middle",
      };
      if (it.unsupported && i >= 9) c.font = { color: { argb: "FFDC2626" } };
    });
    area += it.areaM2;
    qty += it.pipeQty;
    if (it.unsupported) unsupported++;
    else {
      sheetSum += it.sheetAmount ?? 0;
      pipeSum += it.pipeAmount ?? 0;
      totalSum += it.totalAmount ?? 0;
    }
    r++;
  }

  // 합계
  const tr = ws.getRow(r);
  ws.mergeCells(r, 1, r, 3);
  tr.getCell(1).value = `합계 (${est.items.length}건)`;
  tr.getCell(4).value = Math.round(area * 100) / 100;
  tr.getCell(4).numFmt = "#,##0.00";
  tr.getCell(5).value = qty;
  tr.getCell(5).numFmt = "#,##0";
  tr.getCell(10).value = sheetSum;
  tr.getCell(11).value = pipeSum;
  tr.getCell(12).value = totalSum;
  [10, 11, 12].forEach((c) => (tr.getCell(c).numFmt = "#,##0"));
  for (let c = 1; c <= LAST; c++) {
    const cell = tr.getCell(c);
    cell.border = border;
    cell.font = { bold: true, size: 11 };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDBEAFE" } };
    cell.alignment = { horizontal: c === 1 ? "center" : "right", vertical: "middle" };
  }
  r++;

  if (unsupported > 0) {
    ws.mergeCells(r, 1, r, LAST);
    const c = ws.getCell(r, 1);
    c.value = `※ 미취급 조합 ${unsupported}건은 금액 합계에서 제외되었습니다.`;
    c.font = { color: { argb: "FFDC2626" }, size: 10 };
  }

  ws.views = [{ state: "frozen", ySplit: 4 }];

  const buf = await wb.xlsx.writeBuffer();
  const fname = encodeURIComponent(`캐노피산출_${est.contract.siteName}_${est.name}.xlsx`);
  return new NextResponse(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="canopy.xlsx"; filename*=UTF-8''${fname}`,
    },
  });
}
