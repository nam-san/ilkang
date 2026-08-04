import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calcPipeCut, type Demand } from "@/lib/pipeCut";

export const dynamic = "force-dynamic";

// 계산 히스토리 목록
export async function GET() {
  const rows = await prisma.pipeCutHistory.findMany({ orderBy: { createdAt: "desc" }, take: 100 });
  return NextResponse.json(
    rows.map((r) => ({
      ...r,
      demands: safeParse(r.demands),
      patterns: safeParse(r.patterns),
    }))
  );
}

function safeParse(s: string) {
  try {
    return JSON.parse(s);
  } catch {
    return [];
  }
}

// 히스토리 저장 (서버에서 동일 모듈로 재계산 후 스냅샷 저장)
export async function POST(req: NextRequest) {
  const b = await req.json();
  const stockLength = Number(b.stockLength) || 0;
  const kerf = Number(b.kerf) || 0;
  const demands: Demand[] = Array.isArray(b.demands) ? b.demands : [];
  if (stockLength <= 0 || demands.length === 0) {
    return NextResponse.json({ error: "원자재 길이와 절단 목록이 필요합니다." }, { status: 400 });
  }

  const r = calcPipeCut(stockLength, kerf, demands);
  if (r.totalBars === 0) {
    return NextResponse.json({ error: "계산 결과가 없습니다." }, { status: 400 });
  }

  const saved = await prisma.pipeCutHistory.create({
    data: {
      title: b.title?.trim() || null,
      stockLength,
      kerf,
      totalBars: r.totalBars,
      totalCuts: r.totalCuts,
      lossRate: r.lossRate,
      demands: JSON.stringify(demands.filter((d) => Number(d.length) > 0 && Number(d.qty) > 0)),
      patterns: JSON.stringify(
        r.bars.map((x) => ({
          index: x.index,
          groups: x.groups,
          usedLength: x.usedLength,
          kerfLoss: x.kerfLoss,
          remainder: x.remainder,
        }))
      ),
    },
  });
  return NextResponse.json(saved, { status: 201 });
}

// 전체 삭제
export async function DELETE() {
  const r = await prisma.pipeCutHistory.deleteMany();
  return NextResponse.json({ ok: true, removed: r.count });
}
