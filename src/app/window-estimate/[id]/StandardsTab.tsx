"use client";

import { useState } from "react";
import { Plus, Trash2, Save, Wand2, Layers, Ruler, Package } from "lucide-react";
import { won } from "@/lib/format";
import type { Project, WindowTypeT, WindowComponentT } from "./page";

const SUB = [
  { key: "창호", label: "창호 기준값", icon: Ruler },
  { key: "SSD", label: "SSD 기준값", icon: Package },
] as const;

export default function StandardsTab({
  project,
  reload,
}: {
  project: Project;
  reload: () => void;
}) {
  const [sub, setSub] = useState<(typeof SUB)[number]["key"]>("창호");
  const [newType, setNewType] = useState("");
  const [busy, setBusy] = useState(false);

  const isSSD = sub === "SSD";
  const types = project.windowTypes.filter((t) => (t.category || "창호") === sub);

  const seedDefaults = async () => {
    setBusy(true);
    await fetch(`/api/estimate-projects/${project.id}/seed-defaults`, { method: "POST" });
    setBusy(false);
    reload();
  };

  const addType = async () => {
    if (!newType.trim()) return;
    await fetch("/api/window-types", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId: project.id, name: newType, category: sub }),
    });
    setNewType("");
    reload();
  };

  const removeType = async (id: number) => {
    if (!confirm("이 유형과 부재를 삭제하시겠습니까?")) return;
    await fetch(`/api/window-types/${id}`, { method: "DELETE" });
    reload();
  };

  return (
    <div className="space-y-4">
      {/* 하위 페이지 (창호 / SSD) */}
      <div className="flex gap-1">
        {SUB.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setSub(key)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold border transition-colors ${
              sub === key
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
            <span className={`text-xs ${sub === key ? "text-blue-100" : "text-slate-400"}`}>
              {project.windowTypes.filter((t) => (t.category || "창호") === key).length}
            </span>
          </button>
        ))}
      </div>

      {/* 유형 추가 */}
      <div className="card p-4 flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[220px]">
          <label className="label">{isSSD ? "SSD 유형 추가" : "창호유형 추가"}</label>
          <div className="flex gap-2">
            <input
              className="input"
              placeholder={isSSD ? "예: SSD (스틸도어)" : "예: T5 미서기창"}
              value={newType}
              onChange={(e) => setNewType(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addType()}
            />
            <button className="btn-primary shrink-0" onClick={addType}>
              <Plus className="w-4 h-4" /> 추가
            </button>
          </div>
        </div>
        <button className="btn-ghost" onClick={seedDefaults} disabled={busy}>
          <Wand2 className="w-4 h-4" /> 기본 기준값 채우기
        </button>
      </div>

      {isSSD && (
        <p className="text-sm text-slate-500 px-1">
          SSD 기준값은 <b>투입갯수(EA)</b> 또는 <b>중량(MT)</b> 단위로 입력합니다. 라인 검토에서 품명에{" "}
          <b>SSD</b>가 포함되면 이 유형이 자동 연계됩니다.
        </p>
      )}

      {types.length === 0 && (
        <div className="card p-8 text-center text-slate-400">
          <Layers className="w-8 h-8 mx-auto mb-2 text-slate-300" />
          등록된 {isSSD ? "SSD" : "창호"} 유형이 없습니다. &lsquo;기본 기준값 채우기&rsquo;로 불러오거나 직접 추가하세요.
        </div>
      )}

      {types.map((t) => (
        <TypeCard key={t.id} type={t} isSSD={isSSD} onRemove={removeType} reload={reload} />
      ))}

      {/* 비용 파라미터 (창호·SSD 공통 유지) */}
      <CostParamCard project={project} reload={reload} />
    </div>
  );
}

