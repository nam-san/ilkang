import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as XLSX from "xlsx";

export const dynamic = "force-dynamic";

// 헤더명 후보 매칭 (한글/영문 유연 대응)
function pick(row: Record<string, unknown>, keys: string[]): string {
  for (const k of Object.keys(row)) {
    const norm = k.replace(/\s/g, "");
    if (keys.some((cand) => norm.includes(cand))) {
      const v = row[k];
      return v === null || v === undefined ? "" : String(v).trim();
    }
  }
  return "";
}

// 특정 입찰에 엑셀 견적서 업로드 → 파싱 → 항목 일괄 추가
export async function POST(req: NextRequest) {
  const form = await req.formData();
  const bidId = Number(form.get("bidId"));
  const file = form.get("file") as File | null;

  if (!bidId) {
    return NextResponse.json({ error: "입찰(bidId)이 필요합니다." }, { status: 400 });
  }
  if (!file) {
    return NextResponse.json({ error: "엑셀 파일이 필요합니다." }, { status: 400 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  let rows: Record<string, unknown>[];
  try {
    const wb = XLSX.read(buf, { type: "buffer" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });
  } catch {
    return NextResponse.json(
      { error: "엑셀 파일을 읽을 수 없습니다. 형식을 확인하세요." },
      { status: 400 }
    );
  }

  const data = rows
    .map((r) => {
      const itemName = pick(r, ["품명", "품목", "name", "item"]);
      const spec = pick(r, ["규격", "사양", "상세", "spec", "detail"]);
      const qtyRaw = pick(r, ["수량", "qty", "quantity"]);
      const priceRaw = pick(r, ["단가", "price"]);
      const unit = pick(r, ["단위", "unit"]);
      const quantity = parseFloat(qtyRaw.replace(/[^0-9.-]/g, "")) || 0;
      const unitPrice = priceRaw
        ? parseFloat(priceRaw.replace(/[^0-9.-]/g, "")) || null
        : null;
      return { bidId, itemName, spec: spec || null, quantity, unit: unit || null, unitPrice };
    })
    .filter((d) => d.itemName);

  if (data.length === 0) {
    return NextResponse.json(
      { error: "'품명' 컬럼을 찾지 못했습니다. 헤더에 품명/수량 등이 있는지 확인하세요." },
      { status: 400 }
    );
  }

  await prisma.estimateItem.createMany({ data });
  return NextResponse.json({ ok: true, count: data.length }, { status: 201 });
}
