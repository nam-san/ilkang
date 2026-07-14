"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FileText,
  Users,
  FileSpreadsheet,
  Building2,
  Calculator,
} from "lucide-react";

const NAV = [
  { href: "/", label: "대시보드", icon: LayoutDashboard },
  { href: "/contracts", label: "수주관리", icon: FileText },
  { href: "/labor", label: "인원/인건비", icon: Users },
  { href: "/estimates", label: "견적", icon: FileSpreadsheet },
  { href: "/window-estimate", label: "창호견적산출", icon: Calculator },
  { href: "/subcontractors", label: "하도급", icon: Building2 },
];

export default function NavBar() {
  const path = usePathname();
  const isActive = (href: string) =>
    href === "/" ? path === "/" : path.startsWith(href);

  return (
    <header className="sticky top-0 z-40 bg-blue-900 text-white shadow-md">
      <div className="mx-auto max-w-[1600px] px-4 flex items-center gap-6 h-14">
        <Link href="/" className="flex items-center gap-2 font-bold text-[15px] shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="일강이앤지" className="h-9 w-auto bg-white rounded px-1 py-0.5" />
          <span className="hidden sm:inline">(주)일강이앤지</span>
          <span className="text-blue-200 font-normal hidden md:inline">
            통합 관리 시스템
          </span>
        </Link>
        <nav className="flex items-center gap-1 overflow-x-auto">
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold whitespace-nowrap transition-colors ${
                isActive(href)
                  ? "bg-white text-blue-900"
                  : "text-blue-100 hover:bg-blue-800"
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto text-xs text-blue-200 hidden lg:block">
          로그인 정보 / 설정
        </div>
      </div>
    </header>
  );
}
