"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import type { EventClickArg, EventContentArg } from "@fullcalendar/core";
import { X, CheckCircle2, Circle, NotebookPen } from "lucide-react";
import { ymd, addDays, todayYmd } from "@/lib/format";

type Contract = {
  id: number;
  siteName: string;
  startDate: string | null;
  endDate: string | null;
};
type Todo = {
  id: number;
  content: string;
  assignee: string | null;
  startDate: string | null;
  endDate: string | null;
  done: boolean;
};
type MemoDate = { date: string; preview: string };

type EvProps = { kind: "contract" | "todo" | "memo"; refId: number; date?: string; done?: boolean };
type Ev = {
  id: string;
  title: string;
  start: string;
  end?: string;
  allDay: true;
  color: string;
  textColor?: string;
  extendedProps: EvProps;
};

export default function DashboardCalendar({
  onOpenMemo,
}: {
  onOpenMemo?: (date: string) => void;
}) {
  const router = useRouter();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [memoDates, setMemoDates] = useState<MemoDate[]>([]);
  const [modalDate, setModalDate] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [cRes, tRes, mRes] = await Promise.all([
      fetch("/api/contracts", { cache: "no-store" }),
      fetch("/api/todos", { cache: "no-store" }),
      fetch("/api/memo/dates", { cache: "no-store" }),
    ]);
    if (cRes.ok) setContracts(await cRes.json());
    if (tRes.ok) setTodos(await tRes.json());
    if (mRes.ok) setMemoDates(await mRes.json());
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 5000); // TO-DO·메모와 실시간 동기화
    return () => clearInterval(t);
  }, [load]);

  /** 업무의 기간 (시작~종료, 종료 없으면 당일) */
  const rangeOf = (t: Todo) => {
    const s = t.startDate ? ymd(t.startDate) : null;
    const e = t.endDate ? ymd(t.endDate) : s;
    return { s, e };
  };

  const events = useMemo<Ev[]>(() => {
    const evs: Ev[] = [];
    for (const c of contracts) {
      if (c.startDate)
        evs.push({
          id: `c-s-${c.id}`,
          title: `🚧 착공 · ${c.siteName}`,
          start: ymd(c.startDate),
          allDay: true,
          color: "#2563eb",
          extendedProps: { kind: "contract", refId: c.id },
        });
      if (c.endDate)
        evs.push({
          id: `c-e-${c.id}`,
          title: `✅ 준공 · ${c.siteName}`,
          start: ymd(c.endDate),
          allDay: true,
          color: "#16a34a",
          extendedProps: { kind: "contract", refId: c.id },
        });
    }
    for (const t of todos) {
      const { s, e } = rangeOf(t);
      if (!s) continue; // 날짜 없는 업무는 캘린더 미표시
      evs.push({
        id: `t-${t.id}`,
        title: t.content,
        start: s,
        // FullCalendar 종료일은 배타적 → +1일
        end: e && e !== s ? addDays(e, 1) : undefined,
        allDay: true,
        color: t.done ? "#cbd5e1" : "#f59e0b",
        textColor: t.done ? "#64748b" : "#7c2d12",
        extendedProps: { kind: "todo", refId: t.id, done: t.done },
      });
    }
    for (const m of memoDates) {
      evs.push({
        id: `m-${m.date}`,
        title: `📝 ${m.preview}`,
        start: m.date,
        allDay: true,
        color: "#e2e8f0",
        textColor: "#475569",
        extendedProps: { kind: "memo", refId: 0, date: m.date },
      });
    }
    return evs;
  }, [contracts, todos, memoDates]);

  // 선택한 날짜에 걸쳐 있는 업무/일정
  const dayTodos = modalDate
    ? todos.filter((t) => {
        const { s, e } = rangeOf(t);
        return !!s && s <= modalDate && modalDate <= (e ?? s);
      })
    : [];
  const dayContracts = modalDate
    ? contracts.filter(
        (c) =>
          (c.startDate && ymd(c.startDate) === modalDate) ||
          (c.endDate && ymd(c.endDate) === modalDate)
      )
    : [];
  const dayMemo = modalDate ? memoDates.find((m) => m.date === modalDate) : undefined;

  /** 캘린더에서 업무 완료 체크 (TO-DO LIST와 동기화) */
  const toggleTodo = async (t: Todo) => {
    let by: string | null = null;
    if (!t.done) {
      const input = window.prompt("조치 완료자 이름을 입력하세요.", "");
      if (input === null) return; // 취소 → 완료 처리하지 않음
      by = input.trim() || "미기록";
    }
    await fetch(`/api/todos/${t.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ done: !t.done, completedBy: by }),
    });
    load();
  };

  const onEventClick = (arg: EventClickArg) => {
    const ep = arg.event.extendedProps as EvProps;
    if (ep.kind === "contract") {
      router.push(`/contracts/${ep.refId}`);
      return;
    }
    if (ep.kind === "memo") {
      // 메모 마커 클릭 → 그날 메모를 공용 메모장에 복귀
      onOpenMemo?.(ep.date!);
      return;
    }
    setModalDate(arg.event.startStr);
  };

  const renderEvent = (arg: EventContentArg) => {
    const ep = arg.event.extendedProps as EvProps;
    if (ep.kind === "todo") {
      return (
        <div className="flex items-center gap-1 px-1 truncate">
          <span>{ep.done ? "☑" : "☐"}</span>
          <span className={ep.done ? "line-through" : ""}>{arg.event.title}</span>
        </div>
      );
    }
    return <div className="px-1 truncate">{arg.event.title}</div>;
  };

  return (
    <div className="card p-4 h-full">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs text-slate-400">
          날짜를 클릭하면 그날의 일정·업무·메모를 확인할 수 있습니다. 업무 등록은 우측 TO-DO LIST에서 하세요.
        </p>
      </div>
      <FullCalendar
        plugins={[dayGridPlugin, interactionPlugin]}
        initialView="dayGridMonth"
        locale="ko"
        height="calc(100% - 28px)"
        headerToolbar={{
          left: "prev,next today",
          center: "title",
          right: "dayGridMonth,dayGridWeek",
        }}
        buttonText={{ today: "오늘", month: "월", week: "주" }}
        events={events}
        dateClick={(arg) => setModalDate(arg.dateStr)}
        eventClick={onEventClick}
        eventContent={renderEvent}
        dayMaxEvents={3}
      />

      {/* 날짜 상세 모달: 그날 등록된 일정·업무·메모 조회 */}
      {modalDate && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="card w-full max-w-md p-5 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-base">
                <span className="text-blue-700">{modalDate}</span> 일정
                {modalDate === todayYmd() && (
                  <span className="ml-1.5 text-[11px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
                    오늘
                  </span>
                )}
              </h2>
              <button onClick={() => setModalDate(null)}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            {/* 현장 일정(착공/준공) */}
            {dayContracts.length > 0 && (
              <div className="mb-3 space-y-1">
                {dayContracts.map((c) => (
                  <div key={c.id} className="text-xs text-slate-500">
                    {c.startDate && ymd(c.startDate) === modalDate && "🚧 착공 · "}
                    {c.endDate && ymd(c.endDate) === modalDate && "✅ 준공 · "}
                    {c.siteName}
                  </div>
                ))}
              </div>
            )}

            {/* 그날의 공용 메모 (복귀) */}
            <button
              onClick={() => {
                onOpenMemo?.(modalDate);
                setModalDate(null);
              }}
              className="mb-3 w-full text-left border border-slate-200 rounded-lg px-3 py-2 hover:border-blue-400 hover:bg-blue-50/40 transition-colors"
            >
              <span className="text-xs font-semibold text-slate-600 flex items-center gap-1">
                <NotebookPen className="w-3.5 h-3.5 text-blue-600" /> 이 날짜의 공용 메모
              </span>
              <span className="block text-xs text-slate-500 mt-0.5 truncate">
                {dayMemo ? dayMemo.preview : "기록 없음 — 클릭하면 메모장이 이 날짜로 열립니다."}
              </span>
            </button>

            {/* 그날 등록된 업무 (조회 + 완료 체크) */}
            <label className="label">등록된 업무</label>
            <div className="flex-1 overflow-y-auto -mx-1 px-1">
              {dayTodos.length === 0 ? (
                <p className="text-sm text-slate-400 py-4 text-center border border-dashed border-slate-200 rounded-lg">
                  이 날짜에 등록된 업무가 없습니다.
                </p>
              ) : (
                <ul className="divide-y divide-slate-100 border border-slate-200 rounded-lg">
                  {dayTodos.map((t) => {
                    const { s, e } = rangeOf(t);
                    const label = s && e && e !== s ? `${s} ~ ${e}` : null;
                    return (
                      <li key={t.id} className="flex items-start gap-2 px-2.5 py-2">
                        <button
                          onClick={() => toggleTodo(t)}
                          className="mt-0.5 shrink-0"
                          title={t.done ? "완료 취소" : "완료 체크"}
                        >
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
                          <div className="text-[11px] text-slate-400 flex flex-wrap gap-x-2">
                            {label && <span className="text-amber-600 font-semibold">{label}</span>}
                            {t.assignee && <span>담당: {t.assignee}</span>}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <p className="text-[11px] text-slate-400 mt-3 pt-3 border-t border-slate-100">
              새 업무 등록·삭제는 우측 <b>TO-DO LIST</b>에서, 그날의 기록은 <b>공용 메모장</b>에 작성하세요.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
