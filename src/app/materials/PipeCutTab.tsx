"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import {
  Plus, Minus, Trash2, Calculator, Download, Save, History,
  AlertTriangle, Ruler, Layers,
} from "lucide-react";
import { ymdhm } from "@/lib/format";
import { calcPipeCut, formatBar, summarizePatterns, type Demand, type PipeCutResult } from "@/lib/pipeCut";

type CutRow = { key: string; length: string; qty: string };
type HistoryRow = {
  id: number;
  title: string | null;
  stockLength: number;
  kerf: number;
  totalBars: number;
  totalCuts: number;
  lossRate: number;
  demands: { length: number; qty: number }[];
  patterns: { index: number; groups: { length: number; qty: number }[]; remainder: number }[];
  createdAt: string;
};

// 본별 구분 색 — 텍스트는 진하게(가독성), 막대는 파스텔(눈 피로 완화)
const BAR_COLORS = [
  { text: "#166534", bar: "#BBF7D0" }, // green
  { text: "#1E40AF", bar: "#BFDBFE" }, // blue
  { text: "#92400E", bar: "#FDE68A" }, // amber
  { text: "#5B21B6", bar: "#DDD6FE" }, // violet
  { text: "#991B1B", bar: "#FECACA" }, // red
  { text: "#155E75", bar: "#A5F3FC" }, // cyan
  { text: "#9D174D", bar: "#FBCFE8" }, // pink
  { text: "#3F6212", bar: "#D9F99D" }, // lime
];

let seq = 0;
const newCut = (length = "", qty = ""): CutRow => ({ key: `c${++seq}`, length, qty });

