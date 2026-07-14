"use client";

import { Suspense } from "react";
import LaborClient from "./LaborClient";

export default function LaborPage() {
  return (
    <Suspense fallback={<p className="text-slate-400 p-6">불러오는 중…</p>}>
      <LaborClient />
    </Suspense>
  );
}
