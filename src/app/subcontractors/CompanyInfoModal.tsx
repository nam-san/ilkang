"use client";

import { X, Building2, Phone, Mail, MapPin, User, Hash, StickyNote, Tag } from "lucide-react";

export type Company = {
  id: number;
  name: string;
  bizNumber: string | null;
  ceo: string | null;
  phone: string | null;
  email: string | null;
  category: string | null;
  address: string | null;
  note: string | null;
};

function Row({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | null;
}) {
  return (
    <div className="flex items-start gap-2 py-2 border-b border-slate-100 last:border-0">
      <Icon className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
      <span className="w-24 shrink-0 text-xs text-slate-500 mt-0.5">{label}</span>
      <span className="text-sm text-slate-800 break-words">{value || "-"}</span>
    </div>
  );
}

export default function CompanyInfoModal({
  name,
  company,
  onClose,
}: {
  name: string;
  company: Company | null;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="card w-full max-w-md p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-lg flex items-center gap-2">
            <Building2 className="w-5 h-5 text-blue-600" />
            {name}
          </h2>
          <button onClick={onClose}>
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {company ? (
          <div>
            <Row icon={Tag} label="전문분야" value={company.category} />
            <Row icon={User} label="대표자" value={company.ceo} />
            <Row icon={Phone} label="연락처" value={company.phone} />
            <Row icon={Hash} label="사업자번호" value={company.bizNumber} />
            <Row icon={Mail} label="이메일" value={company.email} />
            <Row icon={MapPin} label="주소" value={company.address} />
            <Row icon={StickyNote} label="비고" value={company.note} />
          </div>
        ) : (
          <div className="py-6 text-center">
            <Building2 className="w-8 h-8 mx-auto mb-2 text-slate-300" />
            <p className="text-sm text-slate-500">
              &lsquo;{name}&rsquo; 업체의 등록된 정보가 없습니다.
            </p>
            <p className="text-xs text-slate-400 mt-1">
              상단 &lsquo;업체 정보&rsquo; 탭에서 업체를 등록하면 여기에 표시됩니다.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
