"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { ymdhm } from "@/lib/format";

export default function SharedMemo() {
  const [content, setContent] = useState("");
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [saved, setSaved] = useState(true);
  const focused = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  const load = useCallback(async () => {
    // 편집 중일 때는 덮어쓰지 않음 (충돌 방지)
    if (focused.current) return;
    const res = await fetch("/api/memo", { cache: "no-store" });
    if (res.ok) {
      const m = await res.json();
      setContent(m.content ?? "");
      setUpdatedAt(m.updatedAt ?? null);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 4000); // 주기적 폴링으로 실시간 동기화
    return () => clearInterval(t);
  }, [load]);

  const save = useCallback(async (text: string) => {
    const res = await fetch("/api/memo", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: text }),
    });
    if (res.ok) {
      const m = await res.json();
      setUpdatedAt(m.updatedAt ?? null);
      setSaved(true);
    }
  }, []);

  const onChange = (v: string) => {
    setContent(v);
    setSaved(false);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => save(v), 700); // 디바운스 자동저장
  };

  return (
    <div className="card flex flex-col h-full overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 rounded-t-xl flex items-center justify-between">
        <h2 className="font-bold text-sm text-slate-700">📝 공용 메모장</h2>
        <span className="text-[11px] text-slate-400">
          {saved ? (updatedAt ? `저장됨 · ${ymdhm(updatedAt)}` : "") : "입력중…"}
        </span>
      </div>
      <textarea
        className="flex-1 w-full resize-none p-4 text-sm outline-none leading-relaxed"
        placeholder="현장 특이사항, 공유 메모를 자유롭게 입력하세요. (모든 팀원 실시간 공유)"
        value={content}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => (focused.current = true)}
        onBlur={() => {
          focused.current = false;
          load();
        }}
      />
    </div>
  );
}
