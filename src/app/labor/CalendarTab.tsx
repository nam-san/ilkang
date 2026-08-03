"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import type { EventContentArg, EventClickArg, DatesSetArg } from "@fullcalendar/core";
import { X, Users2, UserPlus, Trash2, Save } from "lucide-react";
import { won, todayYmd } from "@/lib/format";
import type { Contract, Worker } from "./LaborClient";

type Item = {
  date: string;
  contractId: number;
  siteName: string;
  teamName: string;
  count: number;
  manDays: number;
  totalWage: number;
  workers: string[];
};
type Assignment = {
  id: number;
  workerId: number;
  actualWage: number;
  halfDay: boolean;
  teamName: string | null;
  worker: Worker;
};

// 파스텔 팔레트 (눈이 편한 연한 배경 + 진한 글자)
const PASTEL = [
  { bg: "#DBEAFE", fg: "#1E40AF" },
  { bg: "#DCFCE7", fg: "#166534" },
  { bg: "#FEF3C7", fg: "#92400E" },
  { bg: "#EDE9FE", fg: "#5B21B6" },
  { bg: "#FCE7F3", fg: "#9D174D" },
  { bg: "#CFFAFE", fg: "#155E75" },
  { bg: "#FFE4E6", fg: "#9F1239" },
  { bg: "#ECFCCB", fg: "#3F6212" },
];

