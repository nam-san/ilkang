"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import {
  Plus, Trash2, Copy, ChevronUp, ChevronDown, Download, Save,
  AlertTriangle, Umbrella, FolderOpen, Table2, Pencil,
} from "lucide-react";
import { won, ymd, todayYmd } from "@/lib/format";
import {
  calcCanopyRow, sumCanopyRows,
  type SheetPriceTable, type PipePriceTable, type CanopyResult,
} from "@/lib/canopy";

type Contract = { id: number; siteName: string; builderName: string; endDate: string | null };
type Row = {
  key: string;
  w: string; h: string; l: string;
  sheetType: string; coating: string;
  pipeThickness: string; pipeSpec: string;
};
type SavedItem = {
  w: number; h: number; l: number;
  sheetType: string | null; coating: string | null;
  pipeSpec: string | null; pipeThickness: string | null;
};
type EstimateRow = {
  id: number; name: string; note: string | null; createdAt: string;
  itemCount: number; areaM2: number; pipeQty: number; totalAmount: number; unsupportedCount: number;
};
type Prices = {
  sheet: { id: number; sheetType: string; coating: string; unitPrice: number }[];
  pipe: { id: number; spec: string; thickness: string; unitPrice: number | null }[];
  sheetTable: SheetPriceTable;
  pipeTable: PipePriceTable;
  options: { sheetTypes: string[]; coatings: string[]; pipeSpecs: string[]; pipeThicknesses: string[] };
};

let seq = 0;
const newRow = (): Row => ({
  key: `r${++seq}`,
  w: "", h: "", l: "",
  sheetType: "", coating: "", pipeThickness: "", pipeSpec: "",
});