export default function PipeCutTab() {
  const [stockLength, setStockLength] = useState("6000");
  const [kerf, setKerf] = useState("4");
  const [useKerf, setUseKerf] = useState(true);
  const [cuts, setCuts] = useState<CutRow[]>([newCut(), newCut(), newCut()]);
  const [result, setResult] = useState<PipeCutResult | null>(null);
  const [title, setTitle] = useState("");
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [msg, setMsg] = useState("");

  const loadHistory = useCallback(async () => {
    const r = await fetch("/api/pipe-cut/history", { cache: "no-store" });
    if (r.ok) setHistory(await r.json());
  }, []);
  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const flash = (m: string) => {
    setMsg(m);
    setTimeout(() => setMsg(""), 3000);
  };

  const demands: Demand[] = useMemo(
    () =>
      cuts
        .map((c) => ({ length: Number(c.length) || 0, qty: Math.floor(Number(c.qty) || 0) }))
        .filter((d) => d.length > 0 && d.qty > 0),
    [cuts]
  );

  // 같은 절단 조합끼리 묶은 요약
  const summary = useMemo(() => (result ? summarizePatterns(result.bars) : []), [result]);

  const setCut = (i: number, k: "length" | "qty", v: string) =>
    setCuts((p) => p.map((c, idx) => (idx === i ? { ...c, [k]: v } : c)));
  const addCut = () => setCuts((p) => [...p, newCut()]);
  const removeCut = () => setCuts((p) => (p.length <= 1 ? p : p.slice(0, -1)));
  const removeCutAt = (i: number) =>
    setCuts((p) => (p.length === 1 ? [newCut()] : p.filter((_, idx) => idx !== i)));

  const calculate = () => {
    const stock = Number(stockLength) || 0;
    if (stock <= 0) return flash("원자재(파이프) 길이를 입력하세요.");
    if (demands.length === 0) return flash("절단 규격과 수량을 입력하세요.");
    const r = calcPipeCut(stock, useKerf ? Number(kerf) || 0 : 0, demands);
    setResult(r);
    if (r.invalid.length > 0)
      flash(`⚠ 원자재보다 긴 규격 ${r.invalid.length}건은 제외했습니다.`);
  };

  const clearAll = () => {
    setResult(null);
    setCuts([newCut(), newCut(), newCut()]);
    setTitle("");
  };

  const saveHistory = async () => {
    if (!result || result.totalBars === 0) return flash("먼저 계산하기를 실행하세요.");
    const r = await fetch("/api/pipe-cut/history", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: title.trim() || null,
        stockLength: Number(stockLength),
        kerf: useKerf ? Number(kerf) || 0 : 0,
        demands,
      }),
    });
    if (!r.ok) return flash((await r.json()).error || "저장 실패");
    flash("✅ 히스토리에 저장되었습니다.");
    loadHistory();
  };

  /** 엑셀 다운로드 (현재 결과 또는 히스토리 항목) */
  const exportExcel = async (payload: {
    stockLength: number;
    kerf: number;
    demands: Demand[];
    title?: string;
  }) => {
    const res = await fetch("/api/pipe-cut/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) return flash("엑셀 생성 실패");
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `파이프절단_${payload.stockLength}mm.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const removeHistory = async (id: number) => {
    if (!confirm("이 히스토리를 삭제하시겠습니까?")) return;
    await fetch(`/api/pipe-cut/history/${id}`, { method: "DELETE" });
    loadHistory();
  };
  const clearHistory = async () => {
    if (!confirm("계산 히스토리를 전체 삭제하시겠습니까?")) return;
    await fetch("/api/pipe-cut/history", { method: "DELETE" });
    loadHistory();
  };

  return (
    <div className="grid lg:grid-cols-[minmax(0,1fr)_380px] gap-4 items-start">
      {/* ── 좌: 입력 + 결과 ── */}
      <div className="space-y-3">
        {/* 입력 */}
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-3 text-slate-700 font-semibold text-sm">
            <Ruler className="w-4 h-4 text-blue-600" /> 파이프 절단 계산기
            <span className="text-xs font-normal text-slate-400">
              정척에서 필요한 길이를 최소 본수로 절단 (날두께 손실 반영)
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
            <div>
              <label className="label">파이프 길이 (mm) *</label>
              <input type="number" className="input text-right" value={stockLength}
                onChange={(e) => setStockLength(e.target.value)} />
            </div>
            <div>
              <label className="label">날 두께 (mm)</label>
              <input type="number" className="input text-right" value={kerf} disabled={!useKerf}
                onChange={(e) => setKerf(e.target.value)} />
            </div>
            <label className="flex items-center gap-1.5 text-sm text-slate-600 pb-2">
              <input type="checkbox" checked={useKerf} onChange={(e) => setUseKerf(e.target.checked)} />
              날두께 적용
            </label>
            <div>
              <label className="label">메모 (옵션)</label>
              <input className="input" placeholder="예: 양주 캐노피용" value={title}
                onChange={(e) => setTitle(e.target.value)} />
            </div>
          </div>

          {/* 절단 목록 */}
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="th w-16">번호</th>
                  <th className="th">절단 길이 (mm)</th>
                  <th className="th w-40">수량 (개)</th>
                  <th className="th w-12"></th>
                </tr>
              </thead>
              <tbody>
                {cuts.map((c, i) => (
                  <tr key={c.key} className="hover:bg-slate-50">
                    <td className="td text-center text-slate-400">절단 {i + 1}</td>
                    <td className="td">
                      <input type="number" className="input py-1 text-right" placeholder="길이"
                        value={c.length} onChange={(e) => setCut(i, "length", e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && calculate()} />
                    </td>
                    <td className="td">
                      <input type="number" className="input py-1 text-right" placeholder="수량"
                        value={c.qty} onChange={(e) => setCut(i, "qty", e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && calculate()} />
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
            <button className="btn-ghost" onClick={clearAll}>
              계산삭제
            </button>
          </div>
          {msg && <p className="text-sm mt-2 text-blue-700 font-semibold">{msg}</p>}
        </div>

        {/* 결과 */}
        {result && result.totalBars > 0 && (
          <div className="card p-4">
            <div className="flex flex-wrap items-center gap-2 pb-3 mb-3 border-b border-slate-100">
              <span className="font-bold text-slate-800">
                파이프({Number(stockLength).toLocaleString()}) {result.totalBars}본 / 절단 {result.totalCuts}개 /
                날두께({useKerf ? kerf : 0}) / 손실률 {result.lossRate}%
              </span>
              <div className="ml-auto flex gap-2">
                <button className="btn-ghost py-1.5" onClick={saveHistory}>
                  <Save className="w-4 h-4" /> 히스토리 저장
                </button>
                <button
                  className="btn-primary py-1.5"
                  onClick={() =>
                    exportExcel({
                      stockLength: Number(stockLength),
                      kerf: useKerf ? Number(kerf) || 0 : 0,
                      demands,
                      title: title.trim(),
                    })
                  }
                >
                  <Download className="w-4 h-4" /> 엑셀 다운로드
                </button>
              </div>
            </div>

            {/* 절단 패턴 요약 (같은 조합끼리 묶음) */}
            {summary.length > 0 && (
              <div className="mb-4 border border-slate-200 rounded-lg overflow-hidden">
                <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                  <span className="text-sm font-bold text-slate-700 flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-slate-400" /> 절단 패턴 요약
                  </span>
                  <span className="text-xs text-slate-400">{summary.length}종 · 총 {result.totalBars}본</span>
                </div>
                <table className="w-full">
                  <thead>
                    <tr>
                      <th className="th">절단 규격</th>
                      <th className="th text-right w-24">본수</th>
                      <th className="th text-right w-28">본당 잔여</th>
                      <th className="th text-right w-28">잔여 합계</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.map((s, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="td font-semibold text-slate-800">{s.label}</td>
                        <td className="td text-right font-bold text-blue-700">{s.barCount}본</td>
                        <td className="td text-right text-slate-500">{s.remainder.toLocaleString()}mm</td>
                        <td className="td text-right text-slate-500">
                          {(s.remainder * s.barCount).toLocaleString()}mm
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* 본별 절단 조합 (막대 시각화) */}
            <div className="space-y-2">
              {result.bars.map((bar) => {
                const c = BAR_COLORS[(bar.index - 1) % BAR_COLORS.length];
                const stock = Number(stockLength) || 1;
                return (
                  <div key={bar.index}>
                    <div className="flex items-baseline gap-2 text-sm">
                      <span className="font-bold shrink-0" style={{ color: c.text }}>
                        파이프 {bar.index}
                      </span>
                      <span className="text-slate-700">{formatBar(bar)}</span>
                      <span className="text-slate-400 ml-auto shrink-0">
                        잔여 {bar.remainder.toLocaleString()}mm
                      </span>
                    </div>
                    {/* 사용/잔여 비율 막대 (파스텔) */}
                    <div className="flex h-2.5 rounded-full overflow-hidden bg-slate-100 mt-1">
                      {bar.groups.map((g, gi) => (
                        <div
                          key={gi}
                          style={{
                            width: `${((g.length * g.qty) / stock) * 100}%`,
                            backgroundColor: c.bar,
                            // 같은 본 안에서 규격 구분용 얇은 경계
                            borderRight: gi < bar.groups.length - 1 ? "1px solid rgba(255,255,255,0.9)" : undefined,
                          }}
                          title={`${g.length}mm × ${g.qty}개`}
                        />
                      ))}
                      <div
                        style={{ width: `${(bar.kerfLoss / stock) * 100}%`, backgroundColor: "#CBD5E1" }}
                        title={`날두께 손실 ${bar.kerfLoss}mm`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 요약 */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-4 pt-3 border-t border-slate-100 text-sm">
              {[
                ["총 원자재", `${result.totalStock.toLocaleString()} mm`],
                ["절단 사용", `${result.totalUsed.toLocaleString()} mm`],
                ["날두께 손실", `${result.totalKerf.toLocaleString()} mm`],
                ["잔여 합계", `${result.totalRemainder.toLocaleString()} mm`],
              ].map(([k, v]) => (
                <div key={k}>
                  <span className="block text-xs text-slate-400">{k}</span>
                  <b className="text-slate-700">{v}</b>
                </div>
              ))}
            </div>

            {result.invalid.length > 0 && (
              <p className="text-sm text-red-600 font-semibold mt-3 flex items-center gap-1">
                <AlertTriangle className="w-4 h-4" />
                원자재보다 긴 규격 제외: {result.invalid.map((x) => `${x.length}mm × ${x.qty}개`).join(", ")}
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
                  <button
                    className="text-blue-600 hover:underline"
                    onClick={() =>
                      exportExcel({
                        stockLength: h.stockLength,
                        kerf: h.kerf,
                        demands: h.demands,
                        title: h.title || "",
                      })
                    }
                  >
                    엑셀
                  </button>
                  <button className="text-red-500 hover:underline" onClick={() => removeHistory(h.id)}>
                    삭제
                  </button>
                </span>
              </div>
              {h.title && <p className="text-xs font-semibold text-slate-600 mb-0.5">{h.title}</p>}
              <p className="text-sm font-bold text-slate-800">
                파이프({h.stockLength.toLocaleString()}) {h.totalBars}본 / 절단 {h.totalCuts}개 / 날두께({h.kerf}) /
                손실률 {h.lossRate}%
              </p>
              <div className="text-xs text-slate-500 mt-1 space-y-0.5">
                {h.demands.map((d, i) => (
                  <div key={i}>
                    {d.length.toLocaleString()}mm × {d.qty}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}