export default function CalendarTab({
  contracts,
  workers,
  teams,
  preSite,
}: {
  contracts: Contract[];
  workers: Worker[];
  teams: string[];
  preSite?: string | null;
}) {
  const [items, setItems] = useState<Item[]>([]);
  const [siteFilter, setSiteFilter] = useState<string>(preSite || "");
  const [month, setMonth] = useState<string>(() => todayYmd().slice(0, 7));
  const monthRef = useRef(month);
  monthRef.current = month;

  // 투입 등록 모달
  const [modalDate, setModalDate] = useState<string | null>(null);
  const [modalSite, setModalSite] = useState<string>("");
  const [rows, setRows] = useState<Assignment[]>([]);
  const [team, setTeam] = useState("");
  const [workerId, setWorkerId] = useState("");
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    const p = new URLSearchParams({ month: monthRef.current });
    if (siteFilter) p.set("contractId", siteFilter);
    const r = await fetch(`/api/assignments/calendar?${p}`, { cache: "no-store" });
    if (r.ok) setItems(await r.json());
  }, [siteFilter]);

  useEffect(() => {
    load();
  }, [load, month]);

  const teamColor = useMemo(() => {
    const names = [...new Set(items.map((i) => i.teamName))].sort();
    const map = new Map<string, { bg: string; fg: string }>();
    names.forEach((n, i) => map.set(n, PASTEL[i % PASTEL.length]));
    return (t: string) => map.get(t) ?? { bg: "#E2E8F0", fg: "#334155" };
  }, [items]);

  const events = useMemo(
    () =>
      items.map((it) => {
        const c = teamColor(it.teamName);
        return {
          id: `${it.date}-${it.contractId}-${it.teamName}`,
          title: `${it.teamName}/${it.count}명`,
          start: it.date,
          allDay: true,
          backgroundColor: c.bg,
          borderColor: c.bg,
          textColor: c.fg,
          extendedProps: it,
        };
      }),
    [items, teamColor]
  );

  const totals = useMemo(() => {
    const headcount = items.reduce((s, i) => s + i.count, 0);
    const manDays = items.reduce((s, i) => s + i.manDays, 0);
    const wage = items.reduce((s, i) => s + i.totalWage, 0);
    return { headcount, manDays, wage, teams: new Set(items.map((i) => i.teamName)).size };
  }, [items]);

  // 팀별 투입일 (해당 팀이 투입된 날짜 수)
  const legend = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const i of items) {
      if (!map.has(i.teamName)) map.set(i.teamName, new Set());
      map.get(i.teamName)!.add(i.date);
    }
    return Array.from(map.entries())
      .map(([team, days]) => ({ team, days: days.size }))
      .sort((a, b) => b.days - a.days);
  }, [items]);

  // ── 투입 등록 모달 ──
  const loadRows = useCallback(async (site: string, date: string) => {
    if (!site || !date) return setRows([]);
    const r = await fetch(`/api/assignments?contractId=${site}&date=${date}`, { cache: "no-store" });
    if (r.ok) setRows(await r.json());
  }, []);

  const openModal = (date: string, site?: string) => {
    const s = site ?? siteFilter ?? "";
    const chosen = s || (contracts[0] ? String(contracts[0].id) : "");
    setModalDate(date);
    setModalSite(chosen);
    setTeam("");
    setWorkerId("");
    setMsg("");
    loadRows(chosen, date);
  };

  useEffect(() => {
    if (modalDate && modalSite) loadRows(modalSite, modalDate);
  }, [modalDate, modalSite, loadRows]);

  const flash = (m: string) => {
    setMsg(m);
    setTimeout(() => setMsg(""), 2500);
  };

  const assignTeam = async () => {
    if (!team) return flash("투입할 팀을 선택하세요.");
    const res = await fetch("/api/assignments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contractId: Number(modalSite), date: modalDate, teamName: team }),
    });
    const d = await res.json();
    flash(res.ok ? `✅ ${team} ${d.added}명 투입` : d.error);
    loadRows(modalSite, modalDate!);
    load();
  };

  const addWorker = async () => {
    if (!workerId) return;
    const res = await fetch("/api/assignments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contractId: Number(modalSite), date: modalDate, workerId: Number(workerId) }),
    });
    if (!res.ok) flash((await res.json()).error);
    setWorkerId("");
    loadRows(modalSite, modalDate!);
    load();
  };

  const patchRow = async (id: number, body: Record<string, unknown>) => {
    await fetch(`/api/assignments/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    loadRows(modalSite, modalDate!);
    load();
  };

  const removeRow = async (id: number) => {
    await fetch(`/api/assignments/${id}`, { method: "DELETE" });
    loadRows(modalSite, modalDate!);
    load();
  };

  const dayTotal = rows.reduce((s, r) => s + r.actualWage * (r.halfDay ? 0.5 : 1), 0);
  const dayManDays = rows.reduce((s, r) => s + (r.halfDay ? 0.5 : 1), 0);

  return (
    <div className="space-y-3">
      {/* 필터 + 요약 */}
      <div className="card p-3 flex flex-wrap items-center gap-3">
        <select className="input w-56" value={siteFilter} onChange={(e) => setSiteFilter(e.target.value)}>
          <option value="">전체 현장</option>
          {contracts.map((c) => (
            <option key={c.id} value={c.id}>
              {c.siteName}
            </option>
          ))}
        </select>
        <p className="text-sm text-slate-500">
          날짜를 클릭하면 그날의 투입 인원을 등록·수정할 수 있습니다.
        </p>
        <div className="ml-auto flex gap-4 text-sm shrink-0">
          <span className="text-slate-500">
            투입 팀 <b className="text-slate-800">{totals.teams}</b>
          </span>
          <span className="text-slate-500">
            공수 <b className="text-slate-800">{totals.manDays}</b>
          </span>
          <span className="text-slate-500">
            인건비 <b className="text-blue-700">{won(totals.wage)}</b>원
          </span>
        </div>
      </div>

      {/* 팀별 투입일 */}
      {legend.length > 0 && (
        <div className="flex flex-wrap gap-2 px-1">
          <span className="text-xs text-slate-400 self-center">팀별 투입일:</span>
          {legend.map(({ team, days }) => (
            <span
              key={team}
              className="inline-flex items-center gap-1.5 text-xs rounded-full px-2.5 py-1 font-semibold"
              style={{ backgroundColor: teamColor(team).bg, color: teamColor(team).fg }}
            >
              {team} <span className="opacity-80">{days}일</span>
            </span>
          ))}
        </div>
      )}

      <div className="card p-4">
        <FullCalendar
          plugins={[dayGridPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          locale="ko"
          height={640}
          headerToolbar={{ left: "prev,next today", center: "title", right: "dayGridMonth,dayGridWeek" }}
          buttonText={{ today: "오늘", month: "월", week: "주" }}
          events={events}
          eventContent={(arg: EventContentArg) => {
            const it = arg.event.extendedProps as Item;
            return (
              <div
                className="px-1 py-0.5 leading-tight overflow-hidden"
                title={`${it.date}\n${it.siteName}\n${it.teamName} ${it.count}명 (${it.workers.join(", ")})\n인건비 ${won(it.totalWage)}원`}
              >
                <div className="font-bold text-[11px] truncate">
                  {it.teamName}/{it.count}명
                </div>
                <div className="text-[10px] opacity-90 truncate">{it.siteName}</div>
              </div>
            );
          }}
          eventClick={(arg: EventClickArg) => {
            const it = arg.event.extendedProps as Item;
            openModal(it.date, String(it.contractId));
          }}
          dateClick={(arg) => openModal(arg.dateStr)}
          dayMaxEvents={4}
          datesSet={(arg: DatesSetArg) => {
            const mid = new Date((arg.start.getTime() + arg.end.getTime()) / 2);
            const m = `${mid.getFullYear()}-${String(mid.getMonth() + 1).padStart(2, "0")}`;
            if (m !== monthRef.current) setMonth(m);
          }}
        />
      </div>

      {/* 투입 등록 모달 */}
      {modalDate && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="card w-full max-w-2xl p-5 max-h-[88vh] flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-base">
                <span className="text-blue-700">{modalDate}</span> 투입 등록
                {modalDate === todayYmd() && (
                  <span className="ml-1.5 text-[11px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">오늘</span>
                )}
              </h2>
              <button onClick={() => setModalDate(null)}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            {/* 현장 선택 */}
            <div className="mb-3">
              <label className="label">현장</label>
              <select className="input" value={modalSite} onChange={(e) => setModalSite(e.target.value)}>
                {contracts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.siteName} ({c.builderName})
                  </option>
                ))}
              </select>
            </div>

            {/* 투입 컨트롤 */}
            <div className="grid sm:grid-cols-2 gap-2 mb-3">
              <div className="flex gap-2">
                <select className="input flex-1" value={team} onChange={(e) => setTeam(e.target.value)}>
                  <option value="">팀 선택</option>
                  {teams.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
                <button className="btn-primary shrink-0" onClick={assignTeam}>
                  <Users2 className="w-4 h-4" /> 팀 투입
                </button>
              </div>
              <div className="flex gap-2">
                <select className="input flex-1" value={workerId} onChange={(e) => setWorkerId(e.target.value)}>
                  <option value="">개별 인원</option>
                  {workers.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.teamName} · {w.name}
                    </option>
                  ))}
                </select>
                <button className="btn-ghost shrink-0" onClick={addWorker}>
                  <UserPlus className="w-4 h-4" /> 추가
                </button>
              </div>
            </div>

            {msg && <p className="text-sm text-blue-700 font-semibold mb-2">{msg}</p>}

            {/* 투입 인원 */}
            <div className="flex-1 overflow-y-auto border border-slate-200 rounded-lg">
              <table className="w-full">
                <thead className="sticky top-0">
                  <tr>
                    <th className="th">팀</th>
                    <th className="th">이름</th>
                    <th className="th text-center w-32">근무</th>
                    <th className="th text-right w-32">확정 단가</th>
                    <th className="th text-right w-28">지급액</th>
                    <th className="th w-12"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 && (
                    <tr>
                      <td className="td text-center text-slate-400 py-6" colSpan={6}>
                        투입된 인원이 없습니다. 위에서 팀 또는 개별 인원을 투입하세요.
                      </td>
                    </tr>
                  )}
                  {rows.map((r) => (
                    <WageRow key={r.id} row={r} onPatch={patchRow} onRemove={removeRow} />
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between pt-3 text-sm">
              <span className="text-slate-500">
                투입 <b className="text-slate-800">{rows.length}</b>명 · 공수{" "}
                <b className="text-slate-800">{dayManDays}</b>
              </span>
              <span className="text-slate-500">
                당일 인건비 <b className="text-blue-700">{won(dayTotal)}</b>원
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function WageRow({
  row,
  onPatch,
  onRemove,
}: {
  row: Assignment;
  onPatch: (id: number, body: Record<string, unknown>) => void;
  onRemove: (id: number) => void;
}) {
  const [wage, setWage] = useState(String(row.actualWage));
  const dirty = Number(wage) !== row.actualWage;
  const pay = (Number(wage) || 0) * (row.halfDay ? 0.5 : 1);

  return (
    <tr className="hover:bg-slate-50 group">
      <td className="td text-slate-500">{row.teamName || row.worker.teamName}</td>
      <td className="td font-semibold">{row.worker.name}</td>
      <td className="td">
        {/* 종일 / 반일 */}
        <div className="flex rounded-lg border border-slate-200 overflow-hidden text-xs">
          <button
            className={`flex-1 py-1 font-semibold ${!row.halfDay ? "bg-blue-600 text-white" : "bg-white text-slate-500"}`}
            onClick={() => row.halfDay && onPatch(row.id, { halfDay: false })}
          >
            종일
          </button>
          <button
            className={`flex-1 py-1 font-semibold ${row.halfDay ? "bg-amber-500 text-white" : "bg-white text-slate-500"}`}
            onClick={() => !row.halfDay && onPatch(row.id, { halfDay: true })}
          >
            반일
          </button>
        </div>
      </td>
      <td className="td text-right">
        <input
          type="number"
          className="input py-1 text-right"
          value={wage}
          onChange={(e) => setWage(e.target.value)}
          onBlur={() => dirty && onPatch(row.id, { actualWage: Number(wage) || 0 })}
        />
      </td>
      <td className="td text-right font-semibold text-blue-700">
        {won(pay)}
        {row.halfDay && <span className="block text-[10px] text-amber-600 font-normal">반일 0.5</span>}
      </td>
      <td className="td text-right">
        {dirty ? (
          <button
            className="text-blue-600 hover:text-blue-800"
            onClick={() => onPatch(row.id, { actualWage: Number(wage) || 0 })}
            title="단가 저장"
          >
            <Save className="w-4 h-4" />
          </button>
        ) : (
          <button className="text-slate-300 hover:text-red-500" onClick={() => onRemove(row.id)} title="배제">
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </td>
    </tr>
  );
}
