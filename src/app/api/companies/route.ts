import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

// 하도급 업체 목록 / 검색 (q: 업체명·전문분야·대표자)
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim();
  const where: Prisma.SubcontractorCompanyWhereInput = q
    ? {
        OR: [
          { name: { contains: q } },
          { category: { contains: q } },
          { ceo: { contains: q } },
        ],
      }
    : {};
  const rows = await prisma.subcontractorCompany.findMany({
    where,
    orderBy: { name: "asc" },
  });
  return NextResponse.json(rows);
}

// 업체 등록
export async function POST(req: NextRequest) {
  const b = await req.json();
  if (!b.name?.trim()) {
    return NextResponse.json({ error: "업체명은 필수입니다." }, { status: 400 });
  }
  const row = await prisma.subcontractorCompany.create({
    data: {
      name: b.name.trim(),
      bizNumber: b.bizNumber?.trim() || null,
      ceo: b.ceo?.trim() || null,
      phone: b.phone?.trim() || null,
      email: b.email?.trim() || null,
      category: b.category?.trim() || null,
      address: b.address?.trim() || null,
      note: b.note?.trim() || null,
    },
  });
  return NextResponse.json(row, { status: 201 });
}
