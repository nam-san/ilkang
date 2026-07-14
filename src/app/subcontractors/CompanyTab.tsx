"use client";

import { useEffect, useState, useCallback } from "react";
import { Search, Plus, Trash2, Pencil, X, Building2, Phone, Mail } from "lucide-react";

type Company = {
  id: number;
  name: string;
  bizNumber: string | null;
  ceo: string | null;
  phone: string | null;
  email: string | null;
  category: string | null;
  address: string | null;
  note: string | null;
};

const empty: Omit<Company, "id"> = {
  name: "",
  bizNumber: "",
  ceo: "",
  phone: "",
  email: "",
  category: "",
  address: "",
  note: "",
};

export default function CompanyTab() {
  const [list, setList] = useState<Company[]>([]);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<Omit<Company, "id">>({ ...empty });
  const [err, setErr] = useState("");

  const load = useCallback(async (query: string) => {
    const p = query.trim() ? `?q=${encodeURIComponent(query.trim())}` : "";
    const res = await fetch(`/api/companies${p}`, { cache: "no-store" });
    if (res.ok) setList(await res.json());
  }, []);

  useEffect(() => {
    load("");
  }, [load]);

  const openNew = () => {
    setEditId(null);
    setForm({ ...empty });
    setErr("");
    setOpen(true);
  };

  const openEdit = (c: Company) => {
    setEditId(c.id);
    setForm({
      name: c.name,
      bizNumber: c.bizNumber ?? "",
      ceo: c.ceo ?? "",
      phone: c.phone ?? "",
      email: c.email ?? "",
      category: c.category ?? "",
      address: c.address ?? "",
      note: c.note ?? "",
    });
    setErr("");
    setOpen(true);
  };

  const submit = async () => {
    setErr("");
    const url = editId ? `/api/companies/${editId}` : "/api/companies";
    const res = await fetch(url, {
      method: editId ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (!res.ok) {
      setErr((await res.json()).error || "저장 실패");
      return;
    }
    setOpen(false);
    load(q);
  };

  const remove = async (id: number) => {
    if (!confirm("이 업체 정보를 삭제하시겠습니까?")) return;
    await fetch(`/api/companies/${id}`, { method: "DELETE" });
    load(q);
  };

  return (
    <div className="space-y-4">
      {/* 검색 + 등록 */}
      <div className="card p-4 flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="input pl-9"
            placeholder="업체명 · 전문분야 · 대표자로 검색"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load(q)}
          />
        </div>
        <button className="btn-primary" onClick={() => load(q)}>
          <Search className="w-4 h-4" /> 검색
        </button>
        {q && (
          <button className="btn-ghost" onClick={() => { setQ(""); load(""); }}>
            전체
          </button>
        )}
        <button className="btn-primary ml-auto" onClick={openNew}>
          <Plus className="w-4 h-4" /> 업체 등록
        </button>
      </div>

      {/* 목록 */}
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[880px]">
          <thead>
            <tr>
              <th className="th">업체명</th>
              <th className="th">전문분야</th>
              <th className="th">대표자</th>
              <th className="th">연락처</th>
              <th className="th">사업자번호</th>
              <th className="th">이메일</th>
              <th className="th w-20"></th>
            </tr>
          </thead>
          <tbody>
            {list.length === 0 && (
              <tr>
                <td className="td text-center text-slate-400 py-8" colSpan={7}>
                  <Building2 className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                  등록된 업체가 없습니다. &lsquo;업체 등록&rsquo;으로 추가하세요.
                </td>
              </tr>
            )}
            {list.map((c) => (
              <tr key={c.id} className="hover:bg-slate-50 group align-top">
                <td className="td font-semibold">
                  {c.name}
                  {c.address && (
                    <span className="block text-[11px] font-normal text-slate-400">{c.address}</span>
                  )}
                  {c.note && (
                    <span className="block text-[11px] font-normal text-slate-400">📝 {c.note}</span>
                  )}
                </td>
                <td className="td">
                  {c.category ? (
                    <span className="inline-block px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold">
                      {c.category}
                    </span>
                  ) : (
                    "-"
                  )}
                </td>
                <td className="td">{c.ceo || "-"}</td>
                <td className="td">
                  {c.phone ? (
                    <span className="inline-flex items-center gap-1">
                      <Phone className="w-3.5 h-3.5 text-slate-400" />
                      {c.phone}
                    </span>
                  ) : (
                    "-"
                  )}
                </td>
                <td className="td">{c.bizNumber || "-"}</td>
                <td className="td">
                  {c.email ? (
                    <span className="inline-flex items-center gap-1">
                      <Mail className="w-3.5 h-3.5 text-slate-400" />
                      {c.email}
                    </span>
                  ) : (
                    "-"
                  )}
                </td>
                <td className="td text-right whitespace-nowrap">
                  <button
                    onClick={() => openEdit(c)}
                    className="text-slate-400 hover:text-blue-600 mr-2"
                    title="수정"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => remove(c.id)}
                    className="text-slate-300 hover:text-red-500"
                    title="삭제"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-sm text-slate-400">총 {list.length}개 업체</p>

      {/* 등록/수정 모달 */}
      {open && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="card w-full max-w-lg p-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-lg">{editId ? "업체 정보 수정" : "업체 등록"}</h2>
              <button onClick={() => setOpen(false)}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            {err && <p className="text-sm text-red-600 mb-3">{err}</p>}
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="label">업체명 *</label>
                <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <label className="label">전문분야 (공종)</label>
                <input className="input" placeholder="예: 창호 / 유리 / 실링" value={form.category ?? ""} onChange={(e) => setForm({ ...form, category: e.target.value })} />
              </div>
              <div>
                <label className="label">대표자</label>
                <input className="input" value={form.ceo ?? ""} onChange={(e) => setForm({ ...form, ceo: e.target.value })} />
              </div>
              <div>
                <label className="label">연락처</label>
                <input className="input" placeholder="02-000-0000" value={form.phone ?? ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div>
                <label className="label">사업자등록번호</label>
                <input className="input" placeholder="000-00-00000" value={form.bizNumber ?? ""} onChange={(e) => setForm({ ...form, bizNumber: e.target.value })} />
              </div>
              <div className="col-span-2">
                <label className="label">이메일</label>
                <input className="input" value={form.email ?? ""} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div className="col-span-2">
                <label className="label">주소</label>
                <input className="input" value={form.address ?? ""} onChange={(e) => setForm({ ...form, address: e.target.value })} />
              </div>
              <div className="col-span-2">
                <label className="label">비고</label>
                <textarea className="input resize-none" rows={2} value={form.note ?? ""} onChange={(e) => setForm({ ...form, note: e.target.value })} />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button className="btn-ghost" onClick={() => setOpen(false)}>취소</button>
              <button className="btn-primary" onClick={submit}>저장</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
