import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sheetArea } from "@/lib/sheetArea";

export const dynamic = "force-dynamic";

// 항목 수정 (면적 재계산)
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = Number(params.id);
  const b = await req.json();
  const cur = await prisma.sheetAreaItem.findUnique({ where: { id } });
  if (!cur) return NextResponse.json({ error: "없음" }, { status: 404 });

  const num = (k: keyof typeof cur, v: unknown) => {
    if (v === undefined || v === null || v === "") return cur[k] as number;
    const x = typeof v === "string" ? parseFloat(v) : Number(v);
    return isFinite(x) ? x : (cur[k] as number);
  };
  const v = {
    width: num("width", b.width),
    widthFlange: num("widthFlange", b.widthFlange),
    widthWing: num("widthWing", b.widthWing),
    height: num("height", b.height),
    heightFlange: num("heightFlange", b.heightFlange),
    heightWing: num("heightWing", b.heightWing),
    qty: num("qty", b.qty),
  };

  const item = await prisma.sheetAreaItem.update({
    where: { id },
    data: {
      location: typeof b.location === "string" && b.location.trim() ? b.location.trim() : cur.location,
      itemName: "itemName" in b ? b.itemName?.trim() || null : cur.itemName,
      ...v,
      area: sheetArea(v),
    },
  });
  return NextResponse.json(item);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  await prisma.sheetAreaItem.delete({ where: { id: Number(params.id) } });
  return NextResponse.json({ ok: true });
}
