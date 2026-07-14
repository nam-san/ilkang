"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Printer } from "lucide-react";
import { ymd } from "@/lib/format";

type Log = {
  id: number;
  date: string;
  category: string;
  imageUrl: string;
  note: string | null;
};

export default function PrintClient() {
  const sp = useSearchParams();
  const siteId = sp.get("site") || "";
  const month = sp.get("month") || "";
  // 카테고리 필터 (기본: 근무일지). "all" 이면 전체
  const cat = sp.get("cat") || "근무일지";

  const [siteName, setSiteName] = useState("");
  const [builderName, setBuilderName] = useState("");
  const [days, setDays] = useState<{ date: string; items: Log[] }[]>([]);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    if (!siteId || !month) return;
    const [cRes, lRes] = await Promise.all([
      fetch(`/api/contracts/${siteId}`, { cache: "no-store" }),
      fetch(`/api/logs?contractId=${siteId}&month=${month}`, { cache: "no-store" }),
    ]);
    if (cRes.ok) {
      const c = await cRes.json();
      setSiteName(c.siteName);
      setBuilderName(c.builderName);
    }
    let logs: Log[] = lRes.ok ? await lRes.json() : [];
    if (cat !== "all") logs = logs.filter((l) => (l.category || "근무일지") === cat);
    logs.sort((a, b) => a.date.localeCompare(b.date));
    // 날짜별 그룹 (1일 1페이지)
    const map = new Map<string, Log[]>();
    for (const l of logs) {
      const key = ymd(l.date);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(l);
    }
    const grouped = Array.from(map.entries())
      .map(([date, items]) => ({ date, items }))
      .sort((a, b) => a.date.localeCompare(b.date));
    setDays(grouped);
    setLoaded(true);
  }, [siteId, month, cat]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="print-root">
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @media print {
          header, .no-print { display: none !important; }
          main { padding: 0 !important; max-width: none !important; }
          .print-page { break-after: page; }
          .print-page:last-child { break-after: auto; }
        }
        @page { size: A4; margin: 12mm; }
      `,
        }}
      />

      {/* 화면용 툴바 (인쇄 시 숨김) */}
      <div className="no-print flex items-center justify-between mb-4 border-b border-slate-200 pb-3">
        <div>
          <h1 className="text-lg font-bold text-slate-800">근무일지 출력</h1>
          <p className="text-sm text-slate-500">
            {siteName} · {month} · {cat === "all" ? "전체" : cat} · 총 {days.length}일
          </p>
        </div>
        <button className="btn-primary" onClick={() => window.print()}>
          <Printer className="w-4 h-4" /> 인쇄 / PDF 저장
        </button>
      </div>

      {loaded && days.length === 0 && (
        <div className="no-print card p-10 text-center text-slate-400">
          {month}에 등록된 {cat === "all" ? "" : cat} 근무일지가 없습니다.
        </div>
      )}

      {/* 1일 1페이지 */}
      {days.map(({ date, items }) => (
        <div key={date} className="print-page bg-white p-2 mb-6 border border-slate-200 print:border-0 print:mb-0">
          <div className="flex items-baseline justify-between border-b-2 border-slate-800 pb-2 mb-3">
            <h2 className="text-xl font-bold text-slate-900">근 무 일 지</h2>
            <div className="text-right text-sm">
              <div className="font-semibold text-slate-800">{siteName}</div>
              <div className="text-slate-500">{builderName}</div>
            </div>
          </div>
          <div className="flex items-center justify-between mb-3 text-sm">
            <span className="font-bold text-slate-700 text-base">{date}</span>
            {items.length > 1 && (
              <span className="text-slate-400">{items.length}장</span>
            )}
          </div>
          <div className={items.length > 1 ? "grid grid-cols-2 gap-3" : ""}>
            {items.map((l) => (
              <div key={l.id}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={l.imageUrl}
                  alt={`${date} 근무일지`}
                  className="w-full object-contain border border-slate-200"
                  style={{ maxHeight: items.length > 1 ? "36vh" : "72vh" }}
                />
                {l.note && (
                  <p className="mt-1.5 text-sm text-slate-600">비고: {l.note}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
