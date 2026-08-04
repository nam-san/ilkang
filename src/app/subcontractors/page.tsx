"use client";

import { useState } from "react";
import { TrendingUp, Building2 } from "lucide-react";
import EstimateHistoryTab from "./EstimateHistoryTab";
import CompanyTab from "./CompanyTab";
import { StickyTabs, tabClass } from "@/components/SubNav";

const TABS = [
  { key: "history", label: "단가 이력", icon: TrendingUp },
  { key: "company", label: "업체 정보", icon: Building2 },
] as const;

export default function SubcontractorsPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("history");

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-slate-800">하도급 견적 관리</h1>

      <StickyTabs>
        {TABS.map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setTab(key)} className={tabClass(tab === key)}>
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </StickyTabs>

      {tab === "history" ? <EstimateHistoryTab /> : <CompanyTab />}
    </div>
  );
}
