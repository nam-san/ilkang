"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Plus,
  Save,
  Trash2,
  UploadCloud,
  Pencil,
  X,
  Building2,
} from "lucide-react";
import { won, ymd } from "@/lib/format";

type Item = {
  id: number;
  itemName: string;
  spec: string | null;
  quantity: number;
  unit: string | null;
  unitPrice: number | null;
};
type Bid = {
  id: number;
  builderName: string;
  siteName: string;
  startDate: string | null;
  endDate: string | null;
  dueDate: string | null;
  items: Item[];
};

export default function BidDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [bid, setBid] = useState<Bid | null>(null);
  const [msg, setMsg] = useState("");
  const [editBid, setEditBid] = useState(false);

  // 새 항목 입력
  const [newItem, setNewItem] = useState({ itemName: "", spec: "", quantity: "", unit: "", unitPrice: "" });
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/bids/${id}`, { cache: "no-store" });
    if (res.ok) setBid(await res.json());
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const flash = (m: string) => {
    setMsg(m);
    setTimeout(() => setMsg(""), 2500);
  };

  const addItem = async () => {
    if (!newItem.itemName.trim()) return flash("품명을 입력하세요.");
    const res = await fetch("/api/estimates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bidId: Number(id), ...newItem }),
    });
    if (res.ok) {
      setNewItem({ itemName: "", spec: "", quantity: "", unit: "", unitPrice: "" });
      load();
    } else {
      flash((await res.json()).error || "추가 실패");
    }
  };

  const saveItem = async (item: Item) => {
    await fetch(`/api/estimates/${item.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(item),
    });
    flash("저장되었습니다.");
    load();
  };

  const removeItem = async (itemId: number) => {
    if (!confirm("이 견적 항목을 삭제하시겠습니까?")) return;
    await fetch(`/api/estimates/${itemId}`, { method: "DELETE" });
    load();
  };

  const uploadExcel = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) return flash("엑셀 파일을 선택하세요.");
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("bidId", String(id));
    const res = await fetch("/api/estimates/upload", { method: "POST", body: fd });
    const d = await res.json();
    setUploading(false);
    if (res.ok) {
      flash(`✅ ${d.count}개 항목이 추가되었습니다.`);
      if (fileRef.current) fileRef.current.value = "";
      load();
    } else {
      flash(d.error || "업로드 실패");
    }
  };

  const removeBid = async () => {
    if (!confirm("이 입찰과 등록된 모든 견적 항목을 삭제하시겠습니까?")) return;
    await fetch(`/api/bids/${id}`, { method: "DELETE" });
    router.push("/estimates");
  };

  if (!bid) return <p className="text-slate-400 p-6">불러오는 중…</p>;

  const total = bid.items.reduce((s, i) => s + i.quantity * (i.unitPrice ?? 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Link href="/estimates" className="btn-ghost">
          <ArrowLeft className="w-4 h-4" /> 입찰 목록
        </Link>
        <div className="flex gap-2">
          <button className="btn-ghost" onClick={() => setEditBid(true)}>
            <Pencil className="w-4 h-4" /> 입찰 정보 수정
          </button>
          <button className="btn-danger" onClick={removeBid}>
            <Trash2 className="w-4 h-4" /> 입찰 삭제
          </button>
        </div>
      </div>

      {/* 입찰 정보 */}
      <div className="card p-5">
        <div className="flex items-baseline justify-between border-b border-slate-100 pb-3 mb-3">
          <h1 className="text-2xl font-bold text-slate-800">{bid.siteName}</h1>
          <span className="inline-flex items-center gap-1 text-sm text-slate-500">
            <Building2 className="w-4 h-4 text-slate-400" />
            {bid.builderName}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <span className="block text-xs text-slate-400">착공</span>
            {ymd(bid.startDate) || "-"}
          </div>
          <div>
            <span className="block text-xs text-slate-400">준공</span>
            {ymd(bid.endDate) || "-"}
          </div>
          <div>
            <span className="block text-xs text-slate-400">예정일</span>
            {ymd(bid.dueDate) || "-"}
          </div>
        </div>
      </div>

      {/* 엑셀 일괄 업로드 */}
      <div className="card p-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
            <UploadCloud className="w-4 h-4 text-blue-600" /> 엑셀 일괄 등록
          </span>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="input py-1.5 flex-1 min-w-[220px]" />
          <button className="btn-primary" onClick={uploadExcel} disabled={uploading}>
            <UploadCloud className="w-4 h-4" /> {uploading ? "처리중…" : "업로드 & 파싱"}
          </button>
        </div>
        <p className="text-xs text-slate-400 mt-2">
          엑셀 헤더에 <b>품명</b>, <b>규격/상세</b>, <b>수량</b> (선택: 단가, 단위)이 있으면 자동 인식합니다.
        </p>
      </div>

      {msg && <p className="text-sm text-blue-700 font-semibold">{msg}</p>}

      {/* 견적 항목 */}
      <div className="card overflow-x-auto">
        <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <span className="font-bold text-sm text-slate-700">
            견적 항목 <span className="text-slate-400">({bid.items.length}건)</span>
          </span>
          <span className="text-sm text-slate-500">
            견적 합계 <b className="text-blue-700">{won(total)}</b>원
          </span>
        </div>
        <table className="w-full min-w-[820px]">
          <thead>
            <tr>
              <th className="th w-10">#</th>
              <th className="th">품명</th>
              <th className="th">상세정보 (규격/사양)</th>
              <th className="th text-right w-24">수량</th>
              <th className="th w-20">단위</th>
              <th className="th text-right w-32">단가</th>
              <th className="th text-right w-32">금액</th>
              <th className="th w-20"></th>
            </tr>
          </thead>
          <tbody>
            {bid.items.length === 0 && (
              <tr>
                <td className="td text-center text-slate-400 py-6" colSpan={8}>
                  등록된 견적 항목이 없습니다. 아래에서 항목을 추가하거나 엑셀을 업로드하세요.
                </td>
              </tr>
            )}
            {bid.items.map((it, idx) => (
              <ItemRow
                key={it.id}
                index={idx + 1}
                item={it}
                onSave={saveItem}
                onRemove={removeItem}
              />
            ))}
          </tbody>
          <tfoot>
            {/* 새 항목 추가 행 */}
            <tr className="bg-blue-50/40">
              <td className="td text-center text-blue-600"><Plus className="w-4 h-4 mx-auto" /></td>
              <td className="td">
                <input className="input py-1" placeholder="품명 *" value={newItem.itemName} onChange={(e) => setNewItem({ ...newItem, itemName: e.target.value })} onKeyDown={(e) => e.key === "Enter" && addItem()} />
              </td>
              <td className="td">
                <input className="input py-1" placeholder="규격/사양" value={newItem.spec} onChange={(e) => setNewItem({ ...newItem, spec: e.target.value })} onKeyDown={(e) => e.key === "Enter" && addItem()} />
              </td>
              <td className="td">
                <input type="number" className="input py-1 text-right" placeholder="0" value={newItem.quantity} onChange={(e) => setNewItem({ ...newItem, quantity: e.target.value })} onKeyDown={(e) => e.key === "Enter" && addItem()} />
              </td>
              <td className="td">
                <input className="input py-1" placeholder="EA" value={newItem.unit} onChange={(e) => setNewItem({ ...newItem, unit: e.target.value })} onKeyDown={(e) => e.key === "Enter" && addItem()} />
              </td>
              <td className="td">
                <input type="number" className="input py-1 text-right" placeholder="단가" value={newItem.unitPrice} onChange={(e) => setNewItem({ ...newItem, unitPrice: e.target.value })} onKeyDown={(e) => e.key === "Enter" && addItem()} />
              </td>
              <td className="td"></td>
              <td className="td text-right">
                <button className="btn-primary py-1" onClick={addItem}>
                  <Plus className="w-4 h-4" /> 추가
                </button>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {editBid && (
        <BidEditModal
          bid={bid}
          onClose={() => setEditBid(false)}
          onSaved={() => {
            setEditBid(false);
            load();
          }}
        />
      )}
    </div>
  );
}

