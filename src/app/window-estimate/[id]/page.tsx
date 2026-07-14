"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Settings2, FileUp, Ruler, Coins } from "lucide-react";
import StandardsTab from "./StandardsTab";
import LinesTab from "./LinesTab";
import MaterialsTab from "./MaterialsTab";
import CostsTab from "./CostsTab";

export type WindowComponentT = {
  id: number;
  name: string;
  unitWeight: number;
  defaultCountW: number;
  defaultCountH: number;
};
export type WindowTypeT = {
  id: number;
  name: string;
  sortOrder: number;
  active: boolean;
  components: WindowComponentT[];
};
export type Project = {
  id: number;
  siteName: string;
  workType: string | null;
  builderName: string | null;
  costParam: {
    barPrices: string;
    wagePerKg: number;
    hingeCost: number;
    screenCost: number;
    pjInstallCost: number;
  } | null;
  windowTypes: WindowTypeT[];
  _count: { lines: number };
};

const TABS = [
  { key: "standards", label: "기준값 관리", icon: Settings2 },
  { key: "lines", label: "엑셀 업로드 · 라인 검토", icon: FileUp },
  { key: "materials", label: "자재 산출", icon: Ruler },
  { key: "costs", label: "비용 계산 · 견적서", icon: Coins },
] as const;

export default function WorkspacePage() {
  const { id } = useParams<{ id: string }>();
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("standards");
  const [project, setProject] = useState<Project | null>(null);

  const load = useCallback(async () => {
    const r = await fetch(`/api/estimate-projects/${id}`, { cache: "no-store" });
    if (r.ok) setProject(await r.json());
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (!project) return <p className="text-slate-400 p-6">불러오는 중…</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <Link href="/window-estimate" className="btn-ghost">
            <ArrowLeft className="w-4 h-4" /> 목록
          </Link>
          <div>
            <h1 className="text-xl font-bold text-slate-800">{project.siteName}</h1>
            <p className="text-xs text-slate-400">
              {project.builderName ? `${project.builderName} · ` : ""}
              {project.workType || "공종 미지정"}
            </p>
          </div>
        </div>
      </div>

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

      {tab === "standards" && <StandardsTab project={project} reload={load} />}
      {tab === "lines" && <LinesTab project={project} reloadProject={load} />}
      {tab === "materials" && <MaterialsTab project={project} />}
      {tab === "costs" && <CostsTab project={project} />}
    </div>
  );
}
