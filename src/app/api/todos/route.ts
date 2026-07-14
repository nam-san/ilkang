import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// 전사 TO-DO 목록
export async function GET() {
  const todos = await prisma.todo.findMany({
    orderBy: [{ done: "asc" }, { createdAt: "desc" }],
  });
  return NextResponse.json(todos);
}

// 새 업무 등록
export async function POST(req: NextRequest) {
  const body = await req.json();
  const content = (body.content ?? "").trim();
  if (!content) {
    return NextResponse.json({ error: "업무 내용을 입력하세요." }, { status: 400 });
  }
  const todo = await prisma.todo.create({
    data: {
      content,
      assignee: body.assignee?.trim() || null,
      // 캘린더에서 등록 시 지정일 저장 (YYYY-MM-DD)
      dueDate: body.dueDate ? new Date(`${body.dueDate}T00:00:00`) : null,
    },
  });
  return NextResponse.json(todo, { status: 201 });
}
