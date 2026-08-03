"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import type { EventClickArg, EventContentArg } from "@fullcalendar/core";
import { X, Plus, Trash2, CheckCircle2, Circle } from "lucide-react";
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

type EvProps = { kind: "contract" | "todo"; refId: number; done?: boolean };
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

export default function DashboardCalendar() {
  const router = useRouter();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [modalDate, setModalDate] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [assignee, setAssignee] = useState("");
  const [endDate, setEndDate] = useState("");

  const load = useCallback(async () => {
    const [cRes, tRes] = await Promise.all([
      fetch("/api/contracts", { cache: "no-store" }),
      fetch("/api/todos", { cache: "no-store" }),
    ]);
    if (cRes.ok) setContracts(await cRes.json());
    if (tRes.ok) setTodos(await tRes.json());
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 5000); // TO-DO LIST와 실시간 동기화
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
    return evs;
  }, [contracts, todos]);

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

  /** 날짜 클릭 → 시작일=클릭일, 종료일 기본값=클릭일 */
  const openModal = (dateStr: string) => {
    setModalDate(dateStr);
    setContent("");
    setAssignee("");
    setEndDate(dateStr);
  };

  const saveTask = async () => {
    if (!content.trim() || !modalDate) return;
    await fetch("/api/todos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content,
        assignee,
        startDate: modalDate,
        endDate: endDate || modalDate,
      }),
    });
    setContent("");
    setAssignee("");
    setEndDate(modalDate);
    load(); // 모달 유지 → 방금 추가된 업무가 목록에 나타남
  };

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

  const removeTodo = async (id: number) => {
    if (!confirm("이 업무를 삭제하시겠습니까?")) return;
    await fetch(`/api/todos/${id}`, { method: "DELETE" });
    load();
  };

  const onEventClick = (arg: EventClickArg) => {
    const ep = arg.event.extendedProps as EvProps;
    if (ep.kind === "contract") {
      router.push(`/contracts/${ep.refId}`);
      return;
    }
    openModal(arg.event.startStr);
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
          날짜를 클릭하면 그날의 일정을 확인하고 업무를 등록할 수 있습니다. (종료일 지정 시 기간 업무)
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
        dateClick={(arg) => openModal(arg.dateStr)}
        eventClick={onEventClick}
        eventContent={renderEvent}
        dayMaxEvents={3}
      />

      {/* 날짜 상세 모달: 그날 업무 조회 + 새 업무 등록 */}
      {modalDate && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="card w-full max-w-md p-5 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-base">
                <span className="text-blue-700">{modalDate}</span> 업무
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
              <div className="mb-2 space-y-1">
                {dayContracts.map((c) => (
                  <div key={c.id} className="text-xs text-slate-500">
                    {c.startDate && ymd(c.startDate) === modalDate && "🚧 착공 · "}
                    {c.endDate && ymd(c.endDate) === modalDate && "✅ 준공 · "}
                    {c.siteName}
                  </div>
                ))}
              </div>
            )}

            {/* 등록된 업무 목록 */}
            <div className="flex-1 overflow-y-auto -mx-1 px-1 mb-3">
              {dayTodos.length === 0 ? (
                <p className="text-sm text-slate-400 py-4 text-center border border-dashed border-slate-200 rounded-lg">
                  등록된 업무가 없습니다. 아래에서 추가하세요.
                </p>
              ) : (
                <ul className="divide-y divide-slate-100 border border-slate-200 rounded-lg">
                  {dayTodos.map((t) => {
                    const { s, e } = rangeOf(t);
                    const label = s && e && e !== s ? `${s} ~ ${e}` : null;
                    return (
                      <li key={t.id} className="flex items-start gap-2 px-2.5 py-2 group">
                        <button onClick={() => toggleTodo(t)} className="mt-0.5 shrink-0">
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
                        <button
                          onClick={() => removeTodo(t.id)}
                          className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500 shrink-0"
                          title="삭제"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {/* 새 업무 등록 */}
            <div className="border-t border-slate-100 pt-3 space-y-2">
              <label className="label">새 업무 등록</label>
              <input
                autoFocus
                className="input"
                placeholder="업무 내용"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && saveTask()}
              />
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <span className="block text-[11px] text-slate-400 mb-0.5">시작일</span>
                  <div className="input py-1.5 bg-slate-50 text-slate-600 text-sm">{modalDate}</div>
                </div>
                <span className="text-slate-400 text-xs mt-4">~</span>
                <div className="flex-1">
                  <span className="block text-[11px] text-slate-400 mb-0.5">종료일</span>
                  <input
                    type="date"
                    className="input py-1.5 text-sm"
                    min={modalDate}
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <input
                  className="input flex-1"
                  placeholder="담당자(옵션)"
                  value={assignee}
                  onChange={(e) => setAssignee(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && saveTask()}
                />
                <button className="btn-primary shrink-0" onClick={saveTask}>
                  <Plus className="w-4 h-4" /> 등록
                </button>
              </div>
              <p className="text-[11px] text-slate-400">
                등록한 업무는 우측 TO-DO LIST에도 표시되며, 완료 체크가 동기화됩니다.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