export default function CanopyAreaTab() {
  const [allContracts, setAllContracts] = useState<Contract[]>([]);
  const [includeDone, setIncludeDone] = useState(false);
  const [siteId, setSiteId] = useState("");
  const [prices, setPrices] = useState<Prices | null>(null);
  const [rows, setRows] = useState<Row[]>([newRow()]);
  const [estimates, setEstimates] = useState<EstimateRow[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [msg, setMsg] = useState("");
  const [showPrices, setShowPrices] = useState(false);

  // 현장 / 단가표 로드
  useEffect(() => {
    fetch("/api/contracts", { cache: "no-store" })
      .then((r) => r.json())
      .then((all: Contract[]) => setAllContracts(Array.isArray(all) ? all : []))
      .catch(() => setAllContracts([]));
    fetch("/api/canopy/prices", { cache: "no-store" })
      .then((r) => r.json())
      .then(setPrices)
      .catch(() => setPrices(null));
  }, []);

  const today = todayYmd();
  const isDone = useCallback((c: Contract) => !!c.endDate && ymd(c.endDate) < today, [today]);
  const activeContracts = useMemo(() => allContracts.filter((c) => !isDone(c)), [allContracts, isDone]);
  const doneContracts = useMemo(() => allContracts.filter((c) => isDone(c)), [allContracts, isDone]);

  useEffect(() => {
    if (!siteId && activeContracts.length) setSiteId(String(activeContracts[0].id));
  }, [activeContracts, siteId]);
  useEffect(() => {
    if (!includeDone && siteId && doneContracts.some((c) => String(c.id) === siteId)) {
      setSiteId(activeContracts.length ? String(activeContracts[0].id) : "");
    }
  }, [includeDone, siteId, doneContracts, activeContracts]);

  const loadEstimates = useCallback(async () => {
    if (!siteId) return setEstimates([]);
    const r = await fetch(`/api/canopy/estimates?contractId=${siteId}`, { cache: "no-store" });
    if (r.ok) setEstimates(await r.json());
  }, [siteId]);
  useEffect(() => {
    loadEstimates();
  }, [loadEstimates]);

  const flash = (m: string) => {
    setMsg(m);
    setTimeout(() => setMsg(""), 3000);
  };

  // ── 계산 (클라이언트 즉시 · 저장 시 서버에서 동일 모듈로 재검증) ──
  const results: CanopyResult[] = useMemo(() => {
    if (!prices) return [];
    return rows.map((r) =>
      calcCanopyRow(
        {
          w: Number(r.w) || 0, h: Number(r.h) || 0, l: Number(r.l) || 0,
          sheetType: r.sheetType || null, coating: r.coating || null,
          pipeSpec: r.pipeSpec || null, pipeThickness: r.pipeThickness || null,
        },
        prices.sheetTable,
        prices.pipeTable
      )
    );
  }, [rows, prices]);
  const totals = useMemo(() => sumCanopyRows(results), [results]);

  // ── 행 조작 ──
  const setCell = (i: number, k: keyof Row, v: string) =>
    setRows((p) => p.map((r, idx) => (idx === i ? { ...r, [k]: v } : r)));
  const addRow = () => setRows((p) => [...p, newRow()]);
  const delRow = (i: number) => setRows((p) => (p.length === 1 ? [newRow()] : p.filter((_, idx) => idx !== i)));
  const dupRow = (i: number) =>
    setRows((p) => [...p.slice(0, i + 1), { ...p[i], key: `r${++seq}` }, ...p.slice(i + 1)]);
  const move = (i: number, d: -1 | 1) =>
    setRows((p) => {
      const j = i + d;
      if (j < 0 || j >= p.length) return p;
      const nx = [...p];
      [nx[i], nx[j]] = [nx[j], nx[i]];
      return nx;
    });

  const newEstimate = () => {
    setEditingId(null);
    setName("");
    setRows([newRow()]);
  };

  // ── 저장 / 불러오기 ──
  const save = async () => {
    if (!siteId) return flash("현장을 선택하세요.");
    const valid = rows.filter((r) => Number(r.w) > 0 && Number(r.h) > 0 && Number(r.l) > 0);
    if (valid.length === 0) return flash("W·H·L 이 입력된 행이 없습니다.");
    const title = name.trim() || `캐노피 산출 ${todayYmd()}`;
    const body = {
      contractId: Number(siteId),
      name: title,
      items: valid.map((r) => ({
        w: Number(r.w), h: Number(r.h), l: Number(r.l),
        sheetType: r.sheetType || null, coating: r.coating || null,
        pipeSpec: r.pipeSpec || null, pipeThickness: r.pipeThickness || null,
      })),
    };
    const url = editingId ? `/api/canopy/estimates/${editingId}` : "/api/canopy/estimates";
    const res = await fetch(url, {
      method: editingId ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) return flash((await res.json()).error || "저장 실패");
    const saved = await res.json();
    setEditingId(saved.id);
    setName(saved.name);
    flash(`✅ '${saved.name}' 저장 완료 (${valid.length}건)`);
    loadEstimates();
  };

  const open = async (id: number) => {
    const r = await fetch(`/api/canopy/estimates/${id}`, { cache: "no-store" });
    if (!r.ok) return flash("불러오기 실패");
    const e = await r.json();
    setEditingId(e.id);
    setName(e.name);
    setRows(
      e.items.map((it: SavedItem) => ({
        key: `r${++seq}`,
        w: String(it.w), h: String(it.h), l: String(it.l),
        sheetType: it.sheetType ?? "", coating: it.coating ?? "",
        pipeThickness: it.pipeThickness ?? "", pipeSpec: it.pipeSpec ?? "",
      }))
    );
    flash(`'${e.name}' 불러옴`);
  };

  const removeEstimate = async (id: number, nm: string) => {
    if (!confirm(`'${nm}' 산출서를 삭제하시겠습니까?`)) return;
    await fetch(`/api/canopy/estimates/${id}`, { method: "DELETE" });
    if (editingId === id) newEstimate();
    loadEstimates();
  };

  const site = allContracts.find((c) => String(c.id) === siteId);
  const viewingDone = !!site && isDone(site);
  const opt = prices?.options;

  return (
    <div className="space-y-3">
      {/* 현장 선택 */}
      <div className="card p-3 flex flex-wrap items-end gap-3">
        <div className="min-w-[300px] flex-1">
          <label className="label">현장 {includeDone ? "(준공 현장 포함)" : "(진행 중 현장)"}</label>
          <select className="input" value={siteId} onChange={(e) => { setSiteId(e.target.value); newEstimate(); }}>
            {activeContracts.length + (includeDone ? doneContracts.length : 0) === 0 && (
              <option value="">선택 가능한 현장이 없습니다</option>
            )}
            {activeContracts.length > 0 && (
              <optgroup label="진행 중">
                {activeContracts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.siteName} ({c.builderName}){c.endDate ? ` · 준공 ${ymd(c.endDate)}` : ""}
                  </option>
                ))}
              </optgroup>
            )}
            {includeDone && doneContracts.length > 0 && (
              <optgroup label="준공 완료 (이력 조회)">
                {doneContracts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.siteName} ({c.builderName}) · 준공 {ymd(c.endDate!)}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </div>
        <label className="flex items-center gap-1.5 text-sm text-slate-600 pb-2 whitespace-nowrap">
          <input type="checkbox" checked={includeDone} onChange={(e) => setIncludeDone(e.target.checked)} />
          준공 현장 포함 <span className="text-xs text-slate-400">({doneContracts.length})</span>
        </label>
        <button className="btn-ghost" onClick={() => setShowPrices((v) => !v)}>
          <Table2 className="w-4 h-4" /> 단가표 {showPrices ? "닫기" : "보기"}
        </button>
      </div>

      {viewingDone && (
        <div className="card p-3 bg-amber-50 border-amber-200 text-sm text-amber-800">
          <b>준공 완료 현장</b>의 과거 이력을 조회 중입니다 (준공 {ymd(site!.endDate!)}).
        </div>
      )}

      {/* 단가표 */}
      {showPrices && prices && (
        <PriceTables
          prices={prices}
          onSaved={() => {
            fetch("/api/canopy/prices", { cache: "no-store" }).then((r) => r.json()).then(setPrices);
            flash("단가표가 갱신되었습니다.");
          }}
        />
      )}

      {/* 저장된 산출서 */}
      <div className="card overflow-x-auto">
        <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <span className="font-bold text-sm text-slate-700 flex items-center gap-1.5">
            <FolderOpen className="w-4 h-4 text-slate-400" /> 저장된 산출서
            <span className="text-slate-400 font-normal">({estimates.length})</span>
          </span>
          <button className="btn-ghost py-1 text-xs" onClick={newEstimate}>
            <Plus className="w-3.5 h-3.5" /> 새 산출서
          </button>
        </div>
        {estimates.length === 0 ? (
          <p className="p-4 text-center text-sm text-slate-400">저장된 산출서가 없습니다.</p>
        ) : (
          <table className="w-full min-w-[760px]">
            <thead>
              <tr>
                <th className="th">산출서</th>
                <th className="th w-28">작성일</th>
                <th className="th text-right w-20">항목</th>
                <th className="th text-right w-24">면적(㎡)</th>
                <th className="th text-right w-20">본수</th>
                <th className="th text-right w-32">합계</th>
                <th className="th w-28"></th>
              </tr>
            </thead>
            <tbody>
              {estimates.map((e) => (
                <tr key={e.id} className={`hover:bg-slate-50 ${editingId === e.id ? "bg-blue-50/50" : ""}`}>
                  <td className="td font-semibold">
                    {e.name}
                    {editingId === e.id && (
                      <span className="ml-1.5 text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">편집중</span>
                    )}
                    {e.unsupportedCount > 0 && (
                      <span className="ml-1.5 text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded">
                        미취급 {e.unsupportedCount}
                      </span>
                    )}
                  </td>
                  <td className="td text-slate-500 text-xs">{ymd(e.createdAt)}</td>
                  <td className="td text-right">{e.itemCount}</td>
                  <td className="td text-right">{e.areaM2.toFixed(2)}</td>
                  <td className="td text-right">{e.pipeQty}</td>
                  <td className="td text-right font-semibold text-blue-700">{won(e.totalAmount)}</td>
                  <td className="td text-right whitespace-nowrap">
                    <button className="text-slate-400 hover:text-blue-600 mr-2" title="불러오기" onClick={() => open(e.id)}>
                      <Pencil className="w-4 h-4" />
                    </button>
                    <a
                      className="text-slate-400 hover:text-blue-600 mr-2 inline-block align-middle"
                      title="엑셀 다운로드"
                      href={`/api/canopy/estimates/${e.id}/export`}
                      download
                    >
                      <Download className="w-4 h-4" />
                    </a>
                    <button className="text-slate-300 hover:text-red-500" title="삭제" onClick={() => removeEstimate(e.id, e.name)}>
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* 산출 테이블 */}
      <div className="card p-3">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <Umbrella className="w-4 h-4 text-blue-600" />
          <input
            className="input w-64"
            placeholder="산출서 이름 (예: 지하주차장 캐노피)"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button className="btn-primary" onClick={save}>
            <Save className="w-4 h-4" /> {editingId ? "수정 저장" : "저장"}
          </button>
          {editingId && (
            <a className="btn-ghost" href={`/api/canopy/estimates/${editingId}/export`} download>
              <Download className="w-4 h-4" /> 엑셀 다운로드
            </a>
          )}
          {msg && <span className="text-sm text-blue-700 font-semibold ml-auto">{msg}</span>}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1180px]">
            <thead>
              <tr>
                <th className="th w-8">#</th>
                <th className="th text-right w-20">W (mm)</th>
                <th className="th text-right w-20">H (mm)</th>
                <th className="th text-right w-20">L (mm)</th>
                <th className="th text-right w-24">면적 (㎡)</th>
                <th className="th text-right w-24">각파이프 본수</th>
                <th className="th w-32">시트 두께</th>
                <th className="th w-24">시트 코팅</th>
                <th className="th w-24">파이프 두께</th>
                <th className="th w-32">파이프 규격</th>
                <th className="th text-right w-28">시트금액</th>
                <th className="th text-right w-28">각파이프금액</th>
                <th className="th text-right w-32">합계</th>
                <th className="th w-24"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const res = results[i];
                const hasDim = Number(r.w) > 0 && Number(r.h) > 0 && Number(r.l) > 0;
                return (
                  <tr key={r.key} className={res?.unsupported ? "bg-red-50" : "hover:bg-slate-50"}>
                    <td className="td text-center text-slate-400">
                      {res?.unsupported ? <AlertTriangle className="w-4 h-4 text-red-500 mx-auto" /> : i + 1}
                    </td>
                    {(["w", "h", "l"] as const).map((k) => (
                      <td className="td" key={k}>
                        <input
                          type="number"
                          step="1"
                          min="0"
                          className="input py-1 text-right"
                          value={r[k]}
                          onChange={(e) => setCell(i, k, e.target.value)}
                        />
                      </td>
                    ))}
                    <td className="td text-right font-semibold">{hasDim ? res.areaM2.toFixed(2) : ""}</td>
                    <td className="td text-right font-semibold">{hasDim ? res.pipeQty : ""}</td>
                    <td className="td">
                      <select className="input py-1" value={r.sheetType} onChange={(e) => setCell(i, "sheetType", e.target.value)}>
                        <option value="">선택</option>
                        {opt?.sheetTypes.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </td>
                    <td className="td">
                      <select className="input py-1" value={r.coating} onChange={(e) => setCell(i, "coating", e.target.value)}>
                        <option value="">선택</option>
                        {opt?.coatings.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </td>
                    <td className="td">
                      <select className="input py-1" value={r.pipeThickness} onChange={(e) => setCell(i, "pipeThickness", e.target.value)}>
                        <option value="">선택</option>
                        {opt?.pipeThicknesses.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </td>
                    <td className="td">
                      <select className="input py-1" value={r.pipeSpec} onChange={(e) => setCell(i, "pipeSpec", e.target.value)}>
                        <option value="">선택</option>
                        {opt?.pipeSpecs.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </td>
                    <td className="td text-right">
                      {r.sheetType && r.coating && res?.sheetUnitPrice === null ? (
                        <span className="text-[11px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded">미취급</span>
                      ) : res?.sheetAmount != null ? (
                        won(res.sheetAmount)
                      ) : (
                        ""
                      )}
                    </td>
                    <td className="td text-right">
                      {r.pipeSpec && r.pipeThickness && res?.pipeUnitPrice === null ? (
                        <span className="text-[11px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded">미취급</span>
                      ) : res?.pipeAmount != null ? (
                        won(res.pipeAmount)
                      ) : (
                        ""
                      )}
                    </td>
                    <td className="td text-right font-semibold text-blue-700">
                      {res?.unsupported ? "-" : res?.totalAmount != null ? won(res.totalAmount) : ""}
                    </td>
                    <td className="td text-right whitespace-nowrap">
                      <button className="text-slate-300 hover:text-slate-600" title="위로" onClick={() => move(i, -1)}>
                        <ChevronUp className="w-3.5 h-3.5" />
                      </button>
                      <button className="text-slate-300 hover:text-slate-600 mx-0.5" title="아래로" onClick={() => move(i, 1)}>
                        <ChevronDown className="w-3.5 h-3.5" />
                      </button>
                      <button className="text-slate-300 hover:text-blue-600 mr-0.5" title="복제" onClick={() => dupRow(i)}>
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <button className="text-slate-300 hover:text-red-500" title="삭제" onClick={() => delRow(i)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-blue-50 font-bold">
                <td className="td" colSpan={4}>합계 ({rows.length}행)</td>
                <td className="td text-right">{totals.areaM2.toFixed(2)}</td>
                <td className="td text-right">{totals.pipeQty}</td>
                <td className="td" colSpan={4}></td>
                <td className="td text-right">{won(totals.sheetAmount)}</td>
                <td className="td text-right">{won(totals.pipeAmount)}</td>
                <td className="td text-right text-blue-800">{won(totals.totalAmount)}</td>
                <td className="td"></td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="flex items-center justify-between mt-3">
          <button className="btn-ghost" onClick={addRow}>
            <Plus className="w-4 h-4" /> 행 추가
          </button>
          {totals.unsupportedCount > 0 && (
            <span className="text-sm text-red-600 font-semibold flex items-center gap-1">
              <AlertTriangle className="w-4 h-4" /> 미취급 조합 {totals.unsupportedCount}건 제외
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/** 단가표 조회 · 수정 · 규격 추가/삭제 */
function PriceTables({ prices, onSaved }: { prices: Prices; onSaved: () => void }) {
  const [sheet, setSheet] = useState(prices.sheet.map((s) => ({ ...s, v: String(s.unitPrice) })));
  const [pipe, setPipe] = useState(
    prices.pipe.map((p) => ({ ...p, v: p.unitPrice === null ? "" : String(p.unitPrice) }))
  );
  const [saving, setSaving] = useState(false);
  const [newSheetType, setNewSheetType] = useState("");
  const [newPipeSpec, setNewPipeSpec] = useState("");
  const [newThickness, setNewThickness] = useState("");
  const [err, setErr] = useState("");
  const { sheetTypes, coatings, pipeSpecs, pipeThicknesses } = prices.options;

  const addKind = async (kind: string, name: string) => {
    if (!name.trim()) return;
    setErr("");
    const r = await fetch("/api/canopy/prices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, name: name.trim() }),
    });
    if (!r.ok) {
      setErr((await r.json()).error || "추가 실패");
      setTimeout(() => setErr(""), 2500);
      return;
    }
    setNewSheetType("");
    setNewPipeSpec("");
    setNewThickness("");
    onSaved();
  };

  const removeKind = async (kind: string, name: string, label: string) => {
    if (!confirm(`'${name}' ${label}을(를) 단가표에서 삭제하시겠습니까?`)) return;
    await fetch(`/api/canopy/prices?kind=${kind}&name=${encodeURIComponent(name)}`, {
      method: "DELETE",
    });
    onSaved();
  };

  const save = async () => {
    setSaving(true);
    await fetch("/api/canopy/prices", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sheet: sheet.map((s) => ({ id: s.id, unitPrice: s.v })),
        pipe: pipe.map((p) => ({ id: p.id, unitPrice: p.v === "" ? null : p.v })),
      }),
    });
    setSaving(false);
    onSaved();
  };

  const sCell = (t: string, c: string) => sheet.find((x) => x.sheetType === t && x.coating === c);
  const pCell = (s: string, t: string) => pipe.find((x) => x.spec === s && x.thickness === t);

  return (
    <div className="card p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-sm text-slate-700">단가표 (원) — 수정 후 저장하면 이후 산출에 즉시 반영</h3>
        <button className="btn-primary py-1.5" onClick={save} disabled={saving}>
          <Save className="w-4 h-4" /> {saving ? "저장중…" : "단가 저장"}
        </button>
      </div>

      {err && <p className="text-sm text-red-600 font-semibold">{err}</p>}

      <div>
        <p className="text-xs font-semibold text-slate-500 mb-1">시트 단가 (원/㎡)</p>
        <table className="w-full max-w-xl">
          <thead>
            <tr>
              <th className="th">시트 두께</th>
              {coatings.map((c) => (
                <th key={c} className="th text-right w-28">{c}</th>
              ))}
              <th className="th w-10"></th>
            </tr>
          </thead>
          <tbody>
            {sheetTypes.map((t) => (
              <tr key={t} className="group">
                <td className="td font-medium">{t}</td>
                {coatings.map((c) => {
                  const cell = sCell(t, c);
                  return (
                    <td className="td" key={c}>
                      <input
                        type="number"
                        className="input py-1 text-right"
                        value={cell?.v ?? ""}
                        onChange={(e) =>
                          setSheet((p) => p.map((x) => (x.id === cell?.id ? { ...x, v: e.target.value } : x)))
                        }
                      />
                    </td>
                  );
                })}
                <td className="td text-right">
                  <button
                    className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100"
                    title="이 시트 두께 삭제"
                    onClick={() => removeKind("sheetType", t, "시트 두께")}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            ))}
            {/* 신규 시트 두께 추가 */}
            <tr className="bg-blue-50/40">
              <td className="td">
                <input
                  className="input py-1"
                  placeholder="새 시트 두께 (예: AL P/N 2.5T)"
                  value={newSheetType}
                  onChange={(e) => setNewSheetType(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addKind("sheetType", newSheetType)}
                />
              </td>
              <td className="td text-xs text-slate-400" colSpan={coatings.length}>
                추가 후 단가를 입력하세요
              </td>
              <td className="td text-right">
                <button className="btn-primary py-1" onClick={() => addKind("sheetType", newSheetType)} title="시트 두께 추가">
                  <Plus className="w-4 h-4" />
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="overflow-x-auto">
        <p className="text-xs font-semibold text-slate-500 mb-1">
          각파이프 단가 (원/본, 6m 기준) · <span className="text-slate-400">빈칸 = 미취급</span>
        </p>
        <table className="w-full min-w-[760px]">
          <thead>
            <tr>
              <th className="th">규격</th>
              {pipeThicknesses.map((t) => (
                <th key={t} className="th text-right w-24 group">
                  <span className="inline-flex items-center gap-1">
                    {t}
                    <button
                      className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100"
                      title="이 두께 삭제"
                      onClick={() => removeKind("pipeThickness", t, "두께")}
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </span>
                </th>
              ))}
              <th className="th w-10"></th>
            </tr>
          </thead>
          <tbody>
            {pipeSpecs.map((s) => (
              <tr key={s} className="group">
                <td className="td font-medium">{s}</td>
                {pipeThicknesses.map((t) => {
                  const cell = pCell(s, t);
                  return (
                    <td className="td" key={t}>
                      <input
                        type="number"
                        className="input py-1 text-right"
                        placeholder="미취급"
                        value={cell?.v ?? ""}
                        onChange={(e) =>
                          setPipe((p) => p.map((x) => (x.id === cell?.id ? { ...x, v: e.target.value } : x)))
                        }
                      />
                    </td>
                  );
                })}
                <td className="td text-right">
                  <button
                    className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100"
                    title="이 규격 삭제"
                    onClick={() => removeKind("pipeSpec", s, "규격")}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            ))}
            {/* 신규 규격 / 두께 추가 */}
            <tr className="bg-blue-50/40">
              <td className="td">
                <input
                  className="input py-1"
                  placeholder="새 규격 (예: 125*125 칼라)"
                  value={newPipeSpec}
                  onChange={(e) => setNewPipeSpec(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addKind("pipeSpec", newPipeSpec)}
                />
              </td>
              <td className="td" colSpan={Math.max(1, pipeThicknesses.length - 1)}>
                <span className="text-xs text-slate-400">추가 후 두께별 단가를 입력하세요 (빈칸 = 미취급)</span>
              </td>
              <td className="td">
                <input
                  className="input py-1"
                  placeholder="새 두께"
                  value={newThickness}
                  onChange={(e) => setNewThickness(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addKind("pipeThickness", newThickness)}
                />
              </td>
              <td className="td text-right">
                <button className="btn-primary py-1" onClick={() => addKind(newPipeSpec ? "pipeSpec" : "pipeThickness", newPipeSpec || newThickness)} title="규격/두께 추가">
                  <Plus className="w-4 h-4" />
                </button>
              </td>
            </tr>
          </tbody>
        </table>
        <p className="text-[11px] text-slate-400 mt-1">
          규격 칸에 입력하면 <b>행(규격)</b>이, 오른쪽 두께 칸에 입력하면 <b>열(두께)</b>이 추가됩니다. 행/열에 마우스를 올리면 삭제 버튼이 나타납니다.
        </p>
      </div>
    </div>
  );
}
