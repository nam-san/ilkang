import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { dayStart, ymd } from "@/lib/format";

export const dynamic = "force-dynamic";

/**
 * 공용 메모장 = 전사 공유 단일 보드.
 * (Memo.date 컬럼은 과거 날짜별 메모 구조의 잔재로 남아 있으나 사용하지 않는다.
 *  가장 최근에 수정된 메모 1건을 공용 보드로 사용해 기존 내용을 그대로 승계.)
 */
async function getBoard() {
  const memo = await prisma.memo.findFirst({ orderBy: { updatedAt: "desc" } });
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
