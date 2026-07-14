"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { UploadCloud, AlertTriangle, Trash2 } from "lucide-react";
import type { Project } from "./page";

type Line = {
  id: number;
  code: string | null;
  itemName: string;
  isGroup: boolean;
  spec: string | null;
  unit: string | null;
  quantity: number;
  windowTypeId: number | null;
  widthMm: number | null;
  heightMm: number | null;
  parseWarning: boolean;
};

export default function LinesTab({
  project,
  reloadProject,
}: {
  project: Project;
  reloadProject: () => void;
}) {
  const [lines, setLines] = useState<Line[]>([]);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [replace, setReplace] = useState(true);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const r = await fetch(`/api/estimate-lines?projectId=${project.id}`, { cache: "no-store" });
    if (r.ok) setLines(await r.json());
  }, [project.id]);

  useEffect(() => {
    load();
  }, [load]);

  const upload = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) return setMsg("엑셀 파일을 선택하세요.");
    setBusy(true);
    setMsg("");
    const fd = new FormData();
    fd.append("file", file);
    fd.append("replace", String(replace));
    const r = await fetch(`/api/estimate-projects/${project.id}/import-excel`, { method: "POST", body: fd });
    const d = await r.json();
    setBusy(false);
    if (!r.ok) return setMsg(d.error || "업로드 실패");
    setMsg(`✅ ${d.count}개 라인 등록 · 창호유형 자동추천 ${d.recommended}건 · 규격 파싱실패 ${d.warnings}건`);
    if (fileRef.current) fileRef.current.value = "";
    load();
    reloadProject();
  };

  const patch = async (id: number, body: Record<string, unknown>) => {
    await fetch(`/api/estimate-lines/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    load();
  };

  const remove = async (id: number) => {
    await fetch(`/api/estimate-lines/${id}`, { method: "DELETE" });
    load();
  };

  const warnCount = lines.filter((l) => l.parseWarning).length;
  const noTypeCount = lines.filter((l) => !l.isGroup && !l.windowTypeId).length;

  return (
    <div className="space-y-4">
      {/* 업로드 */}
      <div className="card p-4">
        <div className="flex items-center gap-2 mb-3 text-slate-700 font-semibold text-sm">
          <UploadCloud className="w-4 h-4 text-blue-600" /> 견적 엑셀 업로드 (A~N 파싱)
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="input py-1.5 flex-1 min-w-[220px]" />
          <label className="flex items-center gap-1.5 text-sm text-slate-600">
            <input type="checkbox" checked={replace} onChange={(e) => setReplace(e.target.checked)} />
            기존 라인 교체
          </label>
          <button className="btn-primary" onClick={upload} disabled={busy}>
            <UploadCloud className="w-4 h-4" /> {busy ? "처리중…" : "업로드 & 파싱"}
          </button>
        </div>
        <p className="text-xs text-slate-400 mt-2">
          품명(B)·규격(C)·단위(D)·수량(E)·단가(F~H)·비고(N)를 읽어 라인 생성 → 규격에서 W/H 자동 파싱 + 창호유형 자동추천.
        </p>
        {msg && <p className="text-sm mt-2 text-slate-700">{msg}</p>}
      </div>

      {lines.length > 0 && (
        <div className="flex gap-3 text-sm">
          <span className="text-slate-500">총 <b>{lines.length}</b>라인</span>
          {warnCount > 0 && <span className="text-red-600 font-semibold inline-flex items-center gap-1"><AlertTriangle className="w-4 h-4" /> 규격 파싱실패 {warnCount}</span>}
          {noTypeCount > 0 && <span className="text-amber-600 font-semibold">창호유형 미지정 {noTypeCount}</span>}
        </div>
      )}

      {/* 라인 테이블 */}
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[920px]">
          <thead>
            <tr>
              <th className="th w-10">#</th>
              <th className="th">품명</th>
              <th className="th">규격</th>
              <th className="th text-right w-20">수량</th>
              <th className="th text-right w-24">W(mm)</th>
              <th className="th text-right w-24">H(mm)</th>
              <th className="th w-48">창호유형</th>
              <th className="th w-12"></th>
            </tr>
          </thead>
          <tbody>
            {lines.length === 0 && (
              <tr><td className="td text-center text-slate-400 py-8" colSpan={8}>업로드된 라인이 없습니다.</td></tr>
            )}
            {lines.map((l, i) =>
              l.isGroup ? (
                <tr key={l.id} className="bg-slate-100">
                  <td className="td text-slate-400">{i + 1}</td>
                  <td className="td font-bold text-slate-700" colSpan={7}>{l.itemName}</td>
                </tr>
              ) : (
                <tr key={l.id} className={l.parseWarning ? "bg-red-50" : "hover:bg-slate-50"}>
                  <td className="td text-slate-400">{i + 1}</td>
                  <td className="td font-medium">{l.itemName}</td>
                  <td className="td text-slate-500 text-xs max-w-[220px] truncate" title={l.spec ?? ""}>
                    {l.parseWarning && <AlertTriangle className="w-3.5 h-3.5 text-red-500 inline mr-1" />}
                    {l.spec || "-"}
                  </td>
                  <td className="td text-right">{l.quantity.toLocaleString()}</td>
                  <td className="td">
                    <input type="number" defaultValue={l.widthMm ?? ""} className="input py-1 text-right"
                      onBlur={(e) => { const v = e.target.value; if (v !== String(l.widthMm ?? "")) patch(l.id, { widthMm: v }); }} />
                  </td>
                  <td className="td">
                    <input type="number" defaultValue={l.heightMm ?? ""} className="input py-1 text-right"
                      onBlur={(e) => { const v = e.target.value; if (v !== String(l.heightMm ?? "")) patch(l.id, { heightMm: v }); }} />
                  </td>
                  <td className="td">
                    <select className="input py-1" value={l.windowTypeId ?? ""} onChange={(e) => patch(l.id, { windowTypeId: e.target.value || null })}>
                      <option value="">(미지정)</option>
                      {project.windowTypes.map((t) => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  </td>
                  <td className="td text-right">
                    <button className="text-slate-300 hover:text-red-500" onClick={() => remove(l.id)}><Trash2 className="w-4 h-4" /></button>
                  </td>
                </tr>
              )
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
