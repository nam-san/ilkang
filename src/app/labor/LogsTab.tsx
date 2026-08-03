"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { ImagePlus, Trash2, Printer, UploadCloud, X, ZoomIn } from "lucide-react";
import { ymd, todayYmd } from "@/lib/format";
import type { Contract } from "./LaborClient";

type Log = {
  id: number;
  date: string;
  category: string;
  imageUrl: string;
  note: string | null;
};
type Pending = { file: File; date: string; preview: string };

const CATEGORIES = [
  { key: "근무일지", required: true, color: "bg-blue-100 text-blue-700" },
  { key: "작업사진", required: false, color: "bg-green-100 text-green-700" },
  { key: "기타", required: false, color: "bg-slate-200 text-slate-600" },
] as const;

/** 파일명에서 날짜 추출 (20260715, 2026-07-15, 2026_07_15 등) */
function guessDate(name: string, month: string): string {
  const m1 = name.match(/(20\d{2})[-_.]?(\d{2})[-_.]?(\d{2})/);
  if (m1) {
    const d = `${m1[1]}-${m1[2]}-${m1[3]}`;
    if (!isNaN(new Date(`${d}T00:00:00`).getTime())) return d;
  }
  // 파일명에 일자만 있는 경우 (예: 15.jpg, 사진_15)
  const m2 = name.match(/(?:^|[^\d])(\d{1,2})(?:[^\d]|$)/);
  if (m2 && month) {
    const day = Number(m2[1]);
    if (day >= 1 && day <= 31) return `${month}-${String(day).padStart(2, "0")}`;
  }
  return "";
}

