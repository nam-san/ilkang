"use client";

import { useState } from "react";
import { Square, Umbrella, Ruler, Grid3x3 } from "lucide-react";
import SheetAreaTab from "./SheetAreaTab";
import CanopyAreaTab from "./CanopyAreaTab";
import PipeCutTab from "./PipeCutTab";
import PlateCutTab from "./PlateCutTab";
import { StickyTabs, tabClass } from "@/components/SubNav";

const TABS = [
  { key: "sheet", label: "시트 면적 산출", icon: Square },
  { key: "canopy", label: "캐노피 면적 산출", icon: Umbrella },
  { key: "pipe", label: "파이프 절단 계산기", icon: Ruler },
  { key: "plate", label: "원판 절단 계산기", icon: Grid3x3 },
] as const;

export default function MaterialsPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("sheet");

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-slate-800">자재 계산기</h1>

      <StickyTabs>
        {TABS.map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setTab(key)} className={tabClass(tab === key)}>
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </StickyTabs>

      {tab === "sheet" && <SheetAreaTab />}
      {tab === "canopy" && <CanopyAreaTab />}
      {tab === "pipe" && <PipeCutTab />}
      {tab === "plate" && <PlateCutTab />}
    </div>
  );
}
