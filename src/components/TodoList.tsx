"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, Trash2, CheckCircle2, Circle, CalendarDays } from "lucide-react";
import { ymd, ymdhm } from "@/lib/format";

type Todo = {
  id: number;
  content: string;
  assignee: string | null;
  dueDate: string | null;
  done: boolean;
  completedBy: string | null;
  completedAt: string | null;
};

export default function TodoList() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [content, setContent] = useState("");
  const [assignee, setAssignee] = useState("");
  const [dueDate, setDueDate] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/todos", { cache: "no-store" });
    if (res.ok) setTodos(await res.json());
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 5000); // 실시간성 확보용 폴링
    return () => clearInterval(t);
  }, [load]);

  const add = async () => {
    if (!content.trim()) return;
    await fetch("/api/todos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content, assignee, dueDate: dueDate || null }),
    });
    setContent("");
    setAssignee("");
    setDueDate("");
    load();
  };

  const toggle = async (t: Todo) => {
    let by: string | null = t.completedBy;
    if (!t.done) {
      const input = window.prompt("조치 완료자 이름을 입력하세요.", "");
      if (input === null) return; // 취소 → 완료 처리하지 않음 (미완료 유지)
      by = input.trim() || "미기록";
    }
    await fetch(`/api/todos/${t.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ done: !t.done, completedBy: by }),
    });
    load();
  };

  const remove = async (id: number) => {
    await fetch(`/api/todos/${id}`, { method: "DELETE" });
    load();
  };

  // 노출 규칙: ①날짜 없는 일반 업무는 항상 ②당일 업무 ③기한 지난 미완료 업무
  //           (미래 업무·기한 지난 완료 업무는 캘린더에서만 확인)
  const todayStr = ymd(new Date());
  const visibleTodos = todos.filter((t) => {
    if (!t.dueDate) return true;
    const d = ymd(t.dueDate);
    if (d === todayStr) return true;
    return d < todayStr && !t.done;
  });
  const activeCount = visibleTodos.filter((t) => !t.done).length;

  return (
    <div className="card flex flex-col h-full overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 rounded-t-xl">
        <h2 className="font-bold text-sm text-slate-700 flex items-center gap-2">
          📋 전사 TO-DO LIST
          <span className="text-xs font-normal text-slate-400">
            ({activeCount}건 진행중 · 당일/지연)
          </span>
        </h2>
      </div>

      <div className="p-3 border-b border-slate-100 space-y-2">
        <input
          className="input"
          placeholder="업무 내용 입력"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
        />
        <div className="flex gap-2">
          <input
            className="input flex-1"
            placeholder="담당자(옵션)"
            value={assignee}
            onChange={(e) => setAssignee(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
          />
          <input
            type="date"
            className="input w-36 shrink-0"
            title="캘린더 지정일(옵션)"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
          <button className="btn-primary shrink-0" onClick={add}>
            <Plus className="w-4 h-4" /> 등록
          </button>
        </div>
      </div>

      <ul className="flex-1 overflow-y-auto divide-y divide-slate-100">
        {visibleTodos.length === 0 && (
          <li className="p-4 text-sm text-slate-400 text-center">
            당일 또는 지연된 업무가 없습니다.
          </li>
        )}
        {visibleTodos.map((t) => {
          const overdue = !!t.dueDate && !t.done && ymd(t.dueDate) < todayStr;
          return (
          <li key={t.id} className="flex items-start gap-2 px-3 py-2.5 group">
            <button onClick={() => toggle(t)} className="mt-0.5 shrink-0">
              {t.done ? (
                <CheckCircle2 className="w-5 h-5 text-green-600" />
              ) : (
                <Circle className="w-5 h-5 text-slate-300 hover:text-blue-500" />
              )}
            </button>
            <div className="flex-1 min-w-0">
              <p
                className={`text-sm break-words ${
                  t.done ? "line-through text-slate-400" : "text-slate-800"
                }`}
              >
                {t.content}
              </p>
              <div className="text-[11px] text-slate-400 mt-0.5 flex flex-wrap items-center gap-x-2">
                {t.dueDate && (
                  <span
                    className={`inline-flex items-center gap-0.5 font-semibold ${
                      overdue ? "text-red-600" : "text-amber-600"
                    }`}
                  >
                    <CalendarDays className="w-3 h-3" />
                    {ymd(t.dueDate)}
                    {overdue && " (지연)"}
                  </span>
                )}
                {t.assignee && <span>담당: {t.assignee}</span>}
                {t.done && t.completedAt && (
                  <span className="text-green-600">
                    ✓ {t.completedBy} · {ymdhm(t.completedAt)}
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={() => remove(t.id)}
              className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500 shrink-0"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </li>
          );
        })}
      </ul>
    </div>
  );
}
