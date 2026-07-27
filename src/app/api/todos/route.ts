import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { dayStart } from "@/lib/format";

export const dynamic = "force-dynamic";

// 전사 TO-DO 목록
export async function GET() {
  const todos = await prisma.todo.findMany({
    orderBy: [{ done: "asc" }, { createdAt: "desc" }],
  });
  return NextResponse.json(todos);
}

// 새 업무 등록 (시작일/종료일 지정 시 캘린더 연동)
export async function POST(req: NextRequest) {
  const body = await req.json();
  const content = (body.content ?? "").trim();
  if (!content) {
    return NextResponse.json({ error: "업무 내용을 입력하세요." }, { status: 400 });
  }

  // 구버전 호환: dueDate 로 들어오면 시작일로 취급
  let start = dayStart(body.startDate ?? body.dueDate);
  let end = dayStart(body.endDate);
  // 종료일만 있으면 시작일로 간주
  if (!start && end) {
    start = end;
    end = null;
  }
  // 기간 역전 시 교환
  if (start && end && end < start) [start, end] = [end, start];

  const todo = await prisma.todo.create({
    data: {
      content,
      assignee: body.assignee?.trim() || null,
      startDate: start,
      endDate: end,
    },
  });
  return NextResponse.json(todo, { status: 201 });
}
