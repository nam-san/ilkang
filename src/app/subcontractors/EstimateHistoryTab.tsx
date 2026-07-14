"use client";

import { useEffect, useState, useCallback } from "react";
import { Search, Plus, Trash2, TrendingUp } from "lucide-react";
import { won, ymd } from "@/lib/format";
import CompanyInfoModal, { type Company } from "./CompanyInfoModal";

type Row = {
  id: number;
  date: string;
  companyName: string;
  itemName: string;
  quantity: number;
  unitPrice: number;
  note: string | null;
};

const today = new Date().toISOString().slice(0, 10);
const empty = {
  date: today,
  companyName: "",
  itemName: "",
  quantity: "",
  unitPrice: "",
  note: "",
};

export default function EstimateHistoryTab() {
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState("");
  const [form, setForm] = useState({ ...empty });
  const [err, setErr] = useState("");
  const [companies, setCompanies] = useState<Company[]>([]);
  // 업체명 클릭 시 정보 팝업
  const [popup, setPopup] = useState<{ name: string; company: Company | null } | null>(null);

  const load = useCallback(async (query: string) => {
    const p = query.trim() ? `?q=${encodeURIComponent(query.trim())}` : "";
    const res = await fetch(`/api/subcontractors${p}`, { cache: "no-store" });
    if (res.ok) setRows(await res.json());
  }, []);

  useEffect(() => {
    load("");
    // 등록된 업체 정보 (자동완성 + 업체명 클릭 팝업용)
    fetch("/api/companies", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : []))
      .then((cs: Company[]) => setCompanies(cs));
  }, [load]);

  const openCompany = (companyName: string) => {
    const match =
      companies.find((c) => c.name.trim() === companyName.trim()) ?? null;
    setPopup({ name: companyName, company: match });
  };

  const submit = async () => {
    setErr("");
    const res = await fetch("/api/subcontractors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (!res.ok) {
      setErr((await res.json()).error || "저장 실패");
      return;
    }
    setForm({ ...empty });
    load(q);
  };

  const remove = async (id: number) => {
    await fetch(`/api/subcontractors/${id}`, { method: "DELETE" });
    load(q);
  };

  return (
    <div className="space-y-4">
      {/* 입력 폼 */}
      <div className="card p-4">
        <div className="flex items-center gap-2 mb-3 text-slate-700 font-semibold">
          <Plus className="w-4 h-4 text-blue-600" /> 하도급 단가 등록
        </div>
        {err && <p className="text-sm text-red-600 mb-2">{err}</p>}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-2 items-end">
          <div>
            <label className="label">날짜 *</label>
            <input type="date" className="input" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </div>
          <div>
            <label className="label">업체명 *</label>
            <input
              className="input"
              list="company-names"
              value={form.companyName}
              onChange={(e) => setForm({ ...form, companyName: e.target.value })}
            />
            <datalist id="company-names">
              {companies.map((c) => (
                <option key={c.id} value={c.name} />
              ))}
            </datalist>
          </div>
          <div>
            <label className="label">품명 *</label>
            <input className="input" value={form.itemName} onChange={(e) => setForm({ ...form, itemName: e.target.value })} />
          </div>
          <div>
            <label className="label">수량</label>
            <input type="number" className="input" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
          </div>
          <div>
            <label className="label">단가</label>
            <input type="number" className="input" value={form.unitPrice} onChange={(e) => setForm({ ...form, unitPrice: e.target.value })} />
          </div>
          <button className="btn-primary" onClick={submit}>
            <Plus className="w-4 h-4" /> 등록
          </button>
        </div>
      </div>

      {/* 품명 검색 */}
      <div className="card p-4">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              className="input pl-9"
              placeholder="품명으로 과거 단가 이력 검색 (예: 시스템창호)"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && load(q)}
            />
          </div>
          <button className="btn-primary" onClick={() => load(q)}>
            <Search className="w-4 h-4" /> 검색
          </button>
          {q && (
            <button
              className="btn-ghost"
              onClick={() => {
                setQ("");
                load("");
              }}
            >
              전체
            </button>
          )}
        </div>
        {q && (
          <p className="text-sm text-slate-500 mt-2 flex items-center gap-1">
            <TrendingUp className="w-4 h-4 text-blue-500" />
            &lsquo;{q}&rsquo; 검색 결과 {rows.length}건 — 날짜순 단가 추이를 비교하세요.
          </p>
        )}
      </div>

      {/* 결과 테이블 */}
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[760px]">
          <thead>
            <tr>
              <th className="th">날짜</th>
              <th className="th">업체명</th>
              <th className="th">품명</th>
              <th className="th text-right">수량</th>
              <th className="th text-right">단가</th>
              <th className="th text-right">금액</th>
              <th className="th"></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td className="td text-center text-slate-400 py-8" colSpan={7}>
                  등록된 하도급 견적이 없습니다.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-slate-50 group">
                <td className="td">{ymd(r.date)}</td>
                <td className="td font-semibold">
                  <button
                    onClick={() => openCompany(r.companyName)}
                    className="text-blue-700 hover:underline"
                    title="업체 정보 보기"
                  >
                    {r.companyName}
                  </button>
                </td>
                <td className="td">{r.itemName}</td>
                <td className="td text-right">{r.quantity.toLocaleString()}</td>
                <td className="td text-right font-semibold text-blue-700">{won(r.unitPrice)}</td>
                <td className="td text-right">{won(r.quantity * r.unitPrice)}</td>
                <td className="td text-right">
                  <button
                    onClick={() => remove(r.id)}
                    className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {popup && (
        <CompanyInfoModal
          name={popup.name}
          company={popup.company}
          onClose={() => setPopup(null)}
        />
      )}
    </div>
  );
}
