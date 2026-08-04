import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calcPlateCut, type PlateDemand } from "@/lib/plateCut";

export const dynamic = "force-dynamic";

function safeParse<T>(s: string, fallback: T): T {
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
}

// 히스토리 목록
export async function GET() {
  const rows = await prisma.plateCutHistory.findMany({ orderBy: { createdAt: "desc" }, take: 100 });
  return NextResponse.json(
    rows.map((r) => ({
      ...r,
      demands: safeParse(r.demands, [] as unknown[]),
      // 구버전(규격별 배열) 스냅샷은 표시 대상이 아니므로 null 처리
      results: (() => {
        const v = safeParse<unknown>(r.results, null);
        return v && !Array.isArray(v) ? v : null;
      })(),
    }))
  );
}

// 히스토리 저장 (서버에서 동일 모듈로 재계산 후 스냅샷 저장)
export async function POST(req: NextRequest) {
  const b = await req.json();
  const demands: PlateDemand[] = Array.isArray(b.demands) ? b.demands : [];
  if (demands.length === 0) {
    return NextResponse.json({ error: "컷팅 규격을 입력하세요." }, { status: 400 });
  }
  const plates = await prisma.plateSpec.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } });
  const r = calcPlateCut(plates, demands);
  if (r.bins.length === 0) {
    return NextResponse.json({ error: "계산 결과가 없습니다." }, { status: 400 });
  }

  const saved = await prisma.plateCutHistory.create({
    data: {
      title: b.title?.trim() || null,
      totalPlates: r.totalPlates,
      totalPieces: r.totalPieces,
      lossRate: r.lossRate,
      demands: JSON.stringify(demands.filter((d) => Number(d.width) > 0 && Number(d.height) > 0 && Number(d.qty) > 0)),
      // 판별 배치 스냅샷 (원판 기준값이 바뀌어도 당시 결과를 그대로 보관)
      results: JSON.stringify({
        plateUsage: r.plateUsage,
        specs: r.specs,
        totalUsedArea: r.totalUsedArea,
        totalPlateArea: r.totalPlateArea,
        bins: r.bins.map((bin) => ({
          index: bin.index,
          plate: { name: bin.plate.name, width: bin.plate.width, height: bin.plate.height },
          counts: bin.counts,
          placements: bin.placements,
          usedArea: bin.usedArea,
          plateArea: bin.plateArea,
          lossRate: bin.lossRate,
        })),
      }),
    },
  });
  return NextResponse.json(saved, { status: 201 });
}

// 전체 삭제
export async function DELETE() {
  const r = await prisma.plateCutHistory.deleteMany();
  return NextResponse.json({ ok: true, removed: r.count });
}
