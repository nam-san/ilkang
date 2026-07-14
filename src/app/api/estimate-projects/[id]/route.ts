import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// 공사 상세 (창호유형+부재, 비용파라미터 포함)
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const project = await prisma.estimateProject.findUnique({
    where: { id: Number(params.id) },
    include: {
      costParam: true,
      windowTypes: {
        orderBy: { sortOrder: "asc" },
        include: { components: { orderBy: { sortOrder: "asc" } } },
      },
      _count: { select: { lines: true } },
    },
  });
  if (!project) {
    return NextResponse.json({ error: "존재하지 않는 공사입니다." }, { status: 404 });
  }
  return NextResponse.json(project);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const b = await req.json();
  const project = await prisma.estimateProject.update({
    where: { id: Number(params.id) },
    data: { siteName: b.siteName?.trim(), workType: b.workType?.trim() || null },
  });
  return NextResponse.json(project);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  await prisma.estimateProject.delete({ where: { id: Number(params.id) } });
  return NextResponse.json({ ok: true });
}
