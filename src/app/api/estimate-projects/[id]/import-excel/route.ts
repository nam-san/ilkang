import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as XLSX from "xlsx";
import { parseSpec, recommendWindowType } from "@/lib/windowCalc";

export const dynamic = "force-dynamic";

// 엑셀 업로드 → A~N 파싱 → EstimateLine 생성 (규격 파싱 + 창호유형 자동추천)
// 컬럼: A(0)=CODE B(1)=품명 C(2)=규격 D(3)=단위 E(4)=수량
//       F(5)=재료비단가 G(6)=노무비단가 H(7)=경비단가  N(13)=비고
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const projectId = Number(params.id);
  const form = await req.formData();
  const file = form.get("file") as File | null;
  const replace = form.get("replace") === "true";
  if (!file) {
    return NextResponse.json({ error: "엑셀 파일이 필요합니다." }, { status: 400 });
  }

  // 기존 창호유형명(자동추천용)
  const types = await prisma.windowType.findMany({
    where: { projectId, active: true },
    select: { id: true, name: true },
  });
  const typeNames = types.map((t) => t.name);
  const typeByName = new Map(types.map((t) => [t.name, t.id]));

  let aoa: unknown[][];
  try {
    const wb = XLSX.read(Buffer.from(await file.arrayBuffer()), { type: "buffer" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "" });
  } catch {
    return NextResponse.json({ error: "엑셀을 읽을 수 없습니다." }, { status: 400 });
  }

  const S = (v: unknown) => (v === null || v === undefined ? "" : String(v).trim());
  const N = (v: unknown) => {
    const n = parseFloat(S(v).replace(/[^0-9.-]/g, ""));
    return isNaN(n) ? 0 : n;
  };

  type Row = {
    projectId: number;
    code: string | null;
    itemName: string;
    isGroup: boolean;
    spec: string | null;
    unit: string | null;
    quantity: number;
    matUnitPrice: number;
    laborUnitPrice: number;
    expenseUnitPrice: number;
    windowTypeId: number | null;
    widthMm: number | null;
    heightMm: number | null;
    parseWarning: boolean;
    note: string | null;
    sortOrder: number;
  };

  const rows: Row[] = [];
  let order = 0;
  for (const r of aoa) {
    const itemName = S(r[1]); // B
    if (!itemName) continue;
    // 헤더/제목행 스킵 (내부 공백 제거 후 판정)
    const nameKey = itemName.replace(/\s/g, "");
    if (
      /^(견적|공사명|품명|CODE)/.test(nameKey) ||
      ["재료비", "노무비", "경비", "합계", "비고"].includes(nameKey)
    )
      continue;

    const spec = S(r[2]); // C
    const unit = S(r[3]); // D
    const qty = N(r[4]); // E
    const mat = N(r[5]); // F
    const labor = N(r[6]); // G
    const exp = N(r[7]); // H
    const note = S(r[13]); // N

    // 그룹/소계/요약 행: 규격·단위·수량이 모두 없음 (실제 품목은 규격·수량을 가짐)
    const isGroup = !spec && !unit && qty === 0;

    let widthMm: number | null = null;
    let heightMm: number | null = null;
    let parseWarning = false;
    let windowTypeId: number | null = null;

    if (!isGroup) {
      const p = parseSpec(spec);
      widthMm = p.widthMm;
      heightMm = p.heightMm;
      // W×H 형태의 규격(치수 표기)인데 파싱 실패한 경우만 경고.
      // 사다리·에어백 등 치수 규격이 아닌 품목은 경고하지 않음.
      const looksDimensional = /[x×]/i.test(spec);
      parseWarning = !!spec && looksDimensional && !p.ok;
      const rec = recommendWindowType(`${itemName} ${spec} ${note}`, typeNames);
      windowTypeId = rec ? typeByName.get(rec) ?? null : null;
    }

    rows.push({
      projectId,
      code: S(r[0]) || null,
      itemName,
      isGroup,
      spec: spec || null,
      unit: unit || null,
      quantity: qty,
      matUnitPrice: mat,
      laborUnitPrice: labor,
      expenseUnitPrice: exp,
      windowTypeId,
      widthMm,
      heightMm,
      parseWarning,
      note: note || null,
      sortOrder: order++,
    });
  }

  if (rows.length === 0) {
    return NextResponse.json({ error: "인식된 라인이 없습니다. (B열 품명 확인)" }, { status: 400 });
  }

  if (replace) {
    await prisma.estimateLine.deleteMany({ where: { projectId } });
  }
  await prisma.estimateLine.createMany({ data: rows });

  const warnings = rows.filter((r) => r.parseWarning).length;
  const recommended = rows.filter((r) => r.windowTypeId).length;
  return NextResponse.json(
    { ok: true, count: rows.length, warnings, recommended },
    { status: 201 }
  );
}