function ItemRow({
  index,
  item,
  onSave,
  onRemove,
}: {
  index: number;
  item: Item;
  onSave: (i: Item) => void;
  onRemove: (id: number) => void;
}) {
  const [f, setF] = useState({
    itemName: item.itemName,
    spec: item.spec ?? "",
    quantity: String(item.quantity),
    unit: item.unit ?? "",
    unitPrice: item.unitPrice === null ? "" : String(item.unitPrice),
  });
  const dirty =
    f.itemName !== item.itemName ||
    f.spec !== (item.spec ?? "") ||
    Number(f.quantity) !== item.quantity ||
    f.unit !== (item.unit ?? "") ||
    (f.unitPrice === "" ? null : Number(f.unitPrice)) !== item.unitPrice;

  const amount = Number(f.quantity || 0) * Number(f.unitPrice || 0);

  return (
    <tr className="hover:bg-slate-50 group">
      <td className="td text-center text-slate-400">{index}</td>
      <td className="td">
        <input className="input py-1" value={f.itemName} onChange={(e) => setF({ ...f, itemName: e.target.value })} />
      </td>
      <td className="td">
        <input className="input py-1" value={f.spec} onChange={(e) => setF({ ...f, spec: e.target.value })} />
      </td>
      <td className="td">
        <input type="number" className="input py-1 text-right" value={f.quantity} onChange={(e) => setF({ ...f, quantity: e.target.value })} />
      </td>
      <td className="td">
        <input className="input py-1" value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })} />
      </td>
      <td className="td">
        <input type="number" className="input py-1 text-right" value={f.unitPrice} onChange={(e) => setF({ ...f, unitPrice: e.target.value })} />
      </td>
      <td className="td text-right font-semibold">{won(amount)}</td>
      <td className="td text-right whitespace-nowrap">
        {dirty && (
          <button
            className="text-blue-600 hover:text-blue-800 mr-2"
            title="저장"
            onClick={() =>
              onSave({
                id: item.id,
                itemName: f.itemName,
                spec: f.spec || null,
                quantity: Number(f.quantity) || 0,
                unit: f.unit || null,
                unitPrice: f.unitPrice === "" ? null : Number(f.unitPrice),
              })
            }
          >
            <Save className="w-4 h-4" />
          </button>
        )}
        <button className="text-slate-300 hover:text-red-500" title="삭제" onClick={() => onRemove(item.id)}>
          <Trash2 className="w-4 h-4" />
        </button>
      </td>
    </tr>
  );
}

