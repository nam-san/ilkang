"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import {
  Plus, Minus, Trash2, Calculator, Download, Save, History,
  AlertTriangle, Grid3x3, Table2, Layers,
} from "lucide-react";
import { ymdhm } from "@/lib/format";
import {
  calcPlateCut, formatBin, toM2,
  type PlateDemand, type PlateCutResult, type Plate, type Bin,
} from "@/lib/plateCut";

type PlateRow = Plate & { id: number; active: boolean };
type CutRow = { key: string; width: string; height: string; qty: string; plateName: string };
type HistoryRow = {
  id: number;
  title: string | null;
  totalPlates: number;
  totalPieces: number;
  lossRate: number;
  demands: { width: number; height: number; qty: number }[];
  results: {
    plateUsage: { name: string; count: number }[];
    specs: { width: number; height: number; qty: number; placed: number }[];
  } | null;
  createdAt: string;
};

// 파스텔 도형 + 진한 텍스트
const COLORS = [
  { text: "#166534", fill: "#BBF7D0" },
  { text: "#1E40AF", fill: "#BFDBFE" },
  { text: "#92400E", fill: "#FDE68A" },
  { text: "#5B21B6", fill: "#DDD6FE" },
  { text: "#991B1B", fill: "#FECACA" },
  { text: "#155E75", fill: "#A5F3FC" },
  { text: "#9D174D", fill: "#FBCFE8" },
  { text: "#3F6212", fill: "#D9F99D" },
];

let seq = 0;
const newCut = (): CutRow => ({ key: `p${++seq}`, width: "", height: "", qty: "", plateName: "" });

