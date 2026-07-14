import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// 완료 토글 / 담당자·내용 수정
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = Number(params.id);
  const body = await req.json();
  const data: Record<string, unknown> = {};

  if (typeof body.done === "boolean") {
    data.done = body.done;
    data.completedAt = body.done ? new Date() : null;
    data.completedBy = body.done ? body.completedBy?.trim() || "미기록" : null;
  }
  if (typeof body.content === "string") data.content = body.content.trim();
  if (typeof body.assignee === "string") data.assignee = body.assignee.trim() || null;
  if ("dueDate" in body)
    data.dueDate = body.dueDate ? new Date(`${body.dueDate}T00:00:00`) : null;

  const todo = await prisma.todo.update({ where: { id }, data });
  return NextResponse.json(todo);
}

// 삭제
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  await prisma.todo.delete({ where: { id: Number(params.id) } });
  return NextResponse.json({ ok: true });
}
