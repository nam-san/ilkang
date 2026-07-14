import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import ExcelJS from "exceljs";

export const dynamic = "force-dynamic";

const trunc = (u: number, q: number) => Math.trunc(u * q);
const groupLevel = (name: string) => {
  const m = name.trim().match(/^(\d+)(-(\d+))?\./);
  if (!m) return 1;
  return m[3] ? 2 : 1;
};

const HEADER_FILL = "FFEFF3F8";
const GROUP_FILL = "FFF1F5F9";
const thin = { style: "thin" as const, color: { argb: "FFCBD5E1" } };
const border = { top: thin, left: thin, bottom: thin, right: thin };

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const projectId = Number(params.id);
  const project = await prisma.estimateProject.findUnique({ where: { id: projectId } });
  if (!project) {
    return NextResponse.json({ error: "공사 없음" }, { status: 404 });
  }
  const lines = await prisma.estimateLine.findMany({
    where: { projectId },
    orderBy: { sortOrder: "asc" },
    include: {
      windowType: true,
      components: { orderBy: { sortOrder: "asc" } },
    },
  });

  // 그룹 소계 (계층: level 1/2)
  const subtotalOf = (i: number) => {
    const L = groupLevel(lines[i].itemName);
    let mat = 0, labor = 0, exp = 0;
    for (let j = i + 1; j < lines.length; j++) {
      const n = lines[j];
      if (n.isGroup && groupLevel(n.itemName) <= L) break;
      if (!n.isGroup) {
        mat += trunc(n.matUnitPrice, n.quantity);
        labor += trunc(n.laborUnitPrice, n.quantity);
        exp += trunc(n.expenseUnitPrice, n.quantity);
      }
    }
    return { mat, labor, exp, sum: mat + labor + exp };
  };

  const wb = new ExcelJS.Workbook();
  wb.creator = "일강이앤지 통합관리시스템";
  const ws = wb.addWorksheet("견적내역서");

  // 열 너비 (A~T = 20열)
  const widths = [10, 34, 26, 6, 8, 12, 12, 11, 12, 13, 13, 12, 14, 14, 11, 10, 13, 11, 11, 13];
  widths.forEach((w, i) => (ws.getColumn(i + 1).width = w));
  const LAST = 20; // T

  // R1: 제목
  ws.mergeCells(1, 1, 1, LAST);
  const t = ws.getCell(1, 1);
  t.value = "견 적 내 역 서";
  t.font = { bold: true, size: 16 };
  t.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(1).height = 28;

  // R2: 공사명
  ws.mergeCells(2, 1, 2, LAST);
  const s = ws.getCell(2, 1);
  s.value = `공 사 명 : ${project.siteName}${project.workType ? `  (${project.workType})` : ""}`;
  s.font = { bold: true, size: 11 };
  s.alignment = { horizontal: "left", vertical: "middle" };
  ws.getRow(2).height = 20;

  // R3~R4: 헤더
  const setH = (r: number, c: number, v: string) => {
    const cell = ws.getCell(r, c);
    cell.value = v;
    cell.font = { bold: true, size: 10 };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_FILL } };
    cell.border = border;
  };
  const mergeH = (r1: number, c1: number, r2: number, c2: number, v: string) => {
    ws.mergeCells(r1, c1, r2, c2);
    setH(r1, c1, v);
    for (let r = r1; r <= r2; r++) for (let c = c1; c <= c2; c++) ws.getCell(r, c).border = border;
  };
  mergeH(3, 1, 4, 1, "CODE");
  mergeH(3, 2, 4, 2, "품 명");
  mergeH(3, 3, 4, 3, "규 격");
  mergeH(3, 4, 4, 4, "단위");
  mergeH(3, 5, 4, 5, "수량");
  mergeH(3, 6, 3, 9, "단 가");
  setH(4, 6, "재료비"); setH(4, 7, "노무비"); setH(4, 8, "경비"); setH(4, 9, "합계");
  mergeH(3, 10, 3, 13, "금 액");
  setH(4, 10, "재료비"); setH(4, 11, "노무비"); setH(4, 12, "경비"); setH(4, 13, "합계");
  mergeH(3, 14, 4, 14, "비 고");
  mergeH(3, 15, 4, 15, "총중량\n(kg)");
  mergeH(3, 16, 4, 16, "바종류");
  mergeH(3, 17, 4, 17, "총자재비");
  mergeH(3, 18, 4, 18, "시공비");
  mergeH(3, 19, 4, 19, "PJ시공비");
  mergeH(3, 20, 4, 20, "총시공비");

  // 데이터
  let r = 5;
  lines.forEach((l, i) => {
    const row = ws.getRow(r);
    if (l.isGroup) {
      const st = subtotalOf(i);
      row.getCell(1).value = l.code ?? "";
      row.getCell(2).value = l.itemName;
      row.getCell(10).value = st.mat;
      row.getCell(11).value = st.labor;
      row.getCell(12).value = st.exp;
      row.getCell(13).value = st.sum;
      for (let c = 1; c <= LAST; c++) {
        const cell = row.getCell(c);
        cell.font = { bold: true };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: GROUP_FILL } };
      }
    } else {
      const matAmt = trunc(l.matUnitPrice, l.quantity);
      const laborAmt = trunc(l.laborUnitPrice, l.quantity);
      const expAmt = trunc(l.expenseUnitPrice, l.quantity);
      const vals = [
        l.code ?? "", l.itemName, l.spec ?? "", l.unit ?? "", l.quantity,
        l.matUnitPrice, l.laborUnitPrice, l.expenseUnitPrice,
        l.matUnitPrice + l.laborUnitPrice + l.expenseUnitPrice,
        matAmt, laborAmt, expAmt, matAmt + laborAmt + expAmt,
        l.note ?? "",
        l.totalWeight ?? "", l.barType ?? "",
        l.matTotalCost ?? "", l.installCostCalc ?? "", l.pjInstallCost || "", l.laborTotalCost ?? "",
      ];
      vals.forEach((v, c) => (row.getCell(c + 1).value = v as ExcelJS.CellValue));
    }
    // 서식: 숫자열 포맷 + 테두리 + 정렬
    for (let c = 1; c <= LAST; c++) {
      const cell = row.getCell(c);
      cell.border = border;
      if (c === 15) cell.numFmt = "#,##0.000";
      else if (c >= 5 && c !== 14 && c !== 16) cell.numFmt = "#,##0";
      if (c === 2 || c === 3 || c === 14 || c === 16) cell.alignment = { horizontal: "left", vertical: "middle", wrapText: c === 3 };
      else cell.alignment = { horizontal: c === 1 || c === 4 ? "center" : "right", vertical: "middle" };
    }
    r++;
  });

  // 총계 행
  let gMat = 0, gLabor = 0, gExp = 0;
  for (const l of lines) if (!l.isGroup) {
    gMat += trunc(l.matUnitPrice, l.quantity);
    gLabor += trunc(l.laborUnitPrice, l.quantity);
    gExp += trunc(l.expenseUnitPrice, l.quantity);
  }
  const tr = ws.getRow(r);
  ws.mergeCells(r, 1, r, 9);
  tr.getCell(1).value = "총 합 계";
  tr.getCell(10).value = gMat;
  tr.getCell(11).value = gLabor;
  tr.getCell(12).value = gExp;
  tr.getCell(13).value = gMat + gLabor + gExp;
  for (let c = 1; c <= LAST; c++) {
    const cell = tr.getCell(c);
    cell.border = border;
    cell.font = { bold: true, size: 11 };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDBEAFE" } };
    if (c >= 10 && c <= 13) cell.numFmt = "#,##0";
    cell.alignment = { horizontal: c === 1 ? "center" : "right", vertical: "middle" };
  }
  ws.views = [{ state: "frozen", ySplit: 4 }];

  // ── 시트2: 자재산출 상세 ──
  const ws2 = wb.addWorksheet("자재산출");
  const h2 = ["품명", "창호유형", "부재", "W", "개수W", "H", "개수H", "단위중량", "길이(M)", "중량(kg)"];
  [30, 18, 18, 9, 8, 9, 8, 11, 10, 11].forEach((w, i) => (ws2.getColumn(i + 1).width = w));
  const hr = ws2.getRow(1);
  h2.forEach((v, i) => {
    const cell = hr.getCell(i + 1);
    cell.value = v;
    cell.font = { bold: true };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_FILL } };
    cell.alignment = { horizontal: "center" };
    cell.border = border;
  });
  let rr = 2;
  for (const l of lines) {
    if (l.isGroup || l.components.length === 0) continue;
    l.components.forEach((c, ci) => {
      const row = ws2.getRow(rr);
      const vals = [
        ci === 0 ? l.itemName : "", ci === 0 ? l.windowType?.name ?? "" : "",
        c.compName, c.widthMm, c.countW, c.heightMm, c.countH, c.unitWeight, c.lengthM, c.weightKg,
      ];
      vals.forEach((v, i) => {
        const cell = row.getCell(i + 1);
        cell.value = v as ExcelJS.CellValue;
        cell.border = border;
        if (i >= 3 && i <= 6) cell.numFmt = "#,##0";
        if (i === 7 || i === 8) cell.numFmt = "#,##0.000";
        if (i === 9) cell.numFmt = "#,##0.0000";
      });
      rr++;
    });
    // 라인 소계(총중량)
    const srow = ws2.getRow(rr);
    srow.getCell(9).value = "총중량";
    srow.getCell(10).value = l.totalWeight ?? 0;
    srow.getCell(9).font = { bold: true };
    srow.getCell(10).font = { bold: true };
    srow.getCell(10).numFmt = "#,##0.0000";
    rr++;
  }

  const buf = await wb.xlsx.writeBuffer();
  const fname = encodeURIComponent(`견적내역서_${project.siteName}.xlsx`);
  return new NextResponse(buf, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="estimate.xlsx"; filename*=UTF-8''${fname}`,
    },
  });
}
