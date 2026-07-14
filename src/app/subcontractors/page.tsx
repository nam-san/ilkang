"use client";

import { useState } from "react";
import { TrendingUp, Building2 } from "lucide-react";
import EstimateHistoryTab from "./EstimateHistoryTab";
import CompanyTab from "./CompanyTab";

const TABS = [
  { key: "history", label: "단가 이력", icon: TrendingUp },
  { key: "company", label: "업체 정보", icon: Building2 },
] as const;

export default function SubcontractorsPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("history");

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-slate-800">하도급 견적 관리</h1>

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

      {tab === "history" ? <EstimateHistoryTab /> : <CompanyTab />}
    </div>
  );
}
