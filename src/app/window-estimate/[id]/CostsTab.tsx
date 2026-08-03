"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { RefreshCw, Coins, ListTree, RotateCcw, AlertCircle, Download } from "lucide-react";
import { won } from "@/lib/format";
import type { Project } from "./page";

type Line = {
  id: number;
  itemName: string;
  isGroup: boolean;
  quantity: number;
  totalWeight: number | null;
  barType: string | null;
  hingeCost: number;
  screenCost: number;
  pjInstallCost: number;
  matTotalCost: number | null;
  installCostCalc: number | null;
  laborTotalCost: number | null;
  matUnitPrice: number;
  laborUnitPrice: number;
  expenseUnitPrice: number;
  matOverride: boolean;
  laborOverride: boolean;
};

const trunc = (unit: number, qty: number) => Math.trunc(unit * qty);
const groupLevel = (name: string) => {
  const m = name.trim().match(/^(\d+)(-(\d+))?\./);
  if (!m) return 1;
  return m[3] ? 2 : 1;
};

export default function CostsTab({ project }: { project: Project }) {
  const [lines, setLines] = useState<Line[]>([]);
  const [view, setView] = useState<"cost" | "quote">("cost");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  // 경비 단가 비율 (% 단위 입력 → 저장은 소수 비율)
  const [ratioPct, setRatioPct] = useState(
    project.costParam?.expenseRatio ? String(project.costParam.expenseRatio * 100) : ""
  );
  const [applying, setApplying] = useState(false);

  const applyExpense = async () => {
    const pct = Number(ratioPct);
    if (!isFinite(pct) || pct < 0) {
      setMsg("비율을 올바르게 입력하세요.");
      setTimeout(() => setMsg(""), 2500);
      return;
    }
    if (!confirm(`모든 라인의 경비단가를 노무비단가의 ${pct}%로 설정합니다. 진행할까요?`)) return;
    setApplying(true);
    const r = await fetch(`/api/estimate-projects/${project.id}/apply-expense`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ratio: pct / 100 }),
    });
    const d = await r.json();
    setApplying(false);
    setMsg(r.ok ? `✅ ${d.applied}개 라인 경비단가 적용 (노무비 × ${pct}%)` : d.error || "적용 실패");
    setTimeout(() => setMsg(""), 3500);
    load();
  };

  const barKeys = useMemo(() => {
    try {
      return Object.keys(JSON.parse(project.costParam?.barPrices || "{}"));
    } catch {
      return [];
    }
  }, [project.costParam]);

  const load = useCallback(async () => {
    const r = await fetch(`/api/estimate-lines?projectId=${project.id}`, { cache: "no-store" });
    if (r.ok) setLines(await r.json());
  }, [project.id]);
  useEffect(() => {
    load();
  }, [load]);

  const runCalc = async () => {
    setBusy(true);
    const r = await fetch(`/api/estimate-projects/${project.id}/calc-costs`, { method: "POST" });
    const d = await r.json();
    setBusy(false);
    setMsg(`✅ ${d.calculated}개 라인 비용 계산 완료${d.overrides ? ` · 수동조정 ${d.overrides}건` : ""}`);
    setTimeout(() => setMsg(""), 3500);
    load();
  };

  const patch = async (id: number, body: Record<string, unknown>) => {
    await fetch(`/api/estimate-lines/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    load();
  };

  // 견적 금액 그룹 소계 계산 (계층: level 1/2)
  const quoteRows = useMemo(() => {
    const rows: { line: Line; subtotal?: { mat: number; labor: number; exp: number; sum: number } }[] = [];
    lines.forEach((line, i) => {
      if (line.isGroup) {
        const L = groupLevel(line.itemName);
        let mat = 0, labor = 0, exp = 0;
        for (let j = i + 1; j < lines.length; j++) {
          const n = lines[j];
          if (n.isGroup && groupLevel(n.itemName) <= L) break;
          if (!n.isGroup) {
            mat += trunc(n.matUnitPrice, n.quantity);
            labor += trunc(n.laborUnitPrice, n.quantity);
            exp += trunc(n.expenseUnitPrice, n.quantity);
          }
        }
        rows.push({ line, subtotal: { mat, labor, exp, sum: mat + labor + exp } });
      } else {
        rows.push({ line });
      }
    });
    return rows;
  }, [lines]);

  const grand = useMemo(() => {
    let mat = 0, labor = 0, exp = 0;
    for (const l of lines) {
      if (!l.isGroup) {
        mat += trunc(l.matUnitPrice, l.quantity);
        labor += trunc(l.laborUnitPrice, l.quantity);
        exp += trunc(l.expenseUnitPrice, l.quantity);
      }
    }
    return { mat, labor, exp, sum: mat + labor + exp };
  }, [lines]);

  return (
    <div className="space-y-4">
      <div className="card p-4 flex flex-wrap items-center gap-3">
        <button className="btn-primary" onClick={runCalc} disabled={busy}>
          <RefreshCw className={`w-4 h-4 ${busy ? "animate-spin" : ""}`} /> 비용 계산 실행
        </button>
        <div className="flex rounded-lg border border-slate-200 overflow-hidden">
          <button onClick={() => setView("cost")} className={`flex items-center gap-1.5 px-3 py-2 text-sm font-semibold ${view === "cost" ? "bg-blue-600 text-white" : "bg-white text-slate-500 hover:bg-slate-50"}`}>
            <Coins className="w-4 h-4" /> 비용 산출
          </button>
          <button onClick={() => setView("quote")} className={`flex items-center gap-1.5 px-3 py-2 text-sm font-semibold ${view === "quote" ? "bg-blue-600 text-white" : "bg-white text-slate-500 hover:bg-slate-50"}`}>
            <ListTree className="w-4 h-4" /> 견적 금액 · 견적서
          </button>
        </div>
        <a
          href={`/api/estimate-projects/${project.id}/export-excel`}
          className="btn-ghost"
          download
        >
          <Download className="w-4 h-4" /> 엑셀 다운로드
        </a>

        {/* 경비 단가 비율: 노무비단가 × 비율 → 경비단가 일괄 적용 */}
        <div className="flex items-center gap-1.5 border-l border-slate-200 pl-3">
          <label className="text-xs font-semibold text-slate-600 whitespace-nowrap">경비 단가 비율</label>
          <input
            type="number"
            step="0.1"
            min="0"
            className="input w-20 py-1.5 text-right"
            placeholder="0"
            value={ratioPct}
            onChange={(e) => setRatioPct(e.target.value)}
            title="노무비단가 대비 경비 비율(%)"
          />
          <span className="text-xs text-slate-500">%</span>
          <button className="btn-primary py-1.5" onClick={applyExpense} disabled={applying}>
            {applying ? "적용중…" : "적용"}
          </button>
        </div>
        <p className="text-sm text-slate-500">
          총자재비=ROUNDUP(kg당자재비×총중량+흰지+방충망,-2) · 시공비=ROUNDUP(총중량×kg당시공비,-2). 계산값이 재료비/노무비 단가로 자동 연동됩니다.
        </p>
        {msg && <span className="text-sm text-green-600 ml-auto">{msg}</span>}
      </div>

      {view === "cost" ? (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[1000px]">
            <thead>
              <tr>
                <th className="th">품명</th>
                <th className="th text-right w-24">총중량(kg)</th>
                <th className="th w-28">바 종류</th>
                <th className="th text-right w-24">흰지비</th>
                <th className="th text-right w-24">방충망비</th>
                <th className="th text-right w-24">PJ시공비</th>
                <th className="th text-right w-28">총자재비</th>
                <th className="th text-right w-24">시공비</th>
                <th className="th text-right w-28">총시공비</th>
              </tr>
            </thead>
            <tbody>
              {lines.filter((l) => !l.isGroup && l.totalWeight != null).length === 0 && (
                <tr><td className="td text-center text-slate-400 py-8" colSpan={9}>총중량이 산출된 라인이 없습니다. 먼저 &lsquo;자재 산출&rsquo;을 완료하세요.</td></tr>
              )}
              {lines.filter((l) => !l.isGroup && l.totalWeight != null).map((l) => (
                <CostRow key={l.id} line={l} barKeys={barKeys} onPatch={patch} />
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[1040px]">
            <thead>
              <tr>
                <th className="th">품명</th>
                <th className="th text-right w-16">수량</th>
                <th className="th text-right w-32">재료비단가</th>
                <th className="th text-right w-32">노무비단가</th>
                <th className="th text-right w-28">경비단가</th>
                <th className="th text-right w-32">재료금액</th>
                <th className="th text-right w-32">노무금액</th>
                <th className="th text-right w-32">금액합계</th>
              </tr>
            </thead>
            <tbody>
              {quoteRows.map(({ line, subtotal }) =>
                line.isGroup ? (
                  <tr key={line.id} className="bg-slate-100">
                    <td className="td font-bold text-slate-700">{line.itemName}</td>
                    <td className="td"></td>
                    <td className="td"></td>
                    <td className="td"></td>
                    <td className="td"></td>
                    <td className="td text-right font-bold">{won(subtotal!.mat)}</td>
                    <td className="td text-right font-bold">{won(subtotal!.labor)}</td>
                    <td className="td text-right font-bold text-blue-800">{won(subtotal!.sum)}</td>
                  </tr>
                ) : (
                  <QuoteRow key={line.id} line={line} onPatch={patch} />
                )
              )}
            </tbody>
            <tfoot>
              <tr className="bg-blue-50 font-bold">
                <td className="td" colSpan={5}>총 합계</td>
                <td className="td text-right">{won(grand.mat)}</td>
                <td className="td text-right">{won(grand.labor)}</td>
                <td className="td text-right text-blue-800 text-base">{won(grand.sum)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

function CostRow({
  line,
  barKeys,
  onPatch,
}: {
  line: Line;
  barKeys: string[];
  onPatch: (id: number, b: Record<string, unknown>) => void;
}) {
  const [f, setF] = useState({
    hingeCost: String(line.hingeCost),
    screenCost: String(line.screenCost),
    pjInstallCost: String(line.pjInstallCost),
  });
  const num = "input py-1 text-right";
  return (
    <tr className="hover:bg-slate-50">
      <td className="td font-medium">{line.itemName}</td>
      <td className="td text-right">{line.totalWeight?.toFixed(3)}</td>
      <td className="td">
        <select className="input py-1" value={line.barType ?? ""} onChange={(e) => onPatch(line.id, { barType: e.target.value })}>
          <option value="">(기본)</option>
          {barKeys.map((k) => <option key={k} value={k}>{k}</option>)}
        </select>
      </td>
      <td className="td"><input type="number" className={num} value={f.hingeCost} onChange={(e) => setF({ ...f, hingeCost: e.target.value })} onBlur={() => Number(f.hingeCost) !== line.hingeCost && onPatch(line.id, { hingeCost: f.hingeCost })} /></td>
      <td className="td"><input type="number" className={num} value={f.screenCost} onChange={(e) => setF({ ...f, screenCost: e.target.value })} onBlur={() => Number(f.screenCost) !== line.screenCost && onPatch(line.id, { screenCost: f.screenCost })} /></td>
      <td className="td"><input type="number" className={num} value={f.pjInstallCost} onChange={(e) => setF({ ...f, pjInstallCost: e.target.value })} onBlur={() => Number(f.pjInstallCost) !== line.pjInstallCost && onPatch(line.id, { pjInstallCost: f.pjInstallCost })} /></td>
      <td className="td text-right font-semibold text-blue-700">{line.matTotalCost != null ? won(line.matTotalCost) : "-"}</td>
      <td className="td text-right">{line.installCostCalc != null ? won(line.installCostCalc) : "-"}</td>
      <td className="td text-right font-semibold text-blue-700">{line.laborTotalCost != null ? won(line.laborTotalCost) : "-"}</td>
    </tr>
  );
}

function QuoteRow({ line, onPatch }: { line: Line; onPatch: (id: number, b: Record<string, unknown>) => void }) {
  const matDiff = line.matOverride && line.matTotalCost != null ? line.matUnitPrice - line.matTotalCost : 0;
  const laborDiff = line.laborOverride && line.laborTotalCost != null ? line.laborUnitPrice - line.laborTotalCost : 0;

  const cell = (
    override: boolean,
    unit: number,
    auto: number | null,
    diff: number,
    field: "matUnitPrice" | "laborUnitPrice",
    overrideField: "matOverride" | "laborOverride"
  ) => (
    <td className="td text-right">
      <input
        type="number"
        className="input py-1 text-right"
        defaultValue={unit}
        onBlur={(e) => { const v = Number(e.target.value) || 0; if (v !== unit) onPatch(line.id, { [field]: v }); }}
      />
      {override && (
        <div className="mt-0.5 flex items-center justify-end gap-1 text-[10px]">
          <span className="inline-flex items-center gap-0.5 px-1 rounded bg-amber-100 text-amber-700 font-semibold">
            <AlertCircle className="w-2.5 h-2.5" /> 수동
          </span>
          {auto != null && (
            <span className={diff >= 0 ? "text-red-500" : "text-blue-500"} title={`자동값 ${won(auto)}`}>
              {diff >= 0 ? "+" : ""}{won(diff)}
            </span>
          )}
          <button className="text-slate-400 hover:text-blue-600" title="자동값 복원" onClick={() => onPatch(line.id, { [overrideField]: false })}>
            <RotateCcw className="w-3 h-3" />
          </button>
        </div>
      )}
    </td>
  );

  const matAmt = trunc(line.matUnitPrice, line.quantity);
  const laborAmt = trunc(line.laborUnitPrice, line.quantity);
  const expAmt = trunc(line.expenseUnitPrice, line.quantity);

  return (
    <tr className="hover:bg-slate-50">
      <td className="td">{line.itemName}</td>
      <td className="td text-right">{line.quantity.toLocaleString()}</td>
      {cell(line.matOverride, line.matUnitPrice, line.matTotalCost, matDiff, "matUnitPrice", "matOverride")}
      {cell(line.laborOverride, line.laborUnitPrice, line.laborTotalCost, laborDiff, "laborUnitPrice", "laborOverride")}
      <td className="td text-right">
        <input type="number" className="input py-1 text-right" defaultValue={line.expenseUnitPrice}
          onBlur={(e) => { const v = Number(e.target.value) || 0; if (v !== line.expenseUnitPrice) onPatch(line.id, { expenseUnitPrice: v }); }} />
      </td>
      <td className="td text-right">{won(matAmt)}</td>
      <td className="td text-right">{won(laborAmt)}</td>
      <td className="td text-right font-semibold text-blue-700">{won(matAmt + laborAmt + expAmt)}</td>
    </tr>
  );
}