function BidEditModal({
  bid,
  onClose,
  onSaved,
}: {
  bid: Bid;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [f, setF] = useState({
    builderName: bid.builderName,
    siteName: bid.siteName,
    startDate: bid.startDate ? ymd(bid.startDate) : "",
    endDate: bid.endDate ? ymd(bid.endDate) : "",
    dueDate: bid.dueDate ? ymd(bid.dueDate) : "",
  });
  const [err, setErr] = useState("");

  const save = async () => {
    const res = await fetch(`/api/bids/${bid.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(f),
    });
    if (res.ok) onSaved();
    else setErr((await res.json()).error || "저장 실패");
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="card w-full max-w-lg p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-lg">입찰 정보 수정</h2>
          <button onClick={onClose}>
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>
        {err && <p className="text-sm text-red-600 mb-3">{err}</p>}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">건설사명 *</label>
            <input className="input" value={f.builderName} onChange={(e) => setF({ ...f, builderName: e.target.value })} />
          </div>
          <div>
            <label className="label">현장명 *</label>
            <input className="input" value={f.siteName} onChange={(e) => setF({ ...f, siteName: e.target.value })} />
          </div>
          <div>
            <label className="label">착공</label>
            <input type="date" className="input" value={f.startDate} onChange={(e) => setF({ ...f, startDate: e.target.value })} />
          </div>
          <div>
            <label className="label">준공</label>
            <input type="date" className="input" value={f.endDate} onChange={(e) => setF({ ...f, endDate: e.target.value })} />
          </div>
          <div className="col-span-2">
            <label className="label">예정일</label>
            <input type="date" className="input" value={f.dueDate} onChange={(e) => setF({ ...f, dueDate: e.target.value })} />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button className="btn-ghost" onClick={onClose}>취소</button>
          <button className="btn-primary" onClick={save}>저장</button>
        </div>
      </div>
    </div>
  );
}
