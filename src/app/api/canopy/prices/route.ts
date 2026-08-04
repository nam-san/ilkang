import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { SheetPriceTable, PipePriceTable } from "@/lib/canopy";

export const dynamic = "force-dynamic";

/** 단가 마스터 조회 (목록 + 조회용 테이블 형태) */
export async function GET() {
  const [sheet, pipe] = await Promise.all([
    prisma.canopySheetPrice.findMany({ orderBy: [{ sortOrder: "asc" }, { id: "asc" }] }),
    prisma.canopyPipePrice.findMany({ orderBy: [{ sortOrder: "asc" }, { id: "asc" }] }),
  ]);

  const sheetTable: SheetPriceTable = {};
  for (const s of sheet) {
    (sheetTable[s.sheetType] ??= {})[s.coating] = s.unitPrice;
  }
  const pipeTable: PipePriceTable = {};
  for (const p of pipe) {
    (pipeTable[p.spec] ??= {})[p.thickness] = p.unitPrice;
  }

  // 셀렉트 옵션용 (등록 순서 유지)
  const sheetTypes = [...new Set(sheet.map((s) => s.sheetType))];
  const coatings = [...new Set(sheet.map((s) => s.coating))];
  const pipeSpecs = [...new Set(pipe.map((p) => p.spec))];
  const pipeThicknesses = [...new Set(pipe.map((p) => p.thickness))];

  return NextResponse.json({
    sheet,
    pipe,
    sheetTable,
    pipeTable,
    options: { sheetTypes, coatings, pipeSpecs, pipeThicknesses },
  });
}

/**
 * 단가표 항목 신규 추가 (관리자)
 * body: { kind: "sheetType" | "coating" | "pipeSpec" | "pipeThickness", name: string }
 *  - sheetType     : 시트 두께 행 추가 (기존 코팅 전부에 대해 생성)
 *  - coating       : 시트 코팅 열 추가 (기존 시트 두께 전부에 대해 생성)
 *  - pipeSpec      : 각파이프 규격 행 추가 (기존 두께 전부, 기본 미취급)
 *  - pipeThickness : 각파이프 두께 열 추가 (기존 규격 전부, 기본 미취급)
 */
export async function POST(req: NextRequest) {
  const b = await req.json();
  const kind = String(b.kind || "");
  const name = String(b.name || "").trim();
  if (!name) return NextResponse.json({ error: "이름을 입력하세요." }, { status: 400 });

  const [sheet, pipe] = await Promise.all([
    prisma.canopySheetPrice.findMany(),
    prisma.canopyPipePrice.findMany(),
  ]);
  const sheetTypes = [...new Set(sheet.map((s) => s.sheetType))];
  const coatings = [...new Set(sheet.map((s) => s.coating))];
  const pipeSpecs = [...new Set(pipe.map((p) => p.spec))];
  const thicknesses = [...new Set(pipe.map((p) => p.thickness))];

  let created = 0;
  const price = Number(b.unitPrice);
  const defaultSheetPrice = isFinite(price) && price >= 0 ? price : 0;

  if (kind === "sheetType") {
    if (sheetTypes.includes(name))
      return NextResponse.json({ error: "이미 있는 시트 두께입니다." }, { status: 400 });
    const base = sheet.length ? Math.max(...sheet.map((s) => s.sortOrder)) + 1 : 0;
    for (const c of coatings.length ? coatings : ["2코팅", "3코팅"]) {
      await prisma.canopySheetPrice.create({
        data: { sheetType: name, coating: c, unitPrice: defaultSheetPrice, sortOrder: base },
      });
      created++;
    }
  } else if (kind === "coating") {
    if (coatings.includes(name))
      return NextResponse.json({ error: "이미 있는 코팅 구분입니다." }, { status: 400 });
    for (const t of sheetTypes) {
      await prisma.canopySheetPrice.create({
        data: { sheetType: t, coating: name, unitPrice: defaultSheetPrice },
      });
      created++;
    }
  } else if (kind === "pipeSpec") {
    if (pipeSpecs.includes(name))
      return NextResponse.json({ error: "이미 있는 규격입니다." }, { status: 400 });
    const base = pipe.length ? Math.max(...pipe.map((p) => p.sortOrder)) + 10 : 0;
    for (let i = 0; i < thicknesses.length; i++) {
      await prisma.canopyPipePrice.create({
        data: { spec: name, thickness: thicknesses[i], unitPrice: null, sortOrder: base + i },
      });
      created++;
    }
  } else if (kind === "pipeThickness") {
    if (thicknesses.includes(name))
      return NextResponse.json({ error: "이미 있는 두께입니다." }, { status: 400 });
    for (const s of pipeSpecs) {
      await prisma.canopyPipePrice.create({
        data: { spec: s, thickness: name, unitPrice: null },
      });
      created++;
    }
  } else {
    return NextResponse.json({ error: "kind 값이 올바르지 않습니다." }, { status: 400 });
  }

  return NextResponse.json({ ok: true, created }, { status: 201 });
}

/** 단가표 항목 삭제 — ?kind=sheetType|coating|pipeSpec|pipeThickness&name=... */
export async function DELETE(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const kind = sp.get("kind") || "";
  const name = (sp.get("name") || "").trim();
  if (!name) return NextResponse.json({ error: "name 필요" }, { status: 400 });

  let removed = 0;
  if (kind === "sheetType") {
    removed = (await prisma.canopySheetPrice.deleteMany({ where: { sheetType: name } })).count;
  } else if (kind === "coating") {
    removed = (await prisma.canopySheetPrice.deleteMany({ where: { coating: name } })).count;
  } else if (kind === "pipeSpec") {
    removed = (await prisma.canopyPipePrice.deleteMany({ where: { spec: name } })).count;
  } else if (kind === "pipeThickness") {
    removed = (await prisma.canopyPipePrice.deleteMany({ where: { thickness: name } })).count;
  } else {
    return NextResponse.json({ error: "kind 값이 올바르지 않습니다." }, { status: 400 });
  }
  return NextResponse.json({ ok: true, removed });
}

/** 단가 수정 (관리자) — body: { sheet?: [{id, unitPrice}], pipe?: [{id, unitPrice|null}], updatedBy? } */
export async function PUT(req: NextRequest) {
  const b = await req.json();
  const updatedBy = b.updatedBy?.trim() || null;
  let updated = 0;

  for (const s of Array.isArray(b.sheet) ? b.sheet : []) {
    const price = Number(s.unitPrice);
    if (!s.id || !isFinite(price) || price < 0) continue;
    await prisma.canopySheetPrice.update({
      where: { id: Number(s.id) },
      data: { unitPrice: price, updatedBy },
    });
    updated++;
  }
  for (const p of Array.isArray(b.pipe) ? b.pipe : []) {
    if (!p.id) continue;
    const raw = p.unitPrice;
    const price =
      raw === null || raw === "" || raw === undefined ? null : Number(raw);
    if (price !== null && (!isFinite(price) || price < 0)) continue;
    await prisma.canopyPipePrice.update({
      where: { id: Number(p.id) },
      data: { unitPrice: price, updatedBy },
    });
    updated++;
  }
  return NextResponse.json({ ok: true, updated });
}
