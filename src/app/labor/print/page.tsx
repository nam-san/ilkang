"use client";

import { Suspense } from "react";
import PrintClient from "./PrintClient";

export default function LogPrintPage() {
  return (
    <Suspense fallback={<p className="p-6 text-slate-400">불러오는 중…</p>}>
      <PrintClient />
    </Suspense>
  );
}
