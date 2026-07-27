"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { ymdhm, addDays, todayYmd } from "@/lib/format";

export default function SharedMemo({
  date,
  onDateChange,
}: {
  date: string;
  onDateChange: (d: string) => void;
}) {
  const [content, setContent] = useState("");
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [saved, setSaved] = useState(true);
  const focused = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const dateRef = useRef(date);
  dateRef.current = date;

  const today = todayYmd();
  const isToday = date === today;

  const load = useCallback(
    async (force = false) => {
      // 편집 중일 때는 덮어쓰지 않음 (충돌 방지)
      if (focused.current && !force) return;
      const res = await fetch(`/api/memo?date=${date}`, { cache: "no-store" });
      if (res.ok) {
        const m = await res.json();
        // 응답 도착 사이에 날짜가 바뀌었으면 무시
        if (dateRef.current !== date) return;
        setContent(m.content ?? "");
        setUpdatedAt(m.updatedAt ?? null);
        setSaved(true);
      }
    },
    [date]
  );

  // 날짜가 바뀌면 즉시 로드 (편집 중이어도 강제)
  useEffect(() => {
    clearTimeout(timer.current);
    load(true);
  }, [load]);

  // 실시간 동기화 폴링
  useEffect(() => {
    const t = setInterval(() => load(), 4000);
    return () => clearInterval(t);
  }, [load]);

  const save = useCallback(
    async (text: string, forDate: string) => {
      const res = await fetch("/api/memo", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: forDate, content: text }),
      });
      if (res.ok) {
        const m = await res.json();
        if (dateRef.current === forDate) {
          setUpdatedAt(m.updatedAt ?? null);
          setSaved(true);
        }
      }
    },
    []
  );

  const onChange = (v: string) => {
    setContent(v);
    setSaved(false);
    const forDate = date;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => save(v, forDate), 700); // 디바운스 자동저장
  };

  const move = (n: number) => {
    clearTimeout(timer.current);
    if (!saved) save(content, date); // 이동 전 저장
    onDateChange(addDays(date, n));
  };

  return (
    <div className="card flex flex-col h-full overflow-hidden">
      <div className="px-3 py-2.5 border-b border-slate-200 bg-slate-50 rounded-t-xl">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-bold text-sm text-slate-700 shrink-0">📝 공용 메모장</h2>
          <span className="text-[11px] text-slate-400 truncate">
            {saved ? (updatedAt ? `저장됨 · ${ymdhm(updatedAt)}` : "") : "입력중…"}
          </span>
        </div>
        {/* 날짜 이동 (캘린더 연동) */}
        <div className="flex items-center gap-1 mt-1.5">
          <button
            onClick={() => move(-1)}
            className="p-1 rounded hover:bg-slate-200 text-slate-500"
            title="이전 날짜"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <input
            type="date"
            className="input py-0.5 text-xs flex-1"
            value={date}
            onChange={(e) => e.target.value && onDateChange(e.target.value)}
          />
          <button
            onClick={() => move(1)}
            className="p-1 rounded hover:bg-slate-200 text-slate-500"
            title="다음 날짜"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            onClick={() => onDateChange(today)}
            className={`px-2 py-0.5 rounded text-[11px] font-semibold shrink-0 ${
              isToday
                ? "bg-blue-100 text-blue-700"
                : "bg-slate-200 text-slate-600 hover:bg-slate-300"
            }`}
            title="오늘 메모로"
          >
            오늘
          </button>
        </div>
        {!isToday && (
          <p className="text-[11px] text-amber-600 mt-1 flex items-center gap-1">
            <CalendarDays className="w-3 h-3" /> 과거/예정 날짜 메모를 보고 있습니다.
          </p>
        )}
      </div>
      <textarea
        className="flex-1 w-full resize-none p-4 text-sm outline-none leading-relaxed"
        placeholder={`${date} 메모를 입력하세요. (날짜별로 저장되어 캘린더에서 다시 볼 수 있습니다)`}
        value={content}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => (focused.current = true)}
        onBlur={() => {
          focused.current = false;
          if (!saved) {
            clearTimeout(timer.current);
            save(content, date);
          }
        }}
      />
    </div>
  );
}
