import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { dayStart, ymd } from "@/lib/format";

export const dynamic = "force-dynamic";

/**
 * 공용 메모장 = 전사 공유 단일 보드.
 * (Memo.date 컬럼은 과거 날짜별 메모 구조의 잔재로 남아 있으나 사용하지 않는다.
 *  배포 시 predeploy 단계에서 여러 행을 1건으로 통합하므로 항상 단일 행을 사용.)
 */
async function getBoard() {
  const memo = await prisma.memo.findFirst({ orderBy: { id: "asc" } });
  if (memo) return memo;
  return prisma.memo.create({
    data: { date: dayStart(ymd(new Date()))!, content: "" },
  });
}

export async function GET() {
  return NextResponse.json(await getBoard());
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  const board = await getBoard();
  const memo = await prisma.memo.update({
    where: { id: board.id },
    data: {
      content: typeof body.content === "string" ? body.content : "",
      updatedBy: body.updatedBy?.trim() || null,
    },
  });
  return NextResponse.json(memo);
}
