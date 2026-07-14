import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  await prisma.subcontractorEstimate.delete({ where: { id: Number(params.id) } });
  return NextResponse.json({ ok: true });
}
