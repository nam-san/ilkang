"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, Calculator, Building2, FileText, BarChart3, Search } from "lucide-react";
import { ymd } from "@/lib/format";

type Bid = {
  id: number;
  builderName: string;
  siteName: string;
  startDate: string | null;
  endDate: string | null;
  dueDate: string | null;
  estimateProject: { id: number; _count: { lines: number } } | null;
};

const empty = {
  builderName: "",
  siteName: "",
  startDate: "",
  endDate: "",
  dueDate: "",
};

export default function EstimatesPage() {
  const router = useRouter();
  const [bids, setBids] = useState<Bid[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...empty });
  const [err, setErr] = useState("");
  const [goingId, setGoingId] = useState<number | null>(null);
  const [year, setYear] = useState(""); // 착공년도 필터 ("" = 전체)
  const [q, setQ] = useState(""); // 건설사·현장 검색

  const load = useCallback(async () => {
    const res = await fetch("/api/bids", { cache: "no-store" });
    if (res.ok) setBids(await res.json());
  }, []);

  // 입찰 → 창호 견적산출 공사 연동 후 이동
  const goEstimate = async (bidId: number) => {
    setGoingId(bidId);
    const res = await fetch(`/api/bids/${bidId}/estimate-project`, { method: "POST" });
    if (res.ok) {
      const { projectId } = await res.json();
      router.push(`/window-estimate/${projectId}`);
    } else {
      setGoingId(null);
    }
  };

  useEffect(() => {
    load();
  }, [load]);

  const submit = async () => {
    setErr("");
    const res = await fetch("/api/bids", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (!res.ok) {
      setErr((await res.json()).error || "저장 실패");
      return;
    }
    setForm({ ...empty });
    setShowForm(false);
    load();
  };

  // 선택 가능한 착공년도 목록
  const years = useMemo(() => {
    const set = new Set<number>();
    for (const b of bids) if (b.startDate) set.add(new Date(b.startDate).getFullYear());
    return Array.from(set).sort((a, b) => b - a);
  }, [bids]);

  // 연도 필터 적용 (오른쪽 통계 + 왼쪽 목록 공통)
  const yearFiltered = useMemo(() => {
    if (!year) return bids;
    return bids.filter(
      (b) => b.startDate && new Date(b.startDate).getFullYear() === Number(year)
    );
  }, [bids, year]);

  // 검색 적용 (왼쪽 목록 전용)
  const visible = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return yearFiltered;
    return yearFiltered.filter(
      (b) =>
        b.builderName.toLowerCase().includes(query) ||
        b.siteName.toLowerCase().includes(query)
    );
  }, [yearFiltered, q]);

  // 건설사별 입찰 현황 집계 (연도 필터 반영)
  const builderStats = useMemo(() => {
    const map = new Map<string, { count: number; withEstimate: number }>();
    for (const b of yearFiltered) {
      const cur = map.get(b.builderName) ?? { count: 0, withEstimate: 0 };
      cur.count += 1;
      if (b.estimateProject) cur.withEstimate += 1;
      map.set(b.builderName, cur);
    }
    const rows = Array.from(map.entries())
      .map(([builderName, v]) => ({ builderName, ...v }))
      .sort((a, b) => b.count - a.count);
    const maxCount = rows.reduce((m, r) => Math.max(m, r.count), 0) || 1;
    return { rows, maxCount, totalBids: yearFiltered.length, totalBuilders: rows.length };
  }, [yearFiltered]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-xl font-bold text-slate-800">견적 관리 (입찰별)</h1>
        <button className="btn-primary" onClick={() => setShowForm(true)}>
          <Plus className="w-4 h-4" /> 입찰 등록
        </button>
      </div>

      <p className="text-sm text-slate-500">
        먼저 <b>입찰</b>을 등록한 뒤, 각 입찰의 <b>[견적산출]</b>에서 창호 견적(기준값·자재 산출·비용 계산)을 진행하세요.
      </p>

      {/* 좌: 입찰 내용 (7)  /  우: 건설사별 입찰 현황 (3) */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4 items-start">
        {/* ── 왼쪽: 입찰 내용 ── */}
        <section className="space-y-3">
          {/* 필터 + 검색 */}
          <div className="card p-3 flex flex-wrap items-center gap-2">
            <select
              className="input w-36"
              value={year}
              onChange={(e) => setYear(e.target.value)}
            >
              <option value="">착공년도 전체</option>
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}년
                </option>
              ))}
            </select>
            <div className="relative flex-1 min-w-[180px]">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                className="input pl-9"
                placeholder="건설사명·현장명 검색"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
            {(year || q) && (
              <button
                className="btn-ghost shrink-0"
                onClick={() => {
                  setYear("");
                  setQ("");
                }}
              >
                <X className="w-4 h-4" /> 초기화
              </button>
            )}
            <span className="text-xs text-slate-500 shrink-0 ml-auto">
              {visible.length}건 표시
            </span>
          </div>

          {/* 입찰 목록 */}
          <div className="card overflow-x-auto">
            <table className="w-full min-w-[720px]">
              <thead>
                <tr>
                  <th className="th">건설사명</th>
                  <th className="th">현장명</th>
                  <th className="th">착공</th>
                  <th className="th">준공</th>
                  <th className="th">예정일</th>
                  <th className="th text-center">견적산출</th>
                  <th className="th"></th>
                </tr>
              </thead>
              <tbody>
                {visible.length === 0 && (
                  <tr>
                    <td className="td text-center text-slate-400 py-10" colSpan={7}>
                      <FileText className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                      {bids.length === 0
                        ? "등록된 입찰이 없습니다. ‘입찰 등록’으로 시작하세요."
                        : "조건에 맞는 입찰이 없습니다."}
                    </td>
                  </tr>
                )}
                {visible.map((b) => (
                  <tr key={b.id} className="hover:bg-blue-50/40">
                    <td className="td">
                      <span className="inline-flex items-center gap-1 text-slate-600">
                        <Building2 className="w-3.5 h-3.5 text-slate-400" />
                        {b.builderName}
                      </span>
                    </td>
                    <td className="td font-semibold">{b.siteName}</td>
                    <td className="td">{ymd(b.startDate) || "-"}</td>
                    <td className="td">{ymd(b.endDate) || "-"}</td>
                    <td className="td">{ymd(b.dueDate) || "-"}</td>
                    <td className="td text-center">
                      {b.estimateProject ? (
                        <span className="inline-block px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold">
                          라인 {b.estimateProject._count.lines}건
                        </span>
                      ) : (
                        <span className="text-slate-400 text-xs">미작성</span>
                      )}
                    </td>
                    <td className="td text-right">
                      <button
                        className="btn-primary py-1.5"
                        onClick={() => goEstimate(b.id)}
                        disabled={goingId === b.id}
                      >
                        <Calculator className="w-4 h-4" /> {goingId === b.id ? "이동중…" : "견적산출"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* ── 오른쪽: 건설사별 입찰 현황 ── */}
        <aside className="card overflow-hidden lg:sticky lg:top-16">
          <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200">
            <h2 className="font-bold text-sm text-slate-700 flex items-center gap-1.5">
              <BarChart3 className="w-4 h-4 text-blue-600" /> 건설사별 입찰 현황
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {year ? `${year}년 · ` : "전체 · "}건설사 {builderStats.totalBuilders}곳 · 입찰{" "}
              <b className="text-blue-700">{builderStats.totalBids}</b>건
            </p>
          </div>
          <div className="max-h-[70vh] overflow-y-auto divide-y divide-slate-100">
            {builderStats.rows.length === 0 && (
              <p className="p-6 text-center text-sm text-slate-400">표시할 입찰이 없습니다.</p>
            )}
            {builderStats.rows.map((r) => (
              <div key={r.builderName} className="px-4 py-2.5">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm font-semibold text-slate-700 inline-flex items-center gap-1 truncate">
                    <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    {r.builderName}
                  </span>
                  <span className="text-xs text-slate-400 shrink-0 ml-2">
                    견적산출 {r.withEstimate}/{r.count}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-slate-100 rounded-full h-2.5 overflow-hidden">
                    <div
                      className="bg-blue-600 h-full rounded-full"
                      style={{ width: `${(r.count / builderStats.maxCount) * 100}%` }}
                    />
                  </div>
                  <span className="text-sm font-bold text-blue-700 w-8 text-right">{r.count}건</span>
                </div>
              </div>
            ))}
          </div>
        </aside>
      </div>

      {/* 입찰 등록 모달 */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="card w-full max-w-lg p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-lg">입찰 등록</h2>
              <button onClick={() => setShowForm(false)}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            {err && <p className="text-sm text-red-600 mb-3">{err}</p>}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">건설사명 *</label>
                <input className="input" value={form.builderName} onChange={(e) => setForm({ ...form, builderName: e.target.value })} />
              </div>
              <div>
                <label className="label">현장명 *</label>
                <input className="input" value={form.siteName} onChange={(e) => setForm({ ...form, siteName: e.target.value })} />
              </div>
              <div>
                <label className="label">착공</label>
                <input type="date" className="input" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
              </div>
              <div>
                <label className="label">준공</label>
                <input type="date" className="input" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
              </div>
              <div className="col-span-2">
                <label className="label">예정일 (입찰 예정일)</label>
                <input type="date" className="input" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button className="btn-ghost" onClick={() => setShowForm(false)}>취소</button>
              <button className="btn-primary" onClick={submit}>저장</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