function TypeCard({
  type,
  isSSD,
  onRemove,
  reload,
}: {
  type: WindowTypeT;
  isSSD: boolean;
  onRemove: (id: number) => void;
  reload: () => void;
}) {
  const [nc, setNc] = useState({
    name: "",
    groupName: "",
    unit: isSSD ? "EA" : "M",
    unitWeight: "",
    unitQty: "",
    defaultCountW: "",
    defaultCountH: "",
  });

  const addComp = async () => {
    if (!nc.name.trim()) return;
    await fetch("/api/window-components", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ windowTypeId: type.id, ...nc }),
    });
    setNc({ ...nc, name: "", groupName: "", unitWeight: "", unitQty: "", defaultCountW: "", defaultCountH: "" });
    reload();
  };

  return (
    <div className="card overflow-x-auto">
      <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
        <span className="font-bold text-sm text-slate-700">
          {type.name} <span className="text-slate-400 font-normal">(부재 {type.components.length})</span>
        </span>
        <button className="text-slate-300 hover:text-red-500" onClick={() => onRemove(type.id)}>
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
      <table className="w-full min-w-[760px]">
        <thead>
          <tr>
            {!isSSD && <th className="th w-24">묶음</th>}
            <th className="th">부재명</th>
            {isSSD ? (
              <>
                <th className="th w-24">단위</th>
                <th className="th text-right w-32">기준 투입량</th>
                <th className="th text-right w-32">단위중량(kg)</th>
              </>
            ) : (
              <>
                <th className="th text-right w-32">단위중량(kg/M)</th>
                <th className="th text-right w-24">기본 폭개수</th>
                <th className="th text-right w-24">기본 높이개수</th>
              </>
            )}
            <th className="th w-16"></th>
          </tr>
        </thead>
        <tbody>
          {type.components.map((c) => (
            <CompRow key={c.id} comp={c} isSSD={isSSD} reload={reload} />
          ))}
          {/* 추가 행 */}
          <tr className="bg-blue-50/40">
            {!isSSD && (
              <td className="td">
                <input className="input py-1" placeholder="AW/AG" value={nc.groupName} onChange={(e) => setNc({ ...nc, groupName: e.target.value })} />
              </td>
            )}
            <td className="td">
              <input className="input py-1" placeholder="부재명" value={nc.name} onChange={(e) => setNc({ ...nc, name: e.target.value })} onKeyDown={(e) => e.key === "Enter" && addComp()} />
            </td>
            {isSSD ? (
              <>
                <td className="td">
                  <select className="input py-1" value={nc.unit} onChange={(e) => setNc({ ...nc, unit: e.target.value })}>
                    <option value="EA">EA(갯수)</option>
                    <option value="MT">MT(중량)</option>
                  </select>
                </td>
                <td className="td">
                  <input type="number" step="0.01" className="input py-1 text-right" placeholder="0" value={nc.unitQty} onChange={(e) => setNc({ ...nc, unitQty: e.target.value })} />
                </td>
                <td className="td">
                  <input type="number" step="0.001" className="input py-1 text-right" placeholder="0" value={nc.unitWeight} onChange={(e) => setNc({ ...nc, unitWeight: e.target.value })} />
                </td>
              </>
            ) : (
              <>
                <td className="td">
                  <input type="number" step="0.001" className="input py-1 text-right" placeholder="0.000" value={nc.unitWeight} onChange={(e) => setNc({ ...nc, unitWeight: e.target.value })} />
                </td>
                <td className="td">
                  <input type="number" step="0.5" className="input py-1 text-right" placeholder="0" value={nc.defaultCountW} onChange={(e) => setNc({ ...nc, defaultCountW: e.target.value })} />
                </td>
                <td className="td">
                  <input type="number" step="0.5" className="input py-1 text-right" placeholder="0" value={nc.defaultCountH} onChange={(e) => setNc({ ...nc, defaultCountH: e.target.value })} />
                </td>
              </>
            )}
            <td className="td text-right">
              <button className="btn-primary py-1" onClick={addComp}>
                <Plus className="w-4 h-4" />
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function CompRow({
  comp,
  isSSD,
  reload,
}: {
  comp: WindowComponentT;
  isSSD: boolean;
  reload: () => void;
}) {
  const [f, setF] = useState({
    name: comp.name,
    groupName: comp.groupName ?? "",
    unit: comp.unit || (isSSD ? "EA" : "M"),
    unitWeight: String(comp.unitWeight),
    unitQty: String(comp.unitQty ?? 0),
    defaultCountW: String(comp.defaultCountW),
    defaultCountH: String(comp.defaultCountH),
  });
  const dirty =
    f.name !== comp.name ||
    f.groupName !== (comp.groupName ?? "") ||
    f.unit !== (comp.unit || "M") ||
    Number(f.unitWeight) !== comp.unitWeight ||
    Number(f.unitQty) !== (comp.unitQty ?? 0) ||
    Number(f.defaultCountW) !== comp.defaultCountW ||
    Number(f.defaultCountH) !== comp.defaultCountH;

  const save = async () => {
    await fetch(`/api/window-components/${comp.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(f),
    });
    reload();
  };
  const remove = async () => {
    await fetch(`/api/window-components/${comp.id}`, { method: "DELETE" });
    reload();
  };

  return (
    <tr className="hover:bg-slate-50 group">
      {!isSSD && (
        <td className="td">
          <input className="input py-1" placeholder="-" value={f.groupName} onChange={(e) => setF({ ...f, groupName: e.target.value })} />
        </td>
      )}
      <td className="td">
        <input className="input py-1" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
      </td>
      {isSSD ? (
        <>
          <td className="td">
            <select className="input py-1" value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })}>
              <option value="EA">EA(갯수)</option>
              <option value="MT">MT(중량)</option>
            </select>
          </td>
          <td className="td">
            <input type="number" step="0.01" className="input py-1 text-right" value={f.unitQty} onChange={(e) => setF({ ...f, unitQty: e.target.value })} />
          </td>
          <td className="td">
            <input type="number" step="0.001" className="input py-1 text-right" value={f.unitWeight} onChange={(e) => setF({ ...f, unitWeight: e.target.value })} />
          </td>
        </>
      ) : (
        <>
          <td className="td">
            <input type="number" step="0.001" className="input py-1 text-right" value={f.unitWeight} onChange={(e) => setF({ ...f, unitWeight: e.target.value })} />
          </td>
          <td className="td">
            <input type="number" step="0.5" className="input py-1 text-right" value={f.defaultCountW} onChange={(e) => setF({ ...f, defaultCountW: e.target.value })} />
          </td>
          <td className="td">
            <input type="number" step="0.5" className="input py-1 text-right" value={f.defaultCountH} onChange={(e) => setF({ ...f, defaultCountH: e.target.value })} />
          </td>
        </>
      )}
      <td className="td text-right whitespace-nowrap">
        {dirty && (
          <button className="text-blue-600 hover:text-blue-800 mr-2" onClick={save}>
            <Save className="w-4 h-4" />
          </button>
        )}
        <button className="text-slate-300 hover:text-red-500" onClick={remove}>
          <Trash2 className="w-4 h-4" />
        </button>
      </td>
    </tr>
  );
}

function CostParamCard({ project, reload }: { project: Project; reload: () => void }) {
  const cp = project.costParam;
  let initialBars: Record<string, number> = {};
  try {
    initialBars = cp?.barPrices ? JSON.parse(cp.barPrices) : {};
  } catch {
    initialBars = {};
  }
  const [bars, setBars] = useState<[string, string][]>(
    Object.entries(initialBars).map(([k, v]) => [k, String(v)])
  );
  const [wagePerKg, setWage] = useState(String(cp?.wagePerKg ?? 0));
  const [hingeCost, setHinge] = useState(String(cp?.hingeCost ?? 0));
  const [screenCost, setScreen] = useState(String(cp?.screenCost ?? 0));
  const [pjInstallCost, setPj] = useState(String(cp?.pjInstallCost ?? 0));
  const [msg, setMsg] = useState("");

  const save = async () => {
    const barPrices: Record<string, number> = {};
    for (const [k, v] of bars) if (k.trim()) barPrices[k.trim()] = Number(v) || 0;
    const r = await fetch(`/api/estimate-projects/${project.id}/cost-param`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ barPrices, wagePerKg, hingeCost, screenCost, pjInstallCost }),
    });
    if (r.ok) {
      setMsg("저장되었습니다.");
      setTimeout(() => setMsg(""), 2000);
      reload();
    }
  };

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-sm text-slate-700">
          비용 파라미터 <span className="text-xs font-normal text-slate-400">(창호·SSD 공통)</span>
        </h3>
        {msg && <span className="text-sm text-green-600">{msg}</span>}
      </div>

      <div className="mb-3">
        <label className="label">바 종류별 kg당 자재비</label>
        <div className="space-y-2">
          {bars.map(([k, v], i) => (
            <div key={i} className="flex gap-2">
              <input className="input flex-1" placeholder="바 종류 (예: 단열바)" value={k} onChange={(e) => { const n = [...bars]; n[i] = [e.target.value, v]; setBars(n); }} />
              <input type="number" className="input w-40 text-right" placeholder="원/kg" value={v} onChange={(e) => { const n = [...bars]; n[i] = [k, e.target.value]; setBars(n); }} />
              <button className="btn-ghost shrink-0" onClick={() => setBars(bars.filter((_, idx) => idx !== i))}>
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
          <button className="btn-ghost" onClick={() => setBars([...bars, ["", ""]])}>
            <Plus className="w-4 h-4" /> 바 종류 추가
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div><label className="label">kg당 시공비</label><input type="number" className="input text-right" value={wagePerKg} onChange={(e) => setWage(e.target.value)} /></div>
        <div><label className="label">흰지비</label><input type="number" className="input text-right" value={hingeCost} onChange={(e) => setHinge(e.target.value)} /></div>
        <div><label className="label">롤방충망비</label><input type="number" className="input text-right" value={screenCost} onChange={(e) => setScreen(e.target.value)} /></div>
        <div><label className="label">PJ 시공비</label><input type="number" className="input text-right" value={pjInstallCost} onChange={(e) => setPj(e.target.value)} /></div>
      </div>
      <div className="flex justify-end mt-4">
        <button className="btn-primary" onClick={save}>
          <Save className="w-4 h-4" /> 비용 파라미터 저장
        </button>
      </div>
      <p className="text-xs text-slate-400 mt-2">
        현재 단열바 {won(Number(bars.find((b) => b[0] === "단열바")?.[1]) || 0)} · 일반바{" "}
        {won(Number(bars.find((b) => b[0] === "일반바")?.[1]) || 0)} 원/kg
      </p>
    </div>
  );
}
