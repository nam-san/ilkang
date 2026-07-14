"use client";

import { useState } from "react";
import { Plus, Trash2, Save } from "lucide-react";
import { won } from "@/lib/format";
import type { Worker } from "./LaborClient";

export default function TeamTab({
  workers,
  teams,
  reload,
}: {
  workers: Worker[];
  teams: string[];
  reload: () => void;
}) {
  const [name, setName] = useState("");
  const [teamName, setTeamName] = useState("");
  const [dailyWage, setDailyWage] = useState("");
  const [err, setErr] = useState("");

  const add = async () => {
    setErr("");
    const res = await fetch("/api/workers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, teamName, dailyWage }),
    });
    if (!res.ok) {
      setErr((await res.json()).error || "저장 실패");
      return;
    }
    setName("");
    setDailyWage("");
    reload();
  };

  const update = async (w: Worker, patch: Partial<Worker>) => {
    await fetch(`/api/workers/${w.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...w, ...patch }),
    });
    reload();
  };

  const remove = async (id: number) => {
    if (!confirm("이 팀원을 삭제하시겠습니까?")) return;
    await fetch(`/api/workers/${id}`, { method: "DELETE" });
    reload();
  };

  const byTeam = teams.map((t) => ({
    team: t,
    members: workers.filter((w) => w.teamName === t),
  }));

  return (
    <div className="space-y-4">
      {/* 등록 */}
      <div className="card p-4">
        <div className="flex items-center gap-2 mb-3 text-slate-700 font-semibold">
          <Plus className="w-4 h-4 text-blue-600" /> 팀원 등록 (팀 지정 + 기본 인건비 단가)
        </div>
        {err && <p className="text-sm text-red-600 mb-2">{err}</p>}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 items-end">
          <div>
            <label className="label">이름 *</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="label">팀명 * (예: 시공1팀, 양중팀)</label>
            <input
              className="input"
              list="teamlist"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
            />
            <datalist id="teamlist">
              {teams.map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
          </div>
          <div>
            <label className="label">일당 (기본 인건비)</label>
            <input
              type="number"
              className="input"
              value={dailyWage}
              onChange={(e) => setDailyWage(e.target.value)}
            />
          </div>
          <button className="btn-primary" onClick={add}>
            <Plus className="w-4 h-4" /> 등록
          </button>
        </div>
      </div>

      {/* 팀별 목록 */}
      {byTeam.length === 0 && (
        <div className="card p-8 text-center text-slate-400">
          등록된 팀원이 없습니다. 위에서 팀원을 등록하세요.
        </div>
      )}
      {byTeam.map(({ team, members }) => (
        <div key={team} className="card overflow-hidden">
          <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 font-bold text-slate-700 text-sm">
            {team} <span className="text-slate-400 font-normal">({members.length}명)</span>
          </div>
          <table className="w-full">
            <thead>
              <tr>
                <th className="th">이름</th>
                <th className="th">팀명</th>
                <th className="th text-right">일당 (원)</th>
                <th className="th w-24"></th>
              </tr>
            </thead>
            <tbody>
              {members.map((w) => (
                <EditableRow key={w.id} w={w} onSave={update} onRemove={remove} />
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}

function EditableRow({
  w,
  onSave,
  onRemove,
}: {
  w: Worker;
  onSave: (w: Worker, patch: Partial<Worker>) => void;
  onRemove: (id: number) => void;
}) {
  const [name, setName] = useState(w.name);
  const [teamName, setTeamName] = useState(w.teamName);
  const [wage, setWage] = useState(String(w.dailyWage));
  const dirty = name !== w.name || teamName !== w.teamName || Number(wage) !== w.dailyWage;

  return (
    <tr className="hover:bg-slate-50 group">
      <td className="td">
        <input className="input py-1" value={name} onChange={(e) => setName(e.target.value)} />
      </td>
      <td className="td">
        <input className="input py-1" value={teamName} onChange={(e) => setTeamName(e.target.value)} />
      </td>
      <td className="td text-right">
        <input
          type="number"
          className="input py-1 text-right"
          value={wage}
          onChange={(e) => setWage(e.target.value)}
        />
        <span className="text-[11px] text-slate-400">{won(Number(wage))}원</span>
      </td>
      <td className="td text-right whitespace-nowrap">
        {dirty && (
          <button
            className="text-blue-600 hover:text-blue-800 mr-2"
            onClick={() => onSave(w, { name, teamName, dailyWage: Number(wage) })}
            title="저장"
          >
            <Save className="w-4 h-4" />
          </button>
        )}
        <button className="text-slate-300 hover:text-red-500" onClick={() => onRemove(w.id)} title="삭제">
          <Trash2 className="w-4 h-4" />
        </button>
      </td>
    </tr>
  );
}
