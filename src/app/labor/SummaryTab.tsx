"use client";

import { useEffect, useState, useCallback } from "react";
import { BarChart3, Building2, Users, X } from "lucide-react";
import { won } from "@/lib/format";

type SiteRow = {
  contractId: number;
  siteName: string;
  builderName: string;
  headcount: number;
  manDays: number;
  workDays: number;
  totalWage: number;
  firstDate: string;
  lastDate: string;
};
type WorkerRow = {
  workerId: number;
  name: string;
  teamName: string;
  days: number;
  manDays: number;
  totalWage: number;
  minWage: number;
  maxWage: number;
};
type Summary = {
  month: string | null;
  summary: SiteRow[];
  byWorker: WorkerRow[];
  grand: { headcount: number; manDays: number; totalWage: number; workerCount: number; siteCount: number };
};

export default function SummaryTab() {
  const [month, setMonth] = useState(""); // "" = 전체 기간 누적
  const [data, setData] = useState<Summary | null>(null);
  const [view, setView] = useState<"site" | "worker">("site");

  const load = useCallback(async () => {
    const q = month ? `?month=${month}` : "";
    const r = await fetch(`/api/summary${q}`, { cache: "no-store" });
    if (r.ok) setData(await r.json());
  }, [month]);

  useEffect(() => {
    load();
  }, [load]);

  const periodLabel = month ? `${month} (월별 조회)` : "전체 기간 누적";
  const empty = !data || (view === "site" ? data.summary.length === 0 : data.byWorker.length === 0);

  return (
    <div className="space-y-4">
      <div className="card p-4 flex items-center gap-3 flex-wrap">
        {/* 기간: 기본 전체 누적, 월 조회는 옵션 */}
        <label className="label mb-0">기간</label>
        <span className="text-sm font-semibold text-slate-700">{periodLabel}</span>
        <input
          type="month"
          className="input w-44"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          title="특정 월만 조회 (선택)"
        />
        {month && (
          <button className="btn-ghost" onClick={() => setMonth("")}>
            <X className="w-4 h-4" /> 전체 누적으로
          </button>
        )}

        <div className="flex rounded-lg border border-slate-200 overflow-hidden ml-2">
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
              현장 <b className="text-slate-800">{data.grand.siteCount}</b>
            </span>
            <span className="text-slate-500">
              공수 <b className="text-slate-800">{data.grand.manDays}</b>
            </span>
            <span className="text-slate-500">
              총 인건비 <b className="text-blue-700 text-base">{won(data.grand.totalWage)}</b>원
            </span>
          </div>
        )}
      </div>

      {/* 현장별 누적 */}
      {view === "site" && (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[860px]">
            <thead>
              <tr>
                <th className="th">현장명</th>
                <th className="th">건설사</th>
                <th className="th">투입 기간</th>
                <th className="th text-right w-24">투입일수</th>
                <th className="th text-right w-24">연인원</th>
                <th className="th text-right w-24">공수</th>
                <th className="th text-right w-36">누적 인건비</th>
                <th className="th w-32"></th>
              </tr>
            </thead>
            <tbody>
              {empty && (
                <tr>
                  <td className="td text-center text-slate-400 py-8" colSpan={8}>
                    <BarChart3 className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    {month ? `${month} 투입 내역이 없습니다.` : "투입 내역이 없습니다."}
                  </td>
                </tr>
              )}
              {data?.summary.map((s) => (
                <tr key={s.contractId} className="hover:bg-slate-50">
                  <td className="td font-semibold">{s.siteName}</td>
                  <td className="td text-slate-600">{s.builderName}</td>
                  <td className="td text-xs text-slate-500">
                    {s.firstDate} ~ {s.lastDate}
                  </td>
                  <td className="td text-right">{s.workDays}일</td>
                  <td className="td text-right">{s.headcount}명</td>
                  <td className="td text-right">{s.manDays}</td>
                  <td className="td text-right font-semibold text-blue-700">{won(s.totalWage)}원</td>
                  <td className="td text-right">
                    <a
                      href={`/labor/print?site=${s.contractId}&month=${month || s.lastDate.slice(0, 7)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-ghost py-1 px-2 text-xs"
                      title="근무일지 출력"
                    >
                      근무일지 출력
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
            {data && data.summary.length > 0 && (
              <tfoot>
                <tr className="bg-slate-50 font-bold">
                  <td className="td" colSpan={4}>
                    합계 ({data.grand.siteCount}개 현장)
                  </td>
                  <td className="td text-right">{data.grand.headcount}명</td>
                  <td className="td text-right">{data.grand.manDays}</td>
                  <td className="td text-right text-blue-800">{won(data.grand.totalWage)}원</td>
                  <td className="td"></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}

      {/* 인원별 */}
      {view === "worker" && (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[620px]">
            <thead>
              <tr>
                <th className="th">이름</th>
                <th className="th">팀</th>
                <th className="th text-right w-36">일당</th>
                <th className="th text-right w-24">투입 건수</th>
                <th className="th text-right w-24">공수</th>
                <th className="th text-right w-36">정산 급여</th>
              </tr>
            </thead>
            <tbody>
              {empty && (
                <tr>
                  <td className="td text-center text-slate-400 py-8" colSpan={6}>
                    <Users className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    투입 내역이 없습니다.
                  </td>
                </tr>
              )}
              {data?.byWorker.map((w) => (
                <tr key={w.workerId} className="hover:bg-slate-50">
                  <td className="td font-semibold">{w.name}</td>
                  <td className="td text-slate-600">{w.teamName}</td>
                  <td className="td text-right">
                    {w.minWage === w.maxWage
                      ? `${won(w.minWage)}원`
                      : `${won(w.minWage)}~${won(w.maxWage)}원`}
                  </td>
                  <td className="td text-right">{w.days}건</td>
                  <td className="td text-right">{w.manDays}</td>
                  <td className="td text-right font-semibold text-blue-700">{won(w.totalWage)}원</td>
                </tr>
              ))}
            </tbody>
            {data && data.byWorker.length > 0 && (
              <tfoot>
                <tr className="bg-slate-50 font-bold">
                  <td className="td" colSpan={3}>
                    합계 ({data.grand.workerCount}명)
                  </td>
                  <td className="td text-right">{data.grand.headcount}건</td>
                  <td className="td text-right">{data.grand.manDays}</td>
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
