"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { Plus, Trash2, Save, Download, Square, MapPin } from "lucide-react";
// (Trash2는 이력 행 삭제에 사용)
import { ymd, todayYmd } from "@/lib/format";
import { sheetArea, expandedSize } from "@/lib/sheetArea";

type Contract = {
  id: number;
  siteName: string;
  builderName: string;
  endDate: string | null;
};
type Item = {
  id: number;
  contractId: number;
  location: string;
  itemName: string | null;
  width: number;
  widthFlange: number;
  widthWing: number;
  height: number;
  heightFlange: number;
  heightWing: number;
  qty: number;
  area: number;
  createdAt: string;
};

const EMPTY = {
  location: "",
  itemName: "",
  width: "",
  widthFlange: "",
  widthWing: "",
  height: "",
  heightFlange: "",
  heightWing: "",
  qty: "1",
};

const n = (v: string) => (v === "" ? 0 : Number(v) || 0);

export default function SheetAreaTab() {
  const [allContracts, setAllContracts] = useState<Contract[]>([]);
  const [includeDone, setIncludeDone] = useState(false); // 준공 현장 포함(이력 조회)
  const [siteId, setSiteId] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [form, setForm] = useState({ ...EMPTY });
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetch("/api/contracts", { cache: "no-store" })
      .then((r) => r.json())
      .then((all: Contract[]) => {
        setAllContracts(Array.isArray(all) ? all : []);
      })
      .catch(() => setAllContracts([]));
  }, []);

  // 진행 중(준공 전·준공일 미지정) / 준공 완료 분리
  const today = todayYmd();
  const isDone = useCallback(
    (c: Contract) => !!c.endDate && ymd(c.endDate) < today,
    [today]
  );
  const activeContracts = useMemo(
    () => allContracts.filter((c) => !isDone(c)),
    [allContracts, isDone]
  );
  const doneContracts = useMemo(
    () => allContracts.filter((c) => isDone(c)),
    [allContracts, isDone]
  );
  const selectable = includeDone ? [...activeContracts, ...doneContracts] : activeContracts;

  // 기본 선택 (진행 중 현장 우선)
  useEffect(() => {
    if (!siteId && activeContracts.length) setSiteId(String(activeContracts[0].id));
  }, [activeContracts, siteId]);

  // 준공 포함 해제 시, 준공 현장을 보고 있었다면 진행 중 현장으로 되돌림
  useEffect(() => {
    if (includeDone) return;
    if (siteId && doneContracts.some((c) => String(c.id) === siteId)) {
      setSiteId(activeContracts.length ? String(activeContracts[0].id) : "");
    }
  }, [includeDone, siteId, doneContracts, activeContracts]);

  const load = useCallback(async () => {
    if (!siteId) return setItems([]);
    const r = await fetch(`/api/sheet-areas?contractId=${siteId}`, { cache: "no-store" });
    if (r.ok) setItems(await r.json());
  }, [siteId]);

  useEffect(() => {
    load();
  }, [load]);

  const flash = (m: string) => {
    setMsg(m);
    setTimeout(() => setMsg(""), 2500);
  };

  // 입력 중 실시간 면적 미리보기
  const previewInput = {
    width: n(form.width),
    widthFlange: n(form.widthFlange),
    widthWing: n(form.widthWing),
    height: n(form.height),
    heightFlange: n(form.heightFlange),
    heightWing: n(form.heightWing),
    qty: n(form.qty),
  };
  const preview = sheetArea(previewInput);
  const exp = expandedSize(previewInput);

  const add = async () => {
    if (!siteId) return flash("현장을 선택하세요.");
    if (!form.location.trim()) return flash("공사 위치를 입력하세요.");
    const r = await fetch("/api/sheet-areas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contractId: Number(siteId), ...form }),
    });
    if (!r.ok) return flash((await r.json()).error || "저장 실패");
    // 위치는 유지 → 같은 위치 연속 입력 편의
    setForm({ ...EMPTY, location: form.location, qty: "1" });
    load();
  };

  const remove = async (id: number) => {
    if (!confirm("이 항목을 삭제하시겠습니까?")) return;
    await fetch(`/api/sheet-areas/${id}`, { method: "DELETE" });
    load();
  };

  const patch = async (id: number, body: Record<string, unknown>) => {
    await fetch(`/api/sheet-areas/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    load();
  };

  // 위치별 그룹
  const groups = useMemo(() => {
    const m = new Map<string, Item[]>();
    for (const it of items) {
      if (!m.has(it.location)) m.set(it.location, []);
      m.get(it.location)!.push(it);
    }
    return [...m.entries()];
  }, [items]);
  const total = items.reduce((s, i) => s + i.area, 0);
  const locations = [...new Set(items.map((i) => i.location))];

  const site = allContracts.find((c) => String(c.id) === siteId);
  const viewingDone = !!site && isDone(site);

  return (
    <div className="space-y-3">
      {/* 현장 선택 */}
      <div className="card p-3 flex flex-wrap items-end gap-3">
        <div className="min-w-[300px] flex-1">
          <label className="label">
            현장 {includeDone ? "(준공 현장 포함)" : "(진행 중 현장)"}
          </label>
          <select className="input" value={siteId} onChange={(e) => setSiteId(e.target.value)}>
            {selectable.length === 0 && <option value="">선택 가능한 현장이 없습니다</option>}
            {activeContracts.length > 0 && (
              <optgroup label="진행 중">
                {activeContracts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.siteName} ({c.builderName})
                    {c.endDate ? ` · 준공 ${ymd(c.endDate)}` : ""}
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
          <input
            type="checkbox"
            checked={includeDone}
            onChange={(e) => setIncludeDone(e.target.checked)}
          />
          준공 현장 포함
          <span className="text-xs text-slate-400">({doneContracts.length})</span>
        </label>
        <a
          href={`/api/sheet-areas/export?contractId=${siteId}`}
          className={`btn-ghost ${!siteId || items.length === 0 ? "pointer-events-none opacity-50" : ""}`}
          download
        >
          <Download className="w-4 h-4" /> 엑셀 다운로드
        </a>
        <div className="ml-auto text-sm text-slate-500">
          총 <b className="text-slate-800">{items.length}</b>건 · 총 면적{" "}
          <b className="text-blue-700 text-base">{total.toFixed(3)}</b> ㎡
        </div>
      </div>

      {/* 준공 현장 이력 조회 안내 */}
      {viewingDone && (
        <div className="card p-3 bg-amber-50 border-amber-200 text-sm text-amber-800 flex items-center gap-2">
          <MapPin className="w-4 h-4 shrink-0" />
          <span>
            <b>준공 완료 현장</b>의 과거 이력을 조회 중입니다 (준공 {ymd(site!.endDate!)}). 내용 수정·추가도 가능합니다.
          </span>
        </div>
      )}

      {/* 입력 */}
      <div className="card p-4">
        <div className="flex items-center gap-2 mb-3 text-slate-700 font-semibold text-sm">
          <Plus className="w-4 h-4 text-blue-600" /> 시트 면적 입력
          <span className="text-xs font-normal text-slate-400">
            (가로+가로후렌지+가로날개) × (세로+세로후렌지+세로날개) × 개수 ÷ 1,000,000
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-2">
          <div>
            <label className="label">공사 위치 *</label>
            <input
              className="input"
              list="sheet-locations"
              placeholder="예: 지하주차장 / 부속동"
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
            />
            <datalist id="sheet-locations">
              {locations.map((l) => (
                <option key={l} value={l} />
              ))}
            </datalist>
          </div>
          <div className="md:col-span-3">
            <label className="label">항목명 (옵션)</label>
            <input
              className="input"
              placeholder="세부 항목·비고"
              value={form.itemName}
              onChange={(e) => setForm({ ...form, itemName: e.target.value })}
            />
          </div>
        </div>

        <div className="grid grid-cols-3 md:grid-cols-7 gap-2 items-end">
          {[
            ["가로", "width"],
            ["가로후렌지", "widthFlange"],
            ["가로날개", "widthWing"],
            ["세로", "height"],
            ["세로후렌지", "heightFlange"],
            ["세로날개", "heightWing"],
          ].map(([label, key]) => (
            <div key={key}>
              <label className="label">{label}</label>
              <input
                type="number"
                step="1"
                className="input text-right"
                placeholder="mm"
                value={form[key as keyof typeof form]}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                onKeyDown={(e) => e.key === "Enter" && add()}
              />
            </div>
          ))}
          <div>
            <label className="label">개수</label>
            <input
              type="number"
              step="1"
              className="input text-right"
              value={form.qty}
              onChange={(e) => setForm({ ...form, qty: e.target.value })}
              onKeyDown={(e) => e.key === "Enter" && add()}
            />
          </div>
        </div>

        <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
          <p className="text-sm text-slate-500">
            전개 치수 <b className="text-slate-700">{exp.w.toLocaleString()}</b> ×{" "}
            <b className="text-slate-700">{exp.h.toLocaleString()}</b> mm · 산출 면적{" "}
            <b className="text-blue-700 text-base">{preview.toFixed(3)}</b> ㎡
          </p>
          <div className="flex items-center gap-2">
            {msg && <span className="text-sm text-blue-700 font-semibold">{msg}</span>}
            <button className="btn-primary" onClick={add}>
              <Plus className="w-4 h-4" /> 추가
            </button>
          </div>
        </div>
      </div>

      {/* 이력 (위치별) */}
      {items.length === 0 ? (
        <div className="card p-10 text-center text-slate-400">
          <Square className="w-8 h-8 mx-auto mb-2 text-slate-300" />
          {site ? `${site.siteName}에 등록된 산출 내역이 없습니다.` : "현장을 선택하세요."}
        </div>
      ) : (
        groups.map(([loc, list]) => {
          const sub = list.reduce((s, i) => s + i.area, 0);
          return (
            <div key={loc} className="card overflow-x-auto">
              <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <span className="font-bold text-sm text-slate-700 flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-slate-400" />
                  {loc}
                  <span className="text-slate-400 font-normal">({list.length}건)</span>
                </span>
                <span className="text-sm text-slate-500">
                  소계 <b className="text-blue-700">{sub.toFixed(3)}</b> ㎡
                </span>
              </div>
              <table className="w-full min-w-[900px]">
                <thead>
                  <tr>
                    <th className="th">항목</th>
                    <th className="th text-right w-24">가로</th>
                    <th className="th text-right w-24">가로후렌지</th>
                    <th className="th text-right w-24">가로날개</th>
                    <th className="th text-right w-24">세로</th>
                    <th className="th text-right w-24">세로후렌지</th>
                    <th className="th text-right w-24">세로날개</th>
                    <th className="th text-right w-20">개수</th>
                    <th className="th text-right w-28">면적(㎡)</th>
                    <th className="th w-12"></th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((it) => (
                    <ItemRow key={`${it.id}:${it.area}`} item={it} onPatch={patch} onRemove={remove} />
                  ))}
                </tbody>
              </table>
            </div>
          );
        })
      )}

      {items.length > 0 && (
        <div className="card p-3 flex justify-between items-center bg-blue-50/40">
          <span className="font-bold text-slate-700">
            총 합계 <span className="text-slate-400 font-normal">({items.length}건 · {groups.length}개 위치)</span>
          </span>
          <span className="font-bold text-blue-800 text-lg">{total.toFixed(3)} ㎡</span>
        </div>
      )}
    </div>
  );
}

function ItemRow({
  item,
  onPatch,
  onRemove,
}: {
  item: Item;
  onPatch: (id: number, b: Record<string, unknown>) => void;
  onRemove: (id: number) => void;
}) {
  const [f, setF] = useState({
    itemName: item.itemName ?? "",
    width: String(item.width),
    widthFlange: String(item.widthFlange),
    widthWing: String(item.widthWing),
    height: String(item.height),
    heightFlange: String(item.heightFlange),
    heightWing: String(item.heightWing),
    qty: String(item.qty),
  });
  const live = sheetArea({
    width: n(f.width),
    widthFlange: n(f.widthFlange),
    widthWing: n(f.widthWing),
    height: n(f.height),
    heightFlange: n(f.heightFlange),
    heightWing: n(f.heightWing),
    qty: n(f.qty),
  });
  const dirty =
    f.itemName !== (item.itemName ?? "") ||
    Math.abs(live - item.area) > 1e-9;

  const save = () => onPatch(item.id, f);
  const inp = "input py-1 text-right";

  return (
    <tr className="hover:bg-slate-50 group">
      <td className="td">
        <input className="input py-1" value={f.itemName} onChange={(e) => setF({ ...f, itemName: e.target.value })} onBlur={() => dirty && save()} />
      </td>
      {(["width", "widthFlange", "widthWing", "height", "heightFlange", "heightWing", "qty"] as const).map((k) => (
        <td className="td" key={k}>
          <input type="number" className={inp} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} onBlur={() => dirty && save()} />
        </td>
      ))}
      <td className="td text-right font-semibold text-blue-700">{live.toFixed(3)}</td>
      <td className="td text-right whitespace-nowrap">
        {dirty ? (
          <button className="text-blue-600 hover:text-blue-800" onClick={save} title="저장">
            <Save className="w-4 h-4" />
          </button>
        ) : (
          <button className="text-slate-300 hover:text-red-500" onClick={() => onRemove(item.id)} title="삭제">
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </td>
    </tr>
  );
}
