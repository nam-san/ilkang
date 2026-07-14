"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Save, Trash2, Users } from "lucide-react";
import { won, ymd, warrantyEndYmd, WARRANTY_YEARS } from "@/lib/format";

type Contract = {
  id: number;
  siteName: string;
  startDate: string | null;
  endDate: string | null;
  builderName: string;
  contractAmount: number;
  manager: string | null;
  warrantyPeriod: string | null;
};

export default function ContractDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [c, setC] = useState<Contract | null>(null);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetch(`/api/contracts/${id}`, { cache: "no-store" }).then(async (r) => {
      if (r.ok) {
        const data = await r.json();
        setC({
          ...data,
          startDate: data.startDate ? ymd(data.startDate) : "",
          endDate: data.endDate ? ymd(data.endDate) : "",
        });
      }
    });
  }, [id]);

  if (!c) return <p className="text-slate-400 p-6">불러오는 중…</p>;

  const set = (k: keyof Contract, v: string | number) => setC({ ...c, [k]: v });

  const save = async () => {
    const res = await fetch(`/api/contracts/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(c),
    });
    setMsg(res.ok ? "저장되었습니다." : "저장 실패");
    setTimeout(() => setMsg(""), 2000);
  };

  const remove = async () => {
    if (!confirm("이 수주내역을 삭제하시겠습니까? 관련 투입/근무일지도 함께 삭제됩니다.")) return;
    await fetch(`/api/contracts/${id}`, { method: "DELETE" });
    router.push("/contracts");
  };

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex items-center justify-between">
        <Link href="/contracts" className="btn-ghost">
          <ArrowLeft className="w-4 h-4" /> 목록
        </Link>
        <div className="flex gap-2">
          <Link href={`/labor?site=${c.id}`} className="btn-primary">
            <Users className="w-4 h-4" /> 인력 투입 관리
          </Link>
          <button className="btn-danger" onClick={remove}>
            <Trash2 className="w-4 h-4" /> 삭제
          </button>
        </div>
      </div>

      <div className="card p-6 space-y-4">
        <div className="flex items-baseline justify-between border-b border-slate-100 pb-3">
          <h1 className="text-2xl font-bold text-slate-800">{c.siteName || "현장"}</h1>
          <span className="text-sm text-slate-500">{c.builderName}</span>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="현장명 (공사명)">
            <input className="input" value={c.siteName} onChange={(e) => set("siteName", e.target.value)} />
          </Field>
          <Field label="건설사 (발주처)">
            <input className="input" value={c.builderName} onChange={(e) => set("builderName", e.target.value)} />
          </Field>
          <Field label="착공일">
            <input type="date" className="input" value={c.startDate ?? ""} onChange={(e) => set("startDate", e.target.value)} />
          </Field>
          <Field label="준공일">
            <input type="date" className="input" value={c.endDate ?? ""} onChange={(e) => set("endDate", e.target.value)} />
          </Field>
          <Field label="도급액 (원)">
            <input type="number" className="input" value={c.contractAmount} onChange={(e) => set("contractAmount", Number(e.target.value))} />
            <p className="text-xs text-slate-400 mt-1">{won(c.contractAmount)} 원</p>
          </Field>
          <Field label="자사 담당자">
            <input className="input" value={c.manager ?? ""} onChange={(e) => set("manager", e.target.value)} />
          </Field>
          <Field label={`하자보수기간 (품질보증기간) — 준공일 기준 자동 ${WARRANTY_YEARS}년`}>
            <div className="input bg-slate-50 text-slate-600 flex items-center">
              {c.endDate ? (
                <>
                  준공 후 {WARRANTY_YEARS}년 ·{" "}
                  <b className="ml-1 text-slate-800">~ {warrantyEndYmd(c.endDate)}</b>
                </>
              ) : (
                <span className="text-slate-400">준공일을 입력하면 자동 계산됩니다.</span>
              )}
            </div>
          </Field>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          {msg && <span className="text-sm text-green-600">{msg}</span>}
          <button className="btn-primary" onClick={save}>
            <Save className="w-4 h-4" /> 저장
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
    </div>
  );
}
