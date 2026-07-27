"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { UserPlus, Trash2, Save, ImagePlus, Users2 } from "lucide-react";
import { won, ymd } from "@/lib/format";
import type { Contract, Worker } from "./LaborClient";

type Assignment = {
  id: number;
  workerId: number;
  actualWage: number;
  teamName: string | null;
  worker: Worker;
};
type Log = {
  id: number;
  date: string;
  category: string;
  imageUrl: string;
  note: string | null;
};

const today = new Date().toISOString().slice(0, 10);

const LOG_CATEGORIES = [
  { key: "근무일지", required: true },
  { key: "작업사진", required: false },
  { key: "기타", required: false },
] as const;

export default function AssignTab({
  contracts,
  workers,
  teams,
  preSite,
  preDate,
}: {
  contracts: Contract[];
  workers: Worker[];
  teams: string[];
  preSite: string | null;
  preDate?: string | null;
}) {
  const [siteId, setSiteId] = useState<string>(preSite || "");
  const [date, setDate] = useState(preDate || today);
  const [rows, setRows] = useState<Assignment[]>([]);
  const [team, setTeam] = useState("");
  const [workerId, setWorkerId] = useState("");
  const [msg, setMsg] = useState("");
  const [logs, setLogs] = useState<Log[]>([]);
  const [note, setNote] = useState("");
  const [category, setCategory] = useState<string>("근무일지");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!siteId && contracts.length && !preSite) setSiteId(String(contracts[0].id));
  }, [contracts, siteId, preSite]);

  // 투입 캘린더에서 이동해 온 경우 현장·날짜 반영
  useEffect(() => {
    if (preSite) setSiteId(preSite);
  }, [preSite]);
  useEffect(() => {
    if (preDate) setDate(preDate);
  }, [preDate]);

  const loadRows = useCallback(async () => {
    if (!siteId || !date) return;
    const r = await fetch(`/api/assignments?contractId=${siteId}&date=${date}`, {
      cache: "no-store",
    });
    if (r.ok) setRows(await r.json());
  }, [siteId, date]);

  const loadLogs = useCallback(async () => {
    if (!siteId) return;
    const month = date.slice(0, 7);
    const r = await fetch(`/api/logs?contractId=${siteId}&month=${month}`, {
      cache: "no-store",
    });
    if (r.ok) setLogs(await r.json());
  }, [siteId, date]);

  useEffect(() => {
    loadRows();
    loadLogs();
  }, [loadRows, loadLogs]);

  const flash = (m: string) => {
    setMsg(m);
    setTimeout(() => setMsg(""), 2500);
  };

  const assignTeam = async () => {
    if (!team) return flash("투입할 팀을 선택하세요.");
    const res = await fetch("/api/assignments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contractId: Number(siteId), date, teamName: team }),
    });
    const d = await res.json();
    flash(res.ok ? `✅ ${team} ${d.added}명 투입 완료` : d.error);
    loadRows();
  };

  const addWorker = async () => {
    if (!workerId) return;
    const res = await fetch("/api/assignments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contractId: Number(siteId), date, workerId: Number(workerId) }),
    });
    const d = await res.json();
    if (!res.ok) flash(d.error);
    setWorkerId("");
    loadRows();
  };

  const saveWage = async (id: number, actualWage: number) => {
    await fetch(`/api/assignments/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actualWage }),
    });
    loadRows();
  };

  const removeRow = async (id: number) => {
    await fetch(`/api/assignments/${id}`, { method: "DELETE" });
    loadRows();
  };

  const uploadLog = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) return flash("사진을 선택하세요.");
    const fd = new FormData();
    fd.append("file", file);
    fd.append("contractId", siteId);
    fd.append("date", date);
    fd.append("note", note);
    fd.append("category", category);
    const res = await fetch("/api/logs", { method: "POST", body: fd });
    if (res.ok) {
      flash(`✅ ${category} 업로드 완료`);
      setNote("");
      if (fileRef.current) fileRef.current.value = "";
      loadLogs();
    } else {
      flash((await res.json()).error);
    }
  };

  const removeLog = async (id: number) => {
    await fetch(`/api/logs/${id}`, { method: "DELETE" });
    loadLogs();
  };

  const dayTotal = rows.reduce((s, r) => s + r.actualWage, 0);

  if (contracts.length === 0) {
    return (
      <div className="card p-8 text-center text-slate-400">
        먼저 <b>수주관리</b>에서 현장을 등록하세요.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 현장/날짜 선택 */}
      <div className="card p-4 flex flex-wrap items-end gap-3">
        <div className="min-w-[240px] flex-1">
          <label className="label">현장 선택</label>
          <select className="input" value={siteId} onChange={(e) => setSiteId(e.target.value)}>
            {contracts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.siteName} ({c.builderName})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">날짜</label>
          <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        {msg && <div className="text-sm font-semibold text-blue-700 ml-auto">{msg}</div>}
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* 투입 리스트 */}
        <div className="lg:col-span-2 space-y-3">
          {/* 투입 컨트롤 */}
          <div className="card p-4 space-y-3">
            <div className="flex flex-wrap items-end gap-2">
              <div className="flex-1 min-w-[160px]">
                <label className="label">팀 단위 투입</label>
                <select className="input" value={team} onChange={(e) => setTeam(e.target.value)}>
                  <option value="">팀 선택</option>
                  {teams.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <button className="btn-primary" onClick={assignTeam}>
                <Users2 className="w-4 h-4" /> 팀 투입
              </button>
            </div>
            <div className="flex flex-wrap items-end gap-2 border-t border-slate-100 pt-3">
              <div className="flex-1 min-w-[160px]">
                <label className="label">개별 인원 추가</label>
                <select className="input" value={workerId} onChange={(e) => setWorkerId(e.target.value)}>
                  <option value="">인원 선택</option>
                  {workers.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.teamName} · {w.name} ({won(w.dailyWage)}원)
                    </option>
                  ))}
                </select>
              </div>
              <button className="btn-ghost" onClick={addWorker}>
                <UserPlus className="w-4 h-4" /> 추가
              </button>
            </div>
          </div>

          {/* 당일 투입 인원 */}
          <div className="card overflow-hidden">
            <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <span className="font-bold text-sm text-slate-700">
                {ymd(date)} 투입 인원 <span className="text-slate-400">({rows.length}명)</span>
              </span>
              <span className="text-sm text-slate-500">
                당일 인건비 합계 <b className="text-blue-700">{won(dayTotal)}</b>원
              </span>
            </div>
            <table className="w-full">
              <thead>
                <tr>
                  <th className="th">팀</th>
                  <th className="th">이름</th>
                  <th className="th text-right">당일 확정 단가</th>
                  <th className="th w-20"></th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr>
                    <td className="td text-center text-slate-400 py-6" colSpan={4}>
                      투입된 인원이 없습니다. 팀 또는 개별 인원을 투입하세요.
                    </td>
                  </tr>
                )}
                {rows.map((r) => (
                  <WageRow key={r.id} row={r} onSave={saveWage} onRemove={removeRow} />
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 근무일지 / 작업사진 / 기타 */}
        <div className="space-y-3">
          <div className="card p-4">
            <div className="flex items-center gap-2 mb-3 text-slate-700 font-semibold text-sm">
              <ImagePlus className="w-4 h-4 text-blue-600" /> 현장 사진 등록
            </div>

            {/* 카테고리 선택 */}
            <label className="label">사진 종류</label>
            <div className="flex gap-1 mb-2">
              {LOG_CATEGORIES.map((c) => (
                <button
                  key={c.key}
                  onClick={() => setCategory(c.key)}
                  className={`flex-1 px-2 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                    category === c.key
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  {c.key}
                  <span className={category === c.key ? "text-blue-100" : c.required ? "text-red-500" : "text-slate-400"}>
                    {c.required ? " *" : ""}
                  </span>
                </button>
              ))}
            </div>

            <p className="text-xs text-slate-400 mb-2">
              {ymd(date)} · <b className="text-slate-500">{category}</b>
              {category === "근무일지" ? " (필수)" : " (선택)"} 로 저장됩니다.
            </p>

            {/* 근무일지 미등록 경고 */}
            {!logs.some((l) => l.category === "근무일지" && ymd(l.date) === date) && (
              <p className="text-[11px] text-red-500 bg-red-50 rounded px-2 py-1 mb-2">
                ⚠ {ymd(date)} 근무일지(필수)가 아직 등록되지 않았습니다.
              </p>
            )}

            <input ref={fileRef} type="file" accept="image/*" className="input py-1.5 mb-2" />
            <input
              className="input mb-2"
              placeholder="특이사항 메모(옵션)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <button className="btn-primary w-full" onClick={uploadLog}>
              <ImagePlus className="w-4 h-4" /> {category} 업로드
            </button>
          </div>

          <div className="card p-3">
            <div className="text-xs font-semibold text-slate-500 mb-2">
              {date.slice(0, 7)} 현장 사진 ({logs.length})
            </div>
            <div className="max-h-[420px] overflow-y-auto space-y-3">
              {logs.length === 0 && (
                <p className="text-center text-slate-400 text-sm py-4">등록된 사진이 없습니다.</p>
              )}
              {LOG_CATEGORIES.map((c) => {
                const items = logs.filter((l) => (l.category || "근무일지") === c.key);
                if (items.length === 0) return null;
                return (
                  <div key={c.key}>
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <span
                        className={`text-[11px] font-bold px-1.5 py-0.5 rounded ${
                          c.key === "근무일지"
                            ? "bg-blue-100 text-blue-700"
                            : c.key === "작업사진"
                            ? "bg-green-100 text-green-700"
                            : "bg-slate-200 text-slate-600"
                        }`}
                      >
                        {c.key}
                        {c.required ? " *" : ""}
                      </span>
                      <span className="text-[11px] text-slate-400">{items.length}장</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {items.map((l) => (
                        <div key={l.id} className="relative group border border-slate-200 rounded-lg overflow-hidden">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={l.imageUrl} alt={c.key} className="w-full h-24 object-cover" />
                          <div className="px-1.5 py-1 text-[10px] text-slate-500 bg-white">
                            {ymd(l.date)}
                            {l.note && <span className="block truncate text-slate-400">{l.note}</span>}
                          </div>
                          <button
                            onClick={() => removeLog(l.id)}
                            className="absolute top-1 right-1 bg-white/90 rounded p-1 opacity-0 group-hover:opacity-100 text-red-500"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function WageRow({
  row,
  onSave,
  onRemove,
}: {
  row: Assignment;
  onSave: (id: number, wage: number) => void;
  onRemove: (id: number) => void;
}) {
  const [wage, setWage] = useState(String(row.actualWage));
  const dirty = Number(wage) !== row.actualWage;
  return (
    <tr className="hover:bg-slate-50 group">
      <td className="td text-slate-500">{row.teamName || row.worker.teamName}</td>
      <td className="td font-semibold">{row.worker.name}</td>
      <td className="td text-right">
        <input
          type="number"
          className="input py-1 text-right w-32 inline-block"
          value={wage}
          onChange={(e) => setWage(e.target.value)}
        />
      </td>
      <td className="td text-right whitespace-nowrap">
        {dirty && (
          <button
            className="text-blue-600 hover:text-blue-800 mr-2"
            onClick={() => onSave(row.id, Number(wage))}
            title="단가 저장"
          >
            <Save className="w-4 h-4" />
          </button>
        )}
        <button className="text-slate-300 hover:text-red-500" onClick={() => onRemove(row.id)} title="배제">
          <Trash2 className="w-4 h-4" />
        </button>
      </td>
    </tr>
  );
}
