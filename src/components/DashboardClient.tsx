"use client";

import { useState } from "react";
import DashboardCalendar from "@/components/DashboardCalendar";
import TodoList from "@/components/TodoList";
import SharedMemo from "@/components/SharedMemo";
import { todayYmd } from "@/lib/format";

export default function DashboardClient() {
  // 캘린더 ↔ 공용 메모장 연동용 선택 날짜 (기본: 오늘)
  const [memoDate, setMemoDate] = useState<string>(todayYmd());

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-4 lg:h-[calc(100vh-104px)] lg:min-h-[560px]">
      {/* 중앙/좌측: 메인 캘린더 */}
      <section className="min-h-[460px]">
        <DashboardCalendar onOpenMemo={setMemoDate} />
      </section>

      {/* 우측: 상단 TO-DO / 하단 공용 메모장 (상시 고정) */}
      <aside className="grid lg:grid-rows-2 gap-4 min-h-[700px] lg:min-h-0">
        <TodoList />
        <SharedMemo date={memoDate} onDateChange={setMemoDate} />
      </aside>
    </div>
  );
}