export default function PlateCutTab() {
  const [plates, setPlates] = useState<PlateRow[]>([]);
  const [cuts, setCuts] = useState<CutRow[]>([newCut(), newCut(), newCut()]);
  const [result, setResult] = useState<PlateCutResult | null>(null);
  const [title, setTitle] = useState("");
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [msg, setMsg] = useState("");
  const [showPlates, setShowPlates] = useState(false);

  const loadPlates = useCallback(async () => {
    const r = await fetch("/api/plate-cut/plates", { cache: "no-store" });
    if (r.ok) setPlates(await r.json());
  }, []);
  const loadHistory = useCallback(async () => {
    const r = await fetch("/api/plate-cut/history", { cache: "no-store" });
    if (r.ok) setHistory(await r.json());
  }, []);
  useEffect(() => {
    loadPlates();
    loadHistory();
  }, [loadPlates, loadHistory]);

  const flash = (m: string) => {
    setMsg(m);
    setTimeout(() => setMsg(""), 3000);
  };

  const demands: PlateDemand[] = useMemo(
    () =>
      cuts
        .map((c) => ({
          width: Number(c.width) || 0,
          height: Number(c.height) || 0,
          qty: Math.floor(Number(c.qty) || 0),
          plateName: c.plateName || null,
        }))
        .filter((d) => d.width > 0 && d.height > 0 && d.qty > 0),
    [cuts]
  );

  const activePlates = useMemo(() => plates.filter((p) => p.active), [plates]);

  const setCut = (i: number, k: keyof CutRow, v: string) =>
    setCuts((p) => p.map((c, idx) => (idx === i ? { ...c, [k]: v } : c)));
  const addCut = () => setCuts((p) => [...p, newCut()]);
  const removeCut = () => setCuts((p) => (p.length <= 1 ? p : p.slice(0, -1)));
  const removeCutAt = (i: number) =>
    setCuts((p) => (p.length === 1 ? [newCut()] : p.filter((_, idx) => idx !== i)));

  const calculate = () => {
    if (activePlates.length === 0) return flash("원판 기준값을 먼저 등록하세요.");
    if (demands.length === 0) return flash("컷팅 규격(가로·세로·수량)을 입력하세요.");
    const r = calcPlateCut(activePlates, demands);
    setResult(r);
    if (r.invalid.length > 0) flash(`⚠ 원판에 배치할 수 없는 규격 ${r.invalid.length}건은 제외했습니다.`);
  };

  const clearAll = () => {
    setResult(null);
    setCuts([newCut(), newCut(), newCut()]);
    setTitle("");
  };

  const saveHistory = async () => {
    if (!result || result.bins.length === 0) return flash("먼저 계산하기를 실행하세요.");
    const r = await fetch("/api/plate-cut/history", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: title.trim() || null, demands }),
    });
    if (!r.ok) return flash((await r.json()).error || "저장 실패");
    flash("✅ 히스토리에 저장되었습니다.");
    loadHistory();
  };

  const exportExcel = async (payload: { demands: PlateDemand[]; title?: string }) => {
    const res = await fetch("/api/plate-cut/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) return flash("엑셀 생성 실패");
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "원판절단.xlsx";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const removeHistory = async (id: number) => {
    if (!confirm("이 히스토리를 삭제하시겠습니까?")) return;
    await fetch(`/api/plate-cut/history/${id}`, { method: "DELETE" });
    loadHistory();
  };
  const clearHistory = async () => {
    if (!confirm("계산 히스토리를 전체 삭제하시겠습니까?")) return;
    await fetch("/api/plate-cut/history", { method: "DELETE" });
    loadHistory();
  };

  return (
    <div className="grid lg:grid-cols-[minmax(0,1fr)_380px] gap-4 items-start">
      {/* ── 좌: 입력 + 결과 ── */}
      <div className="space-y-3">
        {/* 입력 */}
        <div className="card p-4">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span className="text-slate-700 font-semibold text-sm flex items-center gap-1.5">
              <Grid3x3 className="w-4 h-4 text-blue-600" /> 원판 절단 계산기
            </span>
            <span className="text-xs text-slate-400">
              여러 규격을 한 판에 함께 배치해 전체 손실률 최소화 (필요 시 90° 눕혀서 배치)
            </span>
            <button className="btn-ghost py-1.5 ml-auto" onClick={() => setShowPlates((v) => !v)}>
              <Table2 className="w-4 h-4" /> 원판 기준값 {showPlates ? "닫기" : "보기"}
              <span className="text-xs text-slate-400 ml-1">({plates.length})</span>
            </button>
            <input
              className="input w-52"
              placeholder="메모 (예: 양주 판넬)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          {showPlates && <PlateMaster plates={plates} reload={loadPlates} />}

          {/* 컷팅 규격 */}
          <div className="border border-slate-200 rounded-lg overflow-x-auto">
            <table className="w-full min-w-[620px]">
              <thead>
                <tr>
                  <th className="th w-16">번호</th>
                  <th className="th">가로 (mm)</th>
                  <th className="th">세로 (mm)</th>
                  <th className="th w-28">수량 (개)</th>
                  <th className="th w-36">원판 지정 (옵션)</th>
                  <th className="th w-12"></th>
                </tr>
              </thead>
              <tbody>
                {cuts.map((c, i) => (
                  <tr key={c.key} className="hover:bg-slate-50">
                    <td className="td text-center text-slate-400">규격 {i + 1}</td>
                    <td className="td">
                      <input type="number" className="input py-1 text-right" placeholder="가로"
                        value={c.width} onChange={(e) => setCut(i, "width", e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && calculate()} />
                    </td>
                    <td className="td">
                      <input type="number" className="input py-1 text-right" placeholder="세로"
                        value={c.height} onChange={(e) => setCut(i, "height", e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && calculate()} />
                    </td>
                    <td className="td">
                      <input type="number" className="input py-1 text-right" placeholder="수량"
                        value={c.qty} onChange={(e) => setCut(i, "qty", e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && calculate()} />
                    </td>
                    <td className="td">
                      <select className="input py-1" value={c.plateName}
                        onChange={(e) => setCut(i, "plateName", e.target.value)}>
                        <option value="">자동(최적)</option>
                        {activePlates.map((p) => (
                          <option key={p.id} value={p.name}>{p.name}</option>
                        ))}
                      </select>
                    </td>
                    <td className="td text-right">
                      <button className="text-slate-300 hover:text-red-500" title="이 행 삭제"
                        onClick={() => removeCutAt(i)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap gap-2 mt-3">
            <button className="btn-ghost" onClick={addCut}>
              <Plus className="w-4 h-4" /> 추가
            </button>
            <button className="btn-ghost" onClick={removeCut}>
              <Minus className="w-4 h-4" /> 삭제
            </button>
            <button className="btn-primary ml-auto" onClick={calculate}>
              <Calculator className="w-4 h-4" /> 계산하기
            </button>
            <button className="btn-ghost" onClick={clearAll}>계산삭제</button>
          </div>
          {msg && <p className="text-sm mt-2 text-blue-700 font-semibold">{msg}</p>}
        </div>

        {/* 결과 */}
        {result && result.bins.length > 0 && (
          <div className="card p-4">
            <div className="flex flex-wrap items-center gap-2 pb-3 mb-3 border-b border-slate-100">
              <span className="font-bold text-slate-800">
                원판 {result.totalPlates}매 / 절단 {result.totalPieces}개 / 손실률 {result.lossRate}%
              </span>
              <div className="ml-auto flex gap-2">
                <button className="btn-ghost py-1.5" onClick={saveHistory}>
                  <Save className="w-4 h-4" /> 히스토리 저장
                </button>
                <button className="btn-primary py-1.5"
                  onClick={() => exportExcel({ demands, title: title.trim() })}>
                  <Download className="w-4 h-4" /> 엑셀 다운로드
                </button>
              </div>
            </div>

            {/* 원판 사용 요약 */}
            <div className="mb-4 border border-slate-200 rounded-lg overflow-hidden">
              <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-1">
                <span className="text-sm font-bold text-slate-700 flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-slate-400" /> 원판 사용 요약
                </span>
                <span className="text-xs text-slate-400">
                  투입 {toM2(result.totalPlateArea)}㎡ · 사용 {toM2(result.totalUsedArea)}㎡ · 손실{" "}
                  {toM2(result.totalPlateArea - result.totalUsedArea)}㎡
                </span>
              </div>
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="th">원판</th>
                    <th className="th">규격 (mm)</th>
                    <th className="th text-right w-28">사용 매수</th>
                  </tr>
                </thead>
                <tbody>
                  {result.plateUsage.map((u) => {
                    const p = activePlates.find((x) => x.name === u.name);
                    return (
                      <tr key={u.name} className="hover:bg-slate-50">
                        <td className="td font-semibold">{u.name}</td>
                        <td className="td text-slate-500">
                          {p ? `${p.width.toLocaleString()} × ${p.height.toLocaleString()}` : "-"}
                        </td>
                        <td className="td text-right font-bold text-blue-700">{u.count}매</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* 규격 범례 */}
            <div className="mb-4 border border-slate-200 rounded-lg overflow-hidden">
              <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 text-sm font-bold text-slate-700">
                컷팅 규격
              </div>
              <div className="p-3 flex flex-wrap gap-2">
                {result.specs.map((s) => {
                  const c = COLORS[s.specIndex % COLORS.length];
                  return (
                    <span
                      key={s.specIndex}
                      className="text-xs px-2 py-1 rounded border font-semibold flex items-center gap-1.5"
                      style={{ backgroundColor: c.fill, borderColor: c.text, color: c.text }}
                    >
                      규격 {s.specIndex + 1} · {s.width.toLocaleString()}×{s.height.toLocaleString()}
                      <b>{s.placed}개</b>
                      {s.placed !== s.qty && (
                        <span className="text-red-700">(요청 {s.qty}개)</span>
                      )}
                    </span>
                  );
                })}
              </div>
            </div>

            {/* 원판별 배치도 (한 판에 여러 규격 혼합) */}
            <p className="text-xs text-slate-400 mb-2">
              원판별 배치도 — 남는 자투리에 다른 규격을 함께 배치합니다.
              <b className="text-slate-500"> (회전)</b> 표기는 규격을 90° 눕혀서 잘라야 하는 조각입니다.
            </p>
            <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {result.bins.map((bin) => (
                <div key={bin.index} className="border border-slate-200 rounded-lg p-3">
                  <div className="flex items-baseline gap-1.5 text-sm mb-2">
                    <span className="font-bold text-slate-800">#{bin.index}</span>
                    <span className="font-semibold text-blue-700">{bin.plate.name}</span>
                    <span className="text-[11px] text-slate-400">
                      {bin.plate.width.toLocaleString()}×{bin.plate.height.toLocaleString()}
                    </span>
                    <span className="ml-auto text-[11px] text-slate-400">손실 {bin.lossRate}%</span>
                  </div>
                  <div className="flex gap-3">
                    <BinLayout bin={bin} />
                    <p className="text-[11px] text-slate-500 leading-relaxed flex-1 min-w-0 break-keep">
                      {formatBin(bin)}
                      <span className="block text-slate-400 mt-1">
                        총 {bin.placements.length}개 · {toM2(bin.usedArea)}㎡ 사용
                      </span>
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {result.invalid.length > 0 && (
              <p className="text-sm text-red-600 font-semibold mt-3 flex items-center gap-1">
                <AlertTriangle className="w-4 h-4" />
                원판에 배치 불가: {result.invalid.map((x) => `${x.width}×${x.height} × ${x.qty}개`).join(", ")}
              </p>
            )}
          </div>
        )}
      </div>

      {/* ── 우: 계산 히스토리 ── */}
      <aside className="card overflow-hidden lg:sticky lg:top-[104px]">
        <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <span className="font-bold text-sm text-slate-700 flex items-center gap-1.5">
            <History className="w-4 h-4 text-slate-400" /> 계산 히스토리
            <span className="text-slate-400 font-normal">({history.length})</span>
          </span>
          {history.length > 0 && (
            <button className="text-xs text-red-500 hover:underline" onClick={clearHistory}>
              전체삭제
            </button>
          )}
        </div>
        <div className="max-h-[70vh] overflow-y-auto divide-y divide-slate-100">
          {history.length === 0 && (
            <p className="p-6 text-center text-sm text-slate-400">저장된 계산이 없습니다.</p>
          )}
          {history.map((h) => (
            <div key={h.id} className="p-3 hover:bg-slate-50">
              <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                <span>{ymdhm(h.createdAt)}</span>
                <span className="flex gap-2">
                  <button className="text-blue-600 hover:underline"
                    onClick={() => exportExcel({ demands: h.demands, title: h.title || "" })}>
                    엑셀
                  </button>
                  <button className="text-red-500 hover:underline" onClick={() => removeHistory(h.id)}>
                    삭제
                  </button>
                </span>
              </div>
              {h.title && <p className="text-xs font-semibold text-slate-600 mb-0.5">{h.title}</p>}
              <p className="text-sm font-bold text-slate-800">
                원판 {h.totalPlates}매 / 절단 {h.totalPieces}개 / 손실률 {h.lossRate}%
              </p>
              {h.results && (
                <div className="text-xs text-slate-500 mt-1 space-y-0.5">
                  <div className="text-slate-600 font-semibold">
                    {h.results.plateUsage.map((u) => `${u.name} ${u.count}매`).join(" · ")}
                  </div>
                  {h.results.specs.map((d, i) => (
                    <div key={i}>
                      {d.width.toLocaleString()}×{d.height.toLocaleString()} × {d.placed}개
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}

/** 원판 1매 실제 배치도 (SVG · 좌표 기준, 여러 규격 혼합) */
function BinLayout({ bin }: { bin: Bin }) {
  const MAX_H = 210;
  const MAX_W = 120;
  const scale = Math.min(MAX_W / bin.plate.width, MAX_H / bin.plate.height);
  const W = bin.plate.width * scale;
  const H = bin.plate.height * scale;

  return (
    <svg
      width={W}
      height={H}
      className="shrink-0 border border-slate-300 rounded bg-slate-100"
      // 원판 좌표(mm)를 그대로 사용하고 표시 크기만 축소
      viewBox={`0 0 ${bin.plate.width} ${bin.plate.height}`}
    >
      {bin.placements.map((p, i) => {
        const c = COLORS[p.specIndex % COLORS.length];
        return (
          <rect
            key={i}
            x={p.x}
            y={p.y}
            width={p.w}
            height={p.h}
            fill={c.fill}
            stroke={c.text}
            strokeWidth={Math.max(4, 1 / scale)}
          >
            <title>
              규격 {p.specIndex + 1} ·{" "}
              {p.rotated
                ? `${p.h.toLocaleString()}×${p.w.toLocaleString()}mm (눕혀서 배치)`
                : `${p.w.toLocaleString()}×${p.h.toLocaleString()}mm`}
            </title>
          </rect>
        );
      })}
    </svg>
  );
}

/** 원판 기준값 관리 (추가·수정·삭제) */
function PlateMaster({ plates, reload }: { plates: PlateRow[]; reload: () => void }) {
  const [nw, setNw] = useState({ name: "", width: "", height: "" });
  const [err, setErr] = useState("");

  const add = async () => {
    setErr("");
    const r = await fetch("/api/plate-cut/plates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(nw),
    });
    if (!r.ok) {
      setErr((await r.json()).error || "추가 실패");
      setTimeout(() => setErr(""), 2500);
      return;
    }
    setNw({ name: "", width: "", height: "" });
    reload();
  };

  const remove = async (id: number, name: string) => {
    if (!confirm(`원판 '${name}'을(를) 삭제하시겠습니까?`)) return;
    await fetch(`/api/plate-cut/plates/${id}`, { method: "DELETE" });
    reload();
  };

  return (
    <div className="border border-slate-200 rounded-lg mb-3 overflow-hidden">
      <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 text-sm font-bold text-slate-700">
        원판 기준값 <span className="text-xs font-normal text-slate-400">(추가·수정 가능)</span>
      </div>
      {err && <p className="px-3 py-1.5 text-sm text-red-600">{err}</p>}
      <table className="w-full">
        <thead>
          <tr>
            <th className="th">원판명</th>
            <th className="th text-right w-32">가로 (mm)</th>
            <th className="th text-right w-32">세로 (mm)</th>
            <th className="th w-12"></th>
          </tr>
        </thead>
        <tbody>
          {plates.map((p) => (
            <PlateRowEdit key={p.id} plate={p} reload={reload} onRemove={remove} />
          ))}
          <tr className="bg-blue-50/40">
            <td className="td">
              <input className="input py-1" placeholder="새 원판명 (예: 5*10)" value={nw.name}
                onChange={(e) => setNw({ ...nw, name: e.target.value })}
                onKeyDown={(e) => e.key === "Enter" && add()} />
            </td>
            <td className="td">
              <input type="number" className="input py-1 text-right" placeholder="가로" value={nw.width}
                onChange={(e) => setNw({ ...nw, width: e.target.value })} />
            </td>
            <td className="td">
              <input type="number" className="input py-1 text-right" placeholder="세로" value={nw.height}
                onChange={(e) => setNw({ ...nw, height: e.target.value })} />
            </td>
            <td className="td text-right">
              <button className="btn-primary py-1" onClick={add} title="원판 추가">
                <Plus className="w-4 h-4" />
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function PlateRowEdit({
  plate,
  reload,
  onRemove,
}: {
  plate: PlateRow;
  reload: () => void;
  onRemove: (id: number, name: string) => void;
}) {
  const [f, setF] = useState({
    name: plate.name,
    width: String(plate.width),
    height: String(plate.height),
  });
  const dirty =
    f.name !== plate.name || Number(f.width) !== plate.width || Number(f.height) !== plate.height;

  const save = async () => {
    if (!dirty) return;
    await fetch(`/api/plate-cut/plates/${plate.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(f),
    });
    reload();
  };

  return (
    <tr className="hover:bg-slate-50 group">
      <td className="td">
        <input className="input py-1" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} onBlur={save} />
      </td>
      <td className="td">
        <input type="number" className="input py-1 text-right" value={f.width}
          onChange={(e) => setF({ ...f, width: e.target.value })} onBlur={save} />
      </td>
      <td className="td">
        <input type="number" className="input py-1 text-right" value={f.height}
          onChange={(e) => setF({ ...f, height: e.target.value })} onBlur={save} />
      </td>
      <td className="td text-right">
        <button className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100"
          title="원판 삭제" onClick={() => onRemove(plate.id, plate.name)}>
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </td>
    </tr>
  );
}
