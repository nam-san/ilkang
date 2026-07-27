"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, Trash2, CheckCircle2, Circle, CalendarDays } from "lucide-react";
import { ymd, ymdhm, todayYmd } from "@/lib/format";

type Todo = {
  id: number;
  content: string;
  assignee: string | null;
  startDate: string | null;
  endDate: string | null;
  done: boolean;
  completedBy: string | null;
  completedAt: string | null;
};

export default function TodoList() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [content, setContent] = useState("");
  const [assignee, setAssignee] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

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
      body: JSON.stringify({
        content,
        assignee,
        startDate: startDate || null,
        endDate: endDate || null,
      }),
    });
    setContent("");
    setAssignee("");
    setStartDate("");
    setEndDate("");
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

  // 노출 규칙: ①날짜 없는 업무는 항상 ②오늘이 기간에 포함된 업무 ③기간 지난 미완료 업무
  //           (미래 업무·기간 지난 완료 업무는 캘린더에서만 확인)
  const todayStr = todayYmd();
  const rangeOf = (t: Todo) => {
    const s = t.startDate ? ymd(t.startDate) : null;
    const e = t.endDate ? ymd(t.endDate) : s;
    return { s, e };
  };
  const visibleTodos = todos.filter((t) => {
    const { s, e } = rangeOf(t);
    if (!s) return true;
    if (s <= todayStr && todayStr <= (e ?? s)) return true; // 진행 기간 중
    return (e ?? s) < todayStr && !t.done; // 기한 지난 미완료
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
        {/* 기간 지정 (캘린더 자동 연동) */}
        <div className="flex items-center gap-1">
          <input
            type="date"
            className="input flex-1 text-xs"
            title="시작일"
            value={startDate}
            onChange={(e) => {
              setStartDate(e.target.value);
              if (endDate && e.target.value && endDate < e.target.value) setEndDate(e.target.value);
            }}
          />
          <span className="text-slate-400 text-xs shrink-0">~</span>
          <input
            type="date"
            className="input flex-1 text-xs"
            title="종료일(미지정 시 당일)"
            min={startDate || undefined}
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <input
            className="input flex-1"
            placeholder="담당자(옵션)"
            value={assignee}
            onChange={(e) => setAssignee(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
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
          const { s, e } = rangeOf(t);
          const overdue = !!s && !t.done && (e ?? s) < todayStr;
          const label = s ? (e && e !== s ? `${s} ~ ${e}` : s) : null;
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
                  {label && (
                    <span
                      className={`inline-flex items-center gap-0.5 font-semibold ${
                        overdue ? "text-red-600" : "text-amber-600"
                      }`}
                    >
                      <CalendarDays className="w-3 h-3" />
                      {label}
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
