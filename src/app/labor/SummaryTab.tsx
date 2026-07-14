"use client";

import { useEffect, useState, useCallback } from "react";
import { BarChart3, Building2, Users, Printer } from "lucide-react";
import { won } from "@/lib/format";

type SiteRow = {
  contractId: number;
  siteName: string;
  builderName: string;
  headcount: number;
  totalWage: number;
};
type WorkerRow = {
  workerId: number;
  name: string;
  teamName: string;
  days: number;
  totalWage: number;
  minWage: number;
  maxWage: number;
};
type Summary = {
  month: string;
  summary: SiteRow[];
  byWorker: WorkerRow[];
  grand: { headcount: number; totalWage: number; workerCount: number };
};

const thisMonth = new Date().toISOString().slice(0, 7);

export default function SummaryTab() {
  const [month, setMonth] = useState(thisMonth);
  const [data, setData] = useState<Summary | null>(null);
  const [view, setView] = useState<"site" | "worker">("site");

  const load = useCallback(async () => {
    const r = await fetch(`/api/summary?month=${month}`, { cache: "no-store" });
    if (r.ok) setData(await r.json());
  }, [month]);

  useEffect(() => {
    load();
  }, [load]);

  const empty = !data || (view === "site" ? data.summary.length === 0 : data.byWorker.length === 0);

  return (
    <div className="space-y-4">
      <div className="card p-4 flex items-center gap-3 flex-wrap">
        <label className="label mb-0">조회 월</label>
        <input
          type="month"
          className="input w-44"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
        />

        {/* 현장별 / 인원별 전환 */}
        <div className="flex rounded-lg border border-slate-200 overflow-hidden">
          <button
            onClick={() => setView("site")}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-semibold ${
              view === "site" ? "bg-blue-600 text-white" : "bg-white text-slate-500 hover:bg-slate-50"
            }`}
          >
            <Building2 className="w-4 h-4" /> 현장별
          </button>
          <button
            onClick={() => setView("worker")}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-semibold ${
              view === "worker" ? "bg-blue-600 text-white" : "bg-white text-slate-500 hover:bg-slate-50"
            }`}
          >
            <Users className="w-4 h-4" /> 인원별
          </button>
        </div>

        {data && (
          <div className="ml-auto flex gap-4 text-sm">
            <span className="text-slate-500">
              참여 인원 <b className="text-slate-800">{data.grand.workerCount}</b>명
            </span>
            <span className="text-slate-500">
              총 연인원 <b className="text-slate-800">{data.grand.headcount}</b>명
            </span>
            <span className="text-slate-500">
              총 인건비 <b className="text-blue-700 text-base">{won(data.grand.totalWage)}</b>원
            </span>
          </div>
        )}
      </div>

      {/* 현장별 집계 */}
      {view === "site" && (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[560px]">
            <thead>
              <tr>
                <th className="th">현장명</th>
                <th className="th">건설사</th>
                <th className="th text-right">투입 연인원</th>
                <th className="th text-right">정산 인건비 합계</th>
              </tr>
            </thead>
            <tbody>
              {empty && (
                <tr>
                  <td className="td text-center text-slate-400 py-8" colSpan={4}>
                    <BarChart3 className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    {month} 투입 내역이 없습니다.
                  </td>
                </tr>
              )}
              {data?.summary.map((s) => (
                <tr key={s.contractId} className="hover:bg-slate-50">
                  <td className="td font-semibold">
                    <div className="flex items-center gap-2">
                      <span>{s.siteName}</span>
                      <a
                        href={`/labor/print?site=${s.contractId}&month=${month}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-ghost py-1 px-2 text-xs shrink-0"
                        title={`${month} 근무일지 날짜순 1일 1장 출력`}
                      >
                        <Printer className="w-3.5 h-3.5" /> 근무일지 출력
                      </a>
                    </div>
                  </td>
                  <td className="td text-slate-600">{s.builderName}</td>
                  <td className="td text-right">{s.headcount}명</td>
                  <td className="td text-right font-semibold text-blue-700">{won(s.totalWage)}원</td>
                </tr>
              ))}
            </tbody>
            {data && data.summary.length > 0 && (
              <tfoot>
                <tr className="bg-slate-50 font-bold">
                  <td className="td" colSpan={2}>합계</td>
                  <td className="td text-right">{data.grand.headcount}명</td>
                  <td className="td text-right text-blue-800">{won(data.grand.totalWage)}원</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}

      {/* 인원별 급여 */}
      {view === "worker" && (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[560px]">
            <thead>
              <tr>
                <th className="th">이름</th>
                <th className="th">팀</th>
                <th className="th text-right">일당</th>
                <th className="th text-right">투입 일수</th>
                <th className="th text-right">정산 급여</th>
              </tr>
            </thead>
            <tbody>
              {empty && (
                <tr>
                  <td className="td text-center text-slate-400 py-8" colSpan={5}>
                    <Users className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    {month} 투입 내역이 없습니다.
                  </td>
                </tr>
              )}
              {data?.byWorker.map((w) => (
                <tr key={w.workerId} className="hover:bg-slate-50">
                  <td className="td font-semibold">{w.name}</td>
                  <td className="td text-slate-600">{w.teamName}</td>
                  <td className="td text-right">
                    {w.minWage === w.maxWage ? (
                      `${won(w.minWage)}원`
                    ) : (
                      <span title="해당 월에 적용된 일당이 여러 건입니다">
                        {won(w.minWage)}~{won(w.maxWage)}원
                      </span>
                    )}
                  </td>
                  <td className="td text-right">{w.days}일</td>
                  <td className="td text-right font-semibold text-blue-700">{won(w.totalWage)}원</td>
                </tr>
              ))}
            </tbody>
            {data && data.byWorker.length > 0 && (
              <tfoot>
                <tr className="bg-slate-50 font-bold">
                  <td className="td" colSpan={3}>합계 ({data.grand.workerCount}명)</td>
                  <td className="td text-right">{data.grand.headcount}일</td>
                  <td className="td text-right text-blue-800">{won(data.grand.totalWage)}원</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </div>
  );
}
