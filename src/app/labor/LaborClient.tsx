"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Users, BarChart3, CalendarRange, Camera } from "lucide-react";
import TeamTab from "./TeamTab";
import SummaryTab from "./SummaryTab";
import CalendarTab from "./CalendarTab";
import LogsTab from "./LogsTab";
import { StickyTabs, tabClass } from "@/components/SubNav";

export type Contract = { id: number; siteName: string; builderName: string };
export type Worker = {
  id: number;
  name: string;
  teamName: string;
  dailyWage: number;
  active: boolean;
};

const TABS = [
  { key: "calendar", label: "투입 캘린더", icon: CalendarRange },
  { key: "team", label: "팀 & 인건비 설정", icon: Users },
  { key: "summary", label: "현장별 인건비 써머리", icon: BarChart3 },
  { key: "logs", label: "근무일지 · 현장사진", icon: Camera },
] as const;

export default function LaborClient() {
  const sp = useSearchParams();
  const preSite = sp.get("site"); // 수주관리 → '인력 투입 관리' 진입 시 현장 지정
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("calendar");
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);

  const loadContracts = useCallback(async () => {
    const r = await fetch("/api/contracts", { cache: "no-store" });
    if (r.ok) setContracts(await r.json());
  }, []);
  const loadWorkers = useCallback(async () => {
    const r = await fetch("/api/workers", { cache: "no-store" });
    if (r.ok) setWorkers(await r.json());
  }, []);

  useEffect(() => {
    loadContracts();
    loadWorkers();
  }, [loadContracts, loadWorkers]);

  const teams = useMemo(
    () => [...new Set(workers.map((w) => w.teamName))].sort(),
    [workers]
  );

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-slate-800">공사 현장별 인원 및 인건비 관리</h1>

      <StickyTabs>
        {TABS.map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setTab(key)} className={tabClass(tab === key)}>
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </StickyTabs>

      {tab === "calendar" && (
        <CalendarTab contracts={contracts} workers={workers} teams={teams} preSite={preSite} />
      )}
      {tab === "team" && <TeamTab workers={workers} teams={teams} reload={loadWorkers} />}
      {tab === "summary" && <SummaryTab />}
      {tab === "logs" && <LogsTab contracts={contracts} />}
    </div>
  );
}