export default function LogsTab({ contracts }: { contracts: Contract[] }) {
  const [siteId, setSiteId] = useState("");
  const [month, setMonth] = useState(() => todayYmd().slice(0, 7));
  const [category, setCategory] = useState<string>("근무일지");
  const [logs, setLogs] = useState<Log[]>([]);
  const [pending, setPending] = useState<Pending[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!siteId && contracts.length) setSiteId(String(contracts[0].id));
  }, [contracts, siteId]);

  const load = useCallback(async () => {
    if (!siteId) return;
    const r = await fetch(`/api/logs?contractId=${siteId}&month=${month}`, { cache: "no-store" });
    if (r.ok) setLogs(await r.json());
  }, [siteId, month]);

  useEffect(() => {
    load();
  }, [load]);

  const flash = (m: string) => {
    setMsg(m);
    setTimeout(() => setMsg(""), 3000);
  };

  /** 파일 선택 → 날짜 자동 추정 후 목록에 담기 */
  const onPick = (files: FileList | null) => {
    if (!files) return;
    const list: Pending[] = Array.from(files).map((f) => ({
      file: f,
      date: guessDate(f.name, month) || "",
      preview: URL.createObjectURL(f),
    }));
    setPending((prev) => [...prev, ...list]);
    if (fileRef.current) fileRef.current.value = "";
  };

  const setPendingDate = (i: number, date: string) =>
    setPending((p) => p.map((x, idx) => (idx === i ? { ...x, date } : x)));

  const removePending = (i: number) =>
    setPending((p) => p.filter((_, idx) => idx !== i));

  /** 남은 빈 날짜를 1일부터 순차 배정 */
  const autoFillDates = () => {
    let day = 1;
    setPending((p) =>
      p.map((x) => {
        if (x.date) return x;
        const d = `${month}-${String(day).padStart(2, "0")}`;
        day = Math.min(day + 1, 31);
        return { ...x, date: d };
      })
    );
  };

  const uploadAll = async () => {
    if (!siteId) return flash("현장을 선택하세요.");
    if (pending.length === 0) return flash("업로드할 사진을 선택하세요.");
    const missing = pending.filter((p) => !p.date).length;
    if (missing) return flash(`날짜가 지정되지 않은 사진이 ${missing}장 있습니다.`);

    setBusy(true);
    const fd = new FormData();
    fd.append("contractId", siteId);
    fd.append("category", category);
    fd.append("dates", JSON.stringify(pending.map((p) => p.date)));
    for (const p of pending) fd.append("files", p.file);
    const res = await fetch("/api/logs/batch", { method: "POST", body: fd });
    const d = await res.json();
    setBusy(false);
    if (res.ok) {
      flash(`✅ ${category} ${d.count}장 업로드 완료${d.failed?.length ? ` (실패 ${d.failed.length})` : ""}`);
      pending.forEach((p) => URL.revokeObjectURL(p.preview));
      setPending([]);
      load();
    } else {
      flash(d.error || "업로드 실패");
    }
  };

  const removeLog = async (id: number) => {
    if (!confirm("이 사진을 삭제하시겠습니까?")) return;
    await fetch(`/api/logs/${id}`, { method: "DELETE" });
    load();
  };

  const shown = logs.filter((l) => (l.category || "근무일지") === category);
  const counts = CATEGORIES.map((c) => ({
    ...c,
    n: logs.filter((l) => (l.category || "근무일지") === c.key).length,
  }));

  return (
    <div className="space-y-3">
      {/* 현장 · 근무월 선택 */}
      <div className="card p-3 flex flex-wrap items-end gap-3">
        <div className="min-w-[240px] flex-1">
          <label className="label">현장</label>
          <select className="input" value={siteId} onChange={(e) => setSiteId(e.target.value)}>
            {contracts.length === 0 && <option value="">등록된 현장 없음</option>}
            {contracts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.siteName} ({c.builderName})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">근무월</label>
          <input type="month" className="input w-44" value={month} onChange={(e) => setMonth(e.target.value)} />
        </div>
        <a
          href={`/labor/print?site=${siteId}&month=${month}`}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-primary"
          title="근무일지를 날짜순 1일 1장으로 일괄 출력"
        >
          <Printer className="w-4 h-4" /> 근무일지 일괄 출력
        </a>
      </div>

      {/* 카테고리 (별도 운영) */}
      <div className="flex gap-1">
        {counts.map((c) => (
          <button
            key={c.key}
            onClick={() => setCategory(c.key)}
            className={`px-3.5 py-2 rounded-lg text-sm font-semibold border transition-colors ${
              category === c.key
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
            }`}
          >
            {c.key}
            {c.required && <span className={category === c.key ? "text-blue-100" : "text-red-500"}> *</span>}
            <span className={`ml-1.5 text-xs ${category === c.key ? "text-blue-100" : "text-slate-400"}`}>
              {c.n}
            </span>
          </button>
        ))}
      </div>

      {/* 묶음 업로드 */}
      <div className="card p-4">
        <div className="flex items-center gap-2 mb-3 text-slate-700 font-semibold text-sm">
          <UploadCloud className="w-4 h-4 text-blue-600" /> {category} 묶음 업로드
          <span className="text-xs font-normal text-slate-400">
            여러 장을 한 번에 선택 → 날짜 확인 후 업로드
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            className="input py-1.5 flex-1 min-w-[240px]"
            onChange={(e) => onPick(e.target.files)}
          />
          {pending.length > 0 && (
            <>
              <button className="btn-ghost" onClick={autoFillDates}>
                날짜 자동채움
              </button>
              <button className="btn-primary" onClick={uploadAll} disabled={busy}>
                <ImagePlus className="w-4 h-4" /> {busy ? "업로드중…" : `${pending.length}장 업로드`}
              </button>
            </>
          )}
        </div>
        <p className="text-xs text-slate-400 mt-2">
          파일명에 날짜(예: 20260715, 2026-07-15)가 있으면 자동 인식합니다. 없으면 직접 지정하거나 &lsquo;날짜 자동채움&rsquo;을 사용하세요.
        </p>

        {/* 업로드 대기 목록 */}
        {pending.length > 0 && (
          <div className="mt-3 grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {pending.map((p, i) => (
              <div key={i} className="flex items-center gap-2 border border-slate-200 rounded-lg p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.preview} alt={p.file.name} className="w-12 h-12 object-cover rounded shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] text-slate-500 truncate" title={p.file.name}>
                    {p.file.name}
                  </p>
                  <input
                    type="date"
                    className={`input py-1 text-xs mt-1 ${p.date ? "" : "border-red-300"}`}
                    value={p.date}
                    onChange={(e) => setPendingDate(i, e.target.value)}
                  />
                </div>
                <button className="text-slate-300 hover:text-red-500 shrink-0" onClick={() => removePending(i)}>
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {msg && <p className="text-sm mt-3 text-slate-700 font-semibold">{msg}</p>}
      </div>

      {/* 등록된 사진 */}
      <div className="card p-3">
        <div className="text-xs font-semibold text-slate-500 mb-2">
          {month} · {category} ({shown.length}장)
        </div>
        {shown.length === 0 ? (
          <p className="text-center text-sm text-slate-400 py-6">등록된 사진이 없습니다.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">
            {[...shown]
              .sort((a, b) => ymd(a.date).localeCompare(ymd(b.date)))
              .map((l) => (
                <div key={l.id} className="relative group border border-slate-200 rounded-lg overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={l.imageUrl}
                    alt={category}
                    className="w-full h-28 object-cover cursor-zoom-in"
                    onClick={() => setPreview(l.imageUrl)}
                  />
                  <div className="px-1.5 py-1 text-[11px] text-slate-600 bg-white font-semibold">{ymd(l.date)}</div>
                  <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100">
                    <button
                      className="bg-white/90 rounded p-1 text-slate-500 hover:text-blue-600 shadow"
                      onClick={() => setPreview(l.imageUrl)}
                    >
                      <ZoomIn className="w-3.5 h-3.5" />
                    </button>
                    <button
                      className="bg-white/90 rounded p-1 text-slate-500 hover:text-red-500 shadow"
                      onClick={() => removeLog(l.id)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>

      {/* 확대 팝업 */}
      {preview && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-6"
          onClick={() => setPreview(null)}
        >
          <button className="absolute top-4 right-4 text-white/80 hover:text-white" onClick={() => setPreview(null)}>
            <X className="w-7 h-7" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview}
            alt="사진 확대"
            className="max-w-full max-h-full object-contain rounded shadow-2xl bg-white"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
