"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Users, CalendarDays, BarChart3 } from "lucide-react";
import AssignTab from "./AssignTab";
import TeamTab from "./TeamTab";
import SummaryTab from "./SummaryTab";

export type Contract = { id: number; siteName: string; builderName: string };
export type Worker = {
  id: number;
  name: string;
  teamName: string;
  dailyWage: number;
  active: boolean;
};

const TABS = [
  { key: "assign", label: "일자별 투입 · 근무일지", icon: CalendarDays },
  { key: "team", label: "팀 & 인건비 설정", icon: Users },
  { key: "summary", label: "월별 인건비 써머리", icon: BarChart3 },
] as const;

export default function LaborClient() {
  const sp = useSearchParams();
  const preSite = sp.get("site");
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("assign");
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

      <div className="flex gap-1 border-b border-slate-200">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors ${
              tab === key
                ? "border-blue-600 text-blue-700"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {tab === "assign" && (
        <AssignTab
          contracts={contracts}
          workers={workers}
          teams={teams}
          preSite={preSite}
        />
      )}
      {tab === "team" && <TeamTab workers={workers} teams={teams} reload={loadWorkers} />}
      {tab === "summary" && <SummaryTab />}
    </div>
  );
}
