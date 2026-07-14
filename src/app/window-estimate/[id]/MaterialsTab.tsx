"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { RefreshCw, ChevronRight, ChevronDown, RotateCcw, ImagePlus, Pencil, Trash2, X, ZoomIn } from "lucide-react";
import type { Project } from "./page";

type Comp = {
  id: number;
  compName: string;
  unitWeight: number;
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
  windowType: { name: string } | null;
  components: Comp[];
};

export default function MaterialsTab({ project }: { project: Project }) {
  const [lines, setLines] = useState<Line[]>([]);
  const [open, setOpen] = useState<Set<number>>(new Set());
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<string | null>(null); // 도면 확대 팝업

  const load = useCallback(async () => {
    const r = await fetch(`/api/estimate-lines?projectId=${project.id}&withComponents=1`, { cache: "no-store" });
    if (r.ok) {
      const all: Line[] = await r.json();
      setLines(all.filter((l) => l.windowTypeId)); // 창호유형 지정 라인만
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
          창호유형이 지정된 라인에 부재 물량을 자동 생성하고 총중량을 계산합니다. 부재 치수는 라인별로 수동 조정 가능합니다.
        </p>
        {msg && <span className="text-sm text-green-600 ml-auto">{msg}</span>}
      </div>

      <div className="flex justify-between text-sm">
        <span className="text-slate-500">자재산출 대상 <b>{lines.length}</b>라인</span>
        <span className="text-slate-500">전체 총중량 <b className="text-blue-700">{grandWeight.toFixed(2)}</b> kg</span>
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
              <tr><td className="td text-center text-slate-400 py-8" colSpan={6}>창호유형이 지정된 라인이 없습니다. &lsquo;라인 검토&rsquo;에서 유형을 지정한 뒤 자재 산출을 실행하세요.</td></tr>
            )}
            {lines.map((l) => (
              <FragmentRow key={l.id} line={l} isOpen={open.has(l.id)} onToggle={() => toggle(l.id)} onRegen={() => regenerate(l.id)} reload={load} onPreview={setPreview} />
            ))}
          </tbody>
        </table>
      </div>

      {/* 도면 확대 팝업 */}
      {preview && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-6"
          onClick={() => setPreview(null)}
        >
          <button
            className="absolute top-4 right-4 text-white/80 hover:text-white"
            onClick={() => setPreview(null)}
          >
            <X className="w-7 h-7" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview}
            alt="도면 확대"
            className="max-w-full max-h-full object-contain rounded shadow-2xl bg-white"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}

function FragmentRow({
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

  return (
    <>
      <tr className="hover:bg-slate-50 cursor-pointer" onClick={onToggle}>
        <td className="td text-slate-400">{isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}</td>
        <td className="td font-medium">
          {line.itemName}
          {line.drawingUrl && <ImagePlus className="w-3.5 h-3.5 text-blue-500 inline ml-1.5 align-text-bottom" />}
        </td>
        <td className="td text-slate-600">{line.windowType?.name}</td>
        <td className="td text-right">{line.quantity.toLocaleString()}</td>
        <td className="td text-right font-semibold text-blue-700">{line.totalWeight != null ? line.totalWeight.toFixed(3) : <span className="text-slate-300">미산출</span>}</td>
        <td className="td text-right" onClick={(e) => e.stopPropagation()}>
          <button className="btn-ghost py-1 text-xs" onClick={onRegen} title="창호유형 기본값으로 부재 재생성"><RotateCcw className="w-3.5 h-3.5" /> 재생성</button>
        </td>
      </tr>
      {isOpen && (
        <tr>
          <td className="bg-slate-50/60 p-3" colSpan={6}>
            <div className="flex flex-col md:flex-row gap-4">
              {/* 도면 패널 */}
              <div className="w-full md:w-44 shrink-0">
                <div className="text-xs font-bold text-slate-600 mb-1.5">도면</div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
                />
                {line.drawingUrl ? (
                  <div className="relative group border border-slate-200 rounded-lg overflow-hidden bg-white">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={line.drawingUrl}
                      alt="도면"
                      className="w-full h-32 object-contain cursor-zoom-in"
                      onClick={() => onPreview(line.drawingUrl!)}
                    />
                    <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        className="bg-white/90 rounded p-1 text-slate-500 hover:text-blue-600 shadow"
                        title="확대"
                        onClick={() => onPreview(line.drawingUrl!)}
                      >
                        <ZoomIn className="w-3.5 h-3.5" />
                      </button>
                      <button
                        className="bg-white/90 rounded p-1 text-slate-500 hover:text-blue-600 shadow"
                        title="도면 교체"
                        onClick={() => fileRef.current?.click()}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        className="bg-white/90 rounded p-1 text-slate-500 hover:text-red-500 shadow"
                        title="도면 삭제"
                        onClick={removeDrawing}
                      >
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
                  <table className="w-full min-w-[620px]">
                    <thead>
                      <tr>
                        <th className="th">부재</th>
                        <th className="th text-right w-24">W</th>
                        <th className="th text-right w-20">개수W</th>
                        <th className="th text-right w-24">H</th>
                        <th className="th text-right w-20">개수H</th>
                        <th className="th text-right w-28">단위중량</th>
                        <th className="th text-right w-24">길이(M)</th>
                        <th className="th text-right w-28">중량(kg)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {line.components.map((c) => (
                        <CompEditRow key={c.id} comp={c} reload={reload} />
                      ))}
                    </tbody>
                  </table>
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
  });
  const lengthM = (Number(f.widthMm) * Number(f.countW) + Number(f.heightMm) * Number(f.countH)) / 1000;
  const weightKg = lengthM * Number(f.unitWeight);
  const dirty =
    Number(f.widthMm) !== comp.widthMm || Number(f.countW) !== comp.countW ||
    Number(f.heightMm) !== comp.heightMm || Number(f.countH) !== comp.countH ||
    Number(f.unitWeight) !== comp.unitWeight;

  const save = async () => {
    if (!dirty) return;
    await fetch(`/api/line-components/${comp.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(f),
    });
    reload();
  };

  const inp = "input py-1 text-right";
  return (
    <tr>
      <td className="td text-slate-600">{comp.compName}</td>
      <td className="td"><input type="number" className={inp} value={f.widthMm} onChange={(e) => setF({ ...f, widthMm: e.target.value })} onBlur={save} /></td>
      <td className="td"><input type="number" className={inp} value={f.countW} onChange={(e) => setF({ ...f, countW: e.target.value })} onBlur={save} /></td>
      <td className="td"><input type="number" className={inp} value={f.heightMm} onChange={(e) => setF({ ...f, heightMm: e.target.value })} onBlur={save} /></td>
      <td className="td"><input type="number" className={inp} value={f.countH} onChange={(e) => setF({ ...f, countH: e.target.value })} onBlur={save} /></td>
      <td className="td"><input type="number" step="0.001" className={inp} value={f.unitWeight} onChange={(e) => setF({ ...f, unitWeight: e.target.value })} onBlur={save} /></td>
      <td className="td text-right text-slate-500">{lengthM.toFixed(3)}</td>
      <td className="td text-right font-semibold">{weightKg.toFixed(4)}</td>
    </tr>
  );
}
