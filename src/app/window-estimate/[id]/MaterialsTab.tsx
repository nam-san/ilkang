"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  RefreshCw,
  ChevronRight,
  ChevronDown,
  RotateCcw,
  ImagePlus,
  Pencil,
  Trash2,
  X,
  ZoomIn,
  Plus,
} from "lucide-react";
import type { Project } from "./page";

type Comp = {
  id: number;
  compName: string;
  groupName: string | null;
  unit: string; // M | EA | MT
  unitWeight: number;
  qty: number;
  widthMm: number;
  countW: number;
  heightMm: number;
  countH: number;
  lengthM: number;
  weightKg: number;
};
type Line = {
  id: number;
  itemName: string;
  quantity: number;
  windowTypeId: number | null;
  totalWeight: number | null;
  drawingUrl: string | null;
  windowType: { name: string; category?: string } | null;
  components: Comp[];
};

export default function MaterialsTab({ project }: { project: Project }) {
  const [lines, setLines] = useState<Line[]>([]);
  const [open, setOpen] = useState<Set<number>>(new Set());
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await fetch(`/api/estimate-lines?projectId=${project.id}&withComponents=1`, { cache: "no-store" });
    if (r.ok) {
      const all: Line[] = await r.json();
      setLines(all.filter((l) => l.windowTypeId));
    }
  }, [project.id]);

  useEffect(() => {
    load();
  }, [load]);

  const runCalc = async () => {
    setBusy(true);
    const r = await fetch(`/api/estimate-projects/${project.id}/calc-materials`, { method: "POST" });
    const d = await r.json();
    setBusy(false);
    setMsg(`✅ ${d.calculated}개 라인 자재 산출 완료${d.noTypeLines ? ` · 창호유형 미지정 ${d.noTypeLines}건 제외` : ""}`);
    setTimeout(() => setMsg(""), 3500);
    load();
  };

  const regenerate = async (lineId: number) => {
    await fetch(`/api/estimate-lines/${lineId}/regenerate`, { method: "POST" });
    load();
  };

  const toggle = (id: number) => {
    const n = new Set(open);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    setOpen(n);
  };

  const grandWeight = lines.reduce((s, l) => s + (l.totalWeight ?? 0), 0);

  return (
    <div className="space-y-4">
      <div className="card p-4 flex flex-wrap items-center gap-3">
        <button className="btn-primary" onClick={runCalc} disabled={busy}>
          <RefreshCw className={`w-4 h-4 ${busy ? "animate-spin" : ""}`} /> 자재 산출 실행
        </button>
        <p className="text-sm text-slate-500">
          창호유형이 지정된 라인에 부재 물량을 자동 생성하고 총중량을 계산합니다. 부재는 라인별로 수정·추가할 수 있습니다.
        </p>
        {msg && <span className="text-sm text-green-600 ml-auto">{msg}</span>}
      </div>

      <div className="flex justify-between text-sm">
        <span className="text-slate-500">
          자재산출 대상 <b>{lines.length}</b>라인
        </span>
        <span className="text-slate-500">
          전체 총중량 <b className="text-blue-700">{grandWeight.toFixed(2)}</b> kg
        </span>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr>
              <th className="th w-8"></th>
              <th className="th">품명</th>
              <th className="th">창호유형</th>
              <th className="th text-right w-24">수량</th>
              <th className="th text-right w-32">총중량(kg)</th>
              <th className="th w-24"></th>
            </tr>
          </thead>
          <tbody>
            {lines.length === 0 && (
              <tr>
                <td className="td text-center text-slate-400 py-8" colSpan={6}>
                  창호유형이 지정된 라인이 없습니다. &lsquo;라인 검토&rsquo;에서 유형을 지정한 뒤 자재 산출을 실행하세요.
                </td>
              </tr>
            )}
            {lines.map((l) => (
              <LineRow
                key={l.id}
                line={l}
                isOpen={open.has(l.id)}
                onToggle={() => toggle(l.id)}
                onRegen={() => regenerate(l.id)}
                reload={load}
                onPreview={setPreview}
              />
            ))}
          </tbody>
        </table>
      </div>

      {preview && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-6" onClick={() => setPreview(null)}>
          <button className="absolute top-4 right-4 text-white/80 hover:text-white" onClick={() => setPreview(null)}>
            <X className="w-7 h-7" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="도면 확대" className="max-w-full max-h-full object-contain rounded shadow-2xl bg-white" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}

function LineRow({
  line,
  isOpen,
  onToggle,
  onRegen,
  reload,
  onPreview,
}: {
  line: Line;
  isOpen: boolean;
  onToggle: () => void;
  onRegen: () => void;
  reload: () => void;
  onPreview: (url: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [nc, setNc] = useState({ compName: "", groupName: "", unit: "M", unitWeight: "", qty: "", countW: "", countH: "" });

  const upload = async (file: File) => {
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    await fetch(`/api/estimate-lines/${line.id}/drawing`, { method: "POST", body: fd });
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
    reload();
  };

  const removeDrawing = async () => {
    if (!confirm("도면을 삭제하시겠습니까?")) return;
    await fetch(`/api/estimate-lines/${line.id}/drawing`, { method: "DELETE" });
    reload();
  };

  const addComponent = async () => {
    if (!nc.compName.trim()) return;
    await fetch("/api/line-components", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estimateLineId: line.id, ...nc }),
    });
    setNc({ compName: "", groupName: "", unit: "M", unitWeight: "", qty: "", countW: "", countH: "" });
    setAdding(false);
    reload();
  };

  // 부재를 묶음(AW/AG 등)별로 그룹핑
  const groups = new Map<string, Comp[]>();
  for (const c of line.components) {
    const g = c.groupName || "";
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g)!.push(c);
  }

  return (
    <>
      <tr className="hover:bg-slate-50 cursor-pointer" onClick={onToggle}>
        <td className="td text-slate-400">{isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}</td>
        <td className="td font-medium">
          {line.itemName}
          {line.drawingUrl && <ImagePlus className="w-3.5 h-3.5 text-blue-500 inline ml-1.5 align-text-bottom" />}
        </td>
        <td className="td text-slate-600">
          {line.windowType?.name}
          {groups.size > 1 && (
            <span className="ml-1.5 text-[10px] bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded">
              {[...groups.keys()].filter(Boolean).join("+")} 복합
            </span>
          )}
        </td>
        <td className="td text-right">{line.quantity.toLocaleString()}</td>
        <td className="td text-right font-semibold text-blue-700">
          {line.totalWeight != null ? line.totalWeight.toFixed(3) : <span className="text-slate-300">미산출</span>}
        </td>
        <td className="td text-right" onClick={(e) => e.stopPropagation()}>
          <button className="btn-ghost py-1 text-xs" onClick={onRegen} title="창호유형 기본값으로 부재 재생성">
            <RotateCcw className="w-3.5 h-3.5" /> 재생성
          </button>
        </td>
      </tr>

      {isOpen && (
        <tr>
          <td className="bg-slate-50/60 p-3" colSpan={6}>
            <div className="flex flex-col md:flex-row gap-4">
              {/* 도면 */}
              <div className="w-full md:w-44 shrink-0">
                <div className="text-xs font-bold text-slate-600 mb-1.5">도면</div>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
                {line.drawingUrl ? (
                  <div className="relative group border border-slate-200 rounded-lg overflow-hidden bg-white">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={line.drawingUrl} alt="도면" className="w-full h-32 object-contain cursor-zoom-in" onClick={() => onPreview(line.drawingUrl!)} />
                    <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button className="bg-white/90 rounded p-1 text-slate-500 hover:text-blue-600 shadow" title="확대" onClick={() => onPreview(line.drawingUrl!)}>
                        <ZoomIn className="w-3.5 h-3.5" />
                      </button>
                      <button className="bg-white/90 rounded p-1 text-slate-500 hover:text-blue-600 shadow" title="도면 교체" onClick={() => fileRef.current?.click()}>
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button className="bg-white/90 rounded p-1 text-slate-500 hover:text-red-500 shadow" title="도면 삭제" onClick={removeDrawing}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    className="w-full h-32 border-2 border-dashed border-slate-300 rounded-lg flex flex-col items-center justify-center gap-1 text-slate-400 hover:border-blue-400 hover:text-blue-500 transition-colors"
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                  >
                    <ImagePlus className="w-6 h-6" />
                    <span className="text-xs">{uploading ? "업로드중…" : "도면 추가"}</span>
                  </button>
                )}
              </div>

              {/* 부재 물량 */}
              <div className="flex-1 min-w-0 overflow-x-auto">
                {line.components.length === 0 ? (
                  <p className="text-sm text-slate-400 py-2">부재가 없습니다. &lsquo;자재 산출 실행&rsquo; 또는 &lsquo;재생성&rsquo;을 눌러 생성하세요.</p>
                ) : (
                  [...groups.entries()].map(([g, comps]) => (
                    <div key={g || "default"} className="mb-3">
                      {g && (
                        <div className="text-xs font-bold text-violet-700 bg-violet-50 inline-block px-2 py-0.5 rounded mb-1">
                          부재({g})
                        </div>
                      )}
                      <table className="w-full min-w-[680px]">
                        <thead>
                          <tr>
                            <th className="th">부재</th>
                            <th className="th w-20">단위</th>
                            <th className="th text-right w-24">W</th>
                            <th className="th text-right w-20">개수W</th>
                            <th className="th text-right w-24">H</th>
                            <th className="th text-right w-20">개수H</th>
                            <th className="th text-right w-28">단위중량</th>
                            <th className="th text-right w-24">길이(M)</th>
                            <th className="th text-right w-28">중량(kg)</th>
                            <th className="th w-10"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {comps.map((c) => (
                            <CompEditRow key={c.id} comp={c} reload={reload} />
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ))
                )}

                {/* 부재 수동 추가 */}
                {adding ? (
                  <div className="border border-blue-200 bg-blue-50/40 rounded-lg p-2 flex flex-wrap items-end gap-2">
                    <div className="w-40">
                      <span className="block text-[11px] text-slate-500">부재명 *</span>
                      <input className="input py-1" value={nc.compName} onChange={(e) => setNc({ ...nc, compName: e.target.value })} />
                    </div>
                    <div className="w-24">
                      <span className="block text-[11px] text-slate-500">묶음</span>
                      <input className="input py-1" placeholder="AW/AG" value={nc.groupName} onChange={(e) => setNc({ ...nc, groupName: e.target.value })} />
                    </div>
                    <div className="w-24">
                      <span className="block text-[11px] text-slate-500">단위</span>
                      <select className="input py-1" value={nc.unit} onChange={(e) => setNc({ ...nc, unit: e.target.value })}>
                        <option value="M">M(치수)</option>
                        <option value="EA">EA</option>
                        <option value="MT">MT</option>
                      </select>
                    </div>
                    {nc.unit === "M" ? (
                      <>
                        <div className="w-20">
                          <span className="block text-[11px] text-slate-500">개수W</span>
                          <input type="number" step="0.5" className="input py-1 text-right" value={nc.countW} onChange={(e) => setNc({ ...nc, countW: e.target.value })} />
                        </div>
                        <div className="w-20">
                          <span className="block text-[11px] text-slate-500">개수H</span>
                          <input type="number" step="0.5" className="input py-1 text-right" value={nc.countH} onChange={(e) => setNc({ ...nc, countH: e.target.value })} />
                        </div>
                      </>
                    ) : (
                      <div className="w-24">
                        <span className="block text-[11px] text-slate-500">수량</span>
                        <input type="number" step="0.5" className="input py-1 text-right" value={nc.qty} onChange={(e) => setNc({ ...nc, qty: e.target.value })} />
                      </div>
                    )}
                    <div className="w-28">
                      <span className="block text-[11px] text-slate-500">단위중량</span>
                      <input type="number" step="0.001" className="input py-1 text-right" value={nc.unitWeight} onChange={(e) => setNc({ ...nc, unitWeight: e.target.value })} />
                    </div>
                    <button className="btn-primary py-1" onClick={addComponent}>
                      <Plus className="w-4 h-4" /> 추가
                    </button>
                    <button className="btn-ghost py-1" onClick={() => setAdding(false)}>
                      취소
                    </button>
                  </div>
                ) : (
                  <button className="btn-ghost py-1 text-xs" onClick={() => setAdding(true)}>
                    <Plus className="w-3.5 h-3.5" /> 부재 추가 (옵션 항목)
                  </button>
                )}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function CompEditRow({ comp, reload }: { comp: Comp; reload: () => void }) {
  const [f, setF] = useState({
    widthMm: String(comp.widthMm),
    countW: String(comp.countW),
    heightMm: String(comp.heightMm),
    countH: String(comp.countH),
    unitWeight: String(comp.unitWeight),
    qty: String(comp.qty ?? 0),
  });
  const isDim = (comp.unit || "M") === "M";
  const lengthM = isDim
    ? (Number(f.widthMm) * Number(f.countW) + Number(f.heightMm) * Number(f.countH)) / 1000
    : 0;
  const weightKg = isDim ? lengthM * Number(f.unitWeight) : Number(f.qty) * Number(f.unitWeight);

  const save = async () => {
    await fetch(`/api/line-components/${comp.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...f, unit: comp.unit }),
    });
    reload();
  };
  const remove = async () => {
    if (!confirm(`'${comp.compName}' 부재를 삭제하시겠습니까?`)) return;
    await fetch(`/api/line-components/${comp.id}`, { method: "DELETE" });
    reload();
  };

  const inp = "input py-1 text-right";
  return (
    <tr>
      <td className="td text-slate-600">{comp.compName}</td>
      <td className="td text-xs text-slate-500">{comp.unit || "M"}</td>
      {isDim ? (
        <>
          {/* 규격은 50 단위, 개수는 0.5 단위로 증감 */}
          <td className="td"><input type="number" step="50" className={inp} value={f.widthMm} onChange={(e) => setF({ ...f, widthMm: e.target.value })} onBlur={save} /></td>
          <td className="td"><input type="number" step="0.5" className={inp} value={f.countW} onChange={(e) => setF({ ...f, countW: e.target.value })} onBlur={save} /></td>
          <td className="td"><input type="number" step="50" className={inp} value={f.heightMm} onChange={(e) => setF({ ...f, heightMm: e.target.value })} onBlur={save} /></td>
          <td className="td"><input type="number" step="0.5" className={inp} value={f.countH} onChange={(e) => setF({ ...f, countH: e.target.value })} onBlur={save} /></td>
        </>
      ) : (
        <>
          <td className="td text-center text-slate-300" colSpan={2}>
            <input type="number" step="0.5" className={inp} value={f.qty} onChange={(e) => setF({ ...f, qty: e.target.value })} onBlur={save} title="투입 수량" />
          </td>
          <td className="td text-center text-slate-300" colSpan={2}>
            수량 기준
          </td>
        </>
      )}
      <td className="td"><input type="number" step="0.001" className={inp} value={f.unitWeight} onChange={(e) => setF({ ...f, unitWeight: e.target.value })} onBlur={save} /></td>
      <td className="td text-right text-slate-500">{lengthM.toFixed(3)}</td>
      <td className="td text-right font-semibold">{weightKg.toFixed(4)}</td>
      <td className="td text-right">
        <button className="text-slate-300 hover:text-red-500" onClick={remove} title="부재 삭제">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </td>
    </tr>
  );
}
