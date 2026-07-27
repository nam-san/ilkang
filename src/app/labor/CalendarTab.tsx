"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import type { EventContentArg, EventClickArg, DatesSetArg } from "@fullcalendar/core";
import { won } from "@/lib/format";
import type { Contract } from "./LaborClient";

type Item = {
  date: string;
  contractId: number;
  siteName: string;
  teamName: string;
  count: number;
  totalWage: number;
  workers: string[];
};

// 팀별 구분 색상 팔레트 (팀 이름 정렬 순서대로 배정 → 색 중복 없음)
const PALETTE = [
  "#2563eb", // 파랑
  "#16a34a", // 초록
  "#f59e0b", // 주황
  "#7c3aed", // 보라
  "#dc2626", // 빨강
  "#0891b2", // 청록
  "#db2777", // 분홍
  "#65a30d", // 라임
];

export default function CalendarTab({
  contracts,
  onJump,
}: {
  contracts: Contract[];
  onJump?: (contractId: number, date: string) => void;
}) {
  const [items, setItems] = useState<Item[]>([]);
  const [siteFilter, setSiteFilter] = useState<string>("");
  const [month, setMonth] = useState<string>(() => new Date().toISOString().slice(0, 7));
  const monthRef = useRef(month);
  monthRef.current = month;

  const load = useCallback(async () => {
    const p = new URLSearchParams({ month: monthRef.current });
    if (siteFilter) p.set("contractId", siteFilter);
    const r = await fetch(`/api/assignments/calendar?${p}`, { cache: "no-store" });
    if (r.ok) setItems(await r.json());
  }, [siteFilter]);

  useEffect(() => {
    load();
  }, [load, month]);

  // 팀 → 색상 (정렬 순서 기준 배정)
  const teamColor = useMemo(() => {
    const names = [...new Set(items.map((i) => i.teamName))].sort();
    const map = new Map<string, string>();
    names.forEach((n, i) => map.set(n, PALETTE[i % PALETTE.length]));
    return (team: string) => map.get(team) ?? "#64748b";
  }, [items]);

  const events = useMemo(
    () =>
      items.map((it) => ({
        id: `${it.date}-${it.contractId}-${it.teamName}`,
        title: `${it.teamName}/${it.count}명`,
        start: it.date,
        allDay: true,
        backgroundColor: teamColor(it.teamName),
        borderColor: teamColor(it.teamName),
        extendedProps: it,
      })),
    [items, teamColor]
  );

  // 월 합계
  const totals = useMemo(() => {
    const headcount = items.reduce((s, i) => s + i.count, 0);
    const wage = items.reduce((s, i) => s + i.totalWage, 0);
    const teams = new Set(items.map((i) => i.teamName));
    return { headcount, wage, teams: teams.size };
  }, [items]);

  // 팀 범례
  const legend = useMemo(() => {
    const map = new Map<string, number>();
    for (const i of items) map.set(i.teamName, (map.get(i.teamName) ?? 0) + i.count);
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [items]);

  const renderEvent = (arg: EventContentArg) => {
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
  };

  const onEventClick = (arg: EventClickArg) => {
    const it = arg.event.extendedProps as Item;
    onJump?.(it.contractId, it.date);
  };

  return (
    <div className="space-y-3">
      {/* 필터 + 요약 */}
      <div className="card p-3 flex flex-wrap items-center gap-3">
        <select
          className="input w-56"
          value={siteFilter}
          onChange={(e) => setSiteFilter(e.target.value)}
        >
          <option value="">전체 현장</option>
          {contracts.map((c) => (
            <option key={c.id} value={c.id}>
              {c.siteName}
            </option>
          ))}
        </select>
        <p className="text-sm text-slate-500">
          팀별 투입 현황을 한눈에 확인합니다. 일정 클릭 시 해당 현장·날짜의 투입 화면으로 이동합니다.
        </p>
        <div className="ml-auto flex gap-4 text-sm shrink-0">
          <span className="text-slate-500">
            투입 팀 <b className="text-slate-800">{totals.teams}</b>
          </span>
          <span className="text-slate-500">
            연인원 <b className="text-slate-800">{totals.headcount}</b>명
          </span>
          <span className="text-slate-500">
            인건비 <b className="text-blue-700">{won(totals.wage)}</b>원
          </span>
        </div>
      </div>

      {/* 팀 범례 */}
      {legend.length > 0 && (
        <div className="flex flex-wrap gap-2 px-1">
          {legend.map(([team, cnt]) => (
            <span
              key={team}
              className="inline-flex items-center gap-1.5 text-xs text-slate-600 bg-white border border-slate-200 rounded-full px-2.5 py-1"
            >
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: teamColor(team) }}
              />
              {team} <span className="text-slate-400">{cnt}명</span>
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
          headerToolbar={{
            left: "prev,next today",
            center: "title",
            right: "dayGridMonth,dayGridWeek",
          }}
          buttonText={{ today: "오늘", month: "월", week: "주" }}
          events={events}
          eventContent={renderEvent}
          eventClick={onEventClick}
          dayMaxEvents={4}
          datesSet={(arg: DatesSetArg) => {
            // 보이는 달 기준으로 데이터 조회 (그리드 중앙 날짜의 월)
            const mid = new Date((arg.start.getTime() + arg.end.getTime()) / 2);
            const m = `${mid.getFullYear()}-${String(mid.getMonth() + 1).padStart(2, "0")}`;
            if (m !== monthRef.current) setMonth(m);
          }}
        />
      </div>

      {items.length === 0 && (
        <p className="text-center text-sm text-slate-400 py-2">
          {month}에 등록된 투입 내역이 없습니다. &lsquo;일자별 투입 · 근무일지&rsquo;에서 팀을 투입하세요.
        </p>
      )}
    </div>
  );
}
