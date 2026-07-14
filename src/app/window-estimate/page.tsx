"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Calculator, Layers, FileText, Building2, ArrowRight } from "lucide-react";
import { ymd } from "@/lib/format";

type Project = {
  id: number;
  siteName: string;
  workType: string | null;
  builderName: string | null;
  createdAt: string;
  _count: { lines: number; windowTypes: number };
};

export default function WindowEstimatePage() {
  const [list, setList] = useState<Project[]>([]);

  const load = useCallback(async () => {
    const r = await fetch("/api/estimate-projects", { cache: "no-store" });
    if (r.ok) setList(await r.json());
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
        <Calculator className="w-5 h-5 text-blue-600" /> 창호 견적 산출
      </h1>

      <div className="card p-4 bg-blue-50/40 border-blue-100 flex items-center gap-2 text-sm text-slate-600">
        <FileText className="w-4 h-4 text-blue-600 shrink-0" />
        <span>
          견적산출은 <b>견적 관리</b>에서 <b>입찰을 등록</b>한 뒤 각 입찰의 <b>[견적산출]</b> 버튼으로 시작됩니다.
        </span>
        <Link href="/estimates" className="btn-primary py-1.5 ml-auto shrink-0">
          견적 관리로 이동 <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {list.length === 0 && (
          <div className="card p-8 text-center text-slate-400 sm:col-span-2 lg:col-span-3">
            <Calculator className="w-8 h-8 mx-auto mb-2 text-slate-300" />
            진행 중인 견적산출 공사가 없습니다.
            <br />
            <span className="text-sm">견적 관리에서 입찰을 등록하고 &lsquo;견적산출&rsquo;을 눌러 시작하세요.</span>
          </div>
        )}
        {list.map((p) => (
          <Link
            key={p.id}
            href={`/window-estimate/${p.id}`}
            className="card p-4 hover:border-blue-400 hover:shadow transition-all"
          >
            <div className="font-bold text-slate-800">{p.siteName}</div>
            <div className="text-xs text-slate-400 mb-3 flex items-center gap-1">
              {p.builderName && (
                <>
                  <Building2 className="w-3 h-3" />
                  {p.builderName} ·{" "}
                </>
              )}
              {p.workType || "공종 미지정"} · {ymd(p.createdAt)}
            </div>
            <div className="flex gap-3 text-xs text-slate-500">
              <span className="inline-flex items-center gap-1">
                <Layers className="w-3.5 h-3.5" /> 창호유형 {p._count.windowTypes}
              </span>
              <span className="inline-flex items-center gap-1">
                <FileText className="w-3.5 h-3.5" /> 라인 {p._count.lines}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
