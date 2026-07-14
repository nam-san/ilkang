"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { Plus, Filter, Building2, X } from "lucide-react";
import { won, ymd, warrantyEndYmd, WARRANTY_YEARS } from "@/lib/format";

type Contract = {
  id: number;
  siteName: string;
  startDate: string | null;
  endDate: string | null;
  builderName: string;
  contractAmount: number;
  manager: string | null;
  warrantyPeriod: string | null;
};

const empty = {
  siteName: "",
  startDate: "",
  endDate: "",
  builderName: "",
  contractAmount: "",
  manager: "",
  warrantyPeriod: "",
};

export default function ContractsPage() {
  const [list, setList] = useState<Contract[]>([]);
  const [year, setYear] = useState("");
  const [yearBy, setYearBy] = useState("end");
  const [builder, setBuilder] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...empty });
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    const p = new URLSearchParams();
    if (year) {
      p.set("year", year);
      p.set("yearBy", yearBy);
    }
    if (builder) p.set("builder", builder);
    const res = await fetch(`/api/contracts?${p}`, { cache: "no-store" });
    if (res.ok) setList(await res.json());
  }, [year, yearBy, builder]);

  useEffect(() => {
    load();
  }, [load]);

  // 필터 드롭다운용 (전체 목록에서 건설사 추출)
  const [allBuilders, setAllBuilders] = useState<string[]>([]);
  useEffect(() => {
    fetch("/api/contracts", { cache: "no-store" })
      .then((r) => r.json())
      .then((all: Contract[]) =>
        setAllBuilders([...new Set(all.map((c) => c.builderName))].sort())
      );
  }, [list.length]);

  const submit = async () => {
    setErr("");
    const res = await fetch("/api/contracts", {
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

  const totalAmount = useMemo(
    () => list.reduce((s, c) => s + c.contractAmount, 0),
    [list]
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-xl font-bold text-slate-800">수주내역 관리</h1>
        <button className="btn-primary" onClick={() => setShowForm(true)}>
          <Plus className="w-4 h-4" /> 수주 등록
        </button>
      </div>

      {/* 필터 */}
      <div className="card p-3 flex flex-wrap items-end gap-3">
        <div className="flex items-center gap-1.5 text-slate-500 text-sm font-semibold">
          <Filter className="w-4 h-4" /> 필터
        </div>
        <div>
          <label className="label">연도</label>
          <input
            className="input w-28"
            placeholder="예: 2026"
            value={year}
            onChange={(e) => setYear(e.target.value.replace(/[^0-9]/g, "").slice(0, 4))}
          />
        </div>
        <div>
          <label className="label">기준</label>
          <select className="input w-28" value={yearBy} onChange={(e) => setYearBy(e.target.value)}>
            <option value="end">준공년도</option>
            <option value="start">착공년도</option>
          </select>
        </div>
        <div>
          <label className="label">건설사</label>
          <select className="input w-44" value={builder} onChange={(e) => setBuilder(e.target.value)}>
            <option value="">전체</option>
            {allBuilders.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </div>
        {(year || builder) && (
          <button
            className="btn-ghost"
            onClick={() => {
              setYear("");
              setBuilder("");
            }}
          >
            <X className="w-4 h-4" /> 초기화
          </button>
        )}
        <div className="ml-auto text-sm text-slate-500">
          총 <b className="text-slate-800">{list.length}</b>건 · 도급액 합계{" "}
          <b className="text-blue-700">{won(totalAmount)}</b>원
        </div>
      </div>

      {/* 리스트 */}
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[900px]">
          <thead>
            <tr>
              <th className="th">현장명</th>
              <th className="th">건설사</th>
              <th className="th">착공일</th>
              <th className="th">준공일</th>
              <th className="th text-right">도급액</th>
              <th className="th">담당자</th>
              <th className="th">하자보수 만료일</th>
            </tr>
          </thead>
          <tbody>
            {list.length === 0 && (
              <tr>
                <td className="td text-center text-slate-400 py-8" colSpan={7}>
                  등록된 수주내역이 없습니다.
                </td>
              </tr>
            )}
            {list.map((c) => (
              <tr key={c.id} className="hover:bg-blue-50/40">
                <td className="td font-semibold">
                  <Link href={`/contracts/${c.id}`} className="text-blue-700 hover:underline">
                    {c.siteName}
                  </Link>
                </td>
                <td className="td">
                  <span className="inline-flex items-center gap-1 text-slate-600">
                    <Building2 className="w-3.5 h-3.5 text-slate-400" />
                    {c.builderName}
                  </span>
                </td>
                <td className="td">{ymd(c.startDate) || "-"}</td>
                <td className="td">{ymd(c.endDate) || "-"}</td>
                <td className="td text-right font-semibold">{won(c.contractAmount)}</td>
                <td className="td">{c.manager || "-"}</td>
                <td className="td">{c.warrantyPeriod ? `~ ${c.warrantyPeriod}` : "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 등록 모달 */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="card w-full max-w-lg p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-lg">수주내역 등록</h2>
              <button onClick={() => setShowForm(false)}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            {err && <p className="text-sm text-red-600 mb-3">{err}</p>}
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="label">현장명 (공사명) *</label>
                <input
                  className="input"
                  value={form.siteName}
                  onChange={(e) => setForm({ ...form, siteName: e.target.value })}
                />
              </div>
              <div className="col-span-2">
                <label className="label">건설사 (발주처) *</label>
                <input
                  className="input"
                  value={form.builderName}
                  onChange={(e) => setForm({ ...form, builderName: e.target.value })}
                />
              </div>
              <div>
                <label className="label">착공일</label>
                <input
                  type="date"
                  className="input"
                  value={form.startDate}
                  onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                />
              </div>
              <div>
                <label className="label">준공일</label>
                <input
                  type="date"
                  className="input"
                  value={form.endDate}
                  onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                />
              </div>
              <div>
                <label className="label">도급액 (원)</label>
                <input
                  type="number"
                  className="input"
                  value={form.contractAmount}
                  onChange={(e) => setForm({ ...form, contractAmount: e.target.value })}
                />
              </div>
              <div>
                <label className="label">자사 담당자</label>
                <input
                  className="input"
                  value={form.manager}
                  onChange={(e) => setForm({ ...form, manager: e.target.value })}
                />
              </div>
              <div className="col-span-2">
                <label className="label">
                  하자보수기간 (품질보증기간) — 준공일 기준 자동 {WARRANTY_YEARS}년
                </label>
                <div className="input bg-slate-50 text-slate-600 flex items-center">
                  {form.endDate ? (
                    <>
                      준공 후 {WARRANTY_YEARS}년 ·{" "}
                      <b className="ml-1 text-slate-800">
                        ~ {warrantyEndYmd(form.endDate)}
                      </b>
                    </>
                  ) : (
                    <span className="text-slate-400">준공일을 입력하면 자동 계산됩니다.</span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button className="btn-ghost" onClick={() => setShowForm(false)}>
                취소
              </button>
              <button className="btn-primary" onClick={submit}>
                저장
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
