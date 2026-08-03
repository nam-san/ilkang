"use client";

import { useEffect, useState, useCallback } from "react";
import { CheckCircle2, Circle, CalendarDays } from "lucide-react";
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

/** 전사 TO-DO LIST — 조회 + 완료 처리 전용 (등록은 캘린더 날짜 클릭으로) */
export default function TodoList() {
  const [todos, setTodos] = useState<Todo[]>([]);

  const load = useCallback(async () => {
    const res = await fetch("/api/todos", { cache: "no-store" });
    if (res.ok) setTodos(await res.json());
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 5000); // 실시간성 확보용 폴링
    return () => clearInterval(t);
  }, [load]);

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

  // 노출 규칙: ①날짜 없는 업무는 항상 ②오늘이 기간에 포함된 업무 ③기간 지난 미완료 업무
  //           (미래 업무·기간 지난 완료 업무는 캘린더에서 확인)
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

      <ul className="flex-1 overflow-y-auto divide-y divide-slate-100">
        {visibleTodos.length === 0 && (
          <li className="p-4 text-sm text-slate-400 text-center">
            당일 또는 지연된 업무가 없습니다.
            <br />
            <span className="text-xs">캘린더에서 날짜를 클릭해 업무를 등록하세요.</span>
          </li>
        )}
        {visibleTodos.map((t) => {
          const { s, e } = rangeOf(t);
          const overdue = !!s && !t.done && (e ?? s) < todayStr;
          const label = s ? (e && e !== s ? `${s} ~ ${e}` : s) : null;
          return (
            <li key={t.id} className="flex items-start gap-2 px-3 py-2.5">
              <button onClick={() => toggle(t)} className="mt-0.5 shrink-0" title={t.done ? "완료 취소" : "완료 체크"}>
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
            </li>
          );
        })}
      </ul>

      <p className="px-3 py-2 border-t border-slate-100 text-[11px] text-slate-400">
        업무 등록·삭제는 좌측 <b>캘린더에서 날짜를 클릭</b>해 진행하세요.
      </p>
    </div>
  );
}
