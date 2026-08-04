"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";

/**
 * 하위 메뉴 바 — 메인 헤더(h-14 = 56px) 바로 아래에 고정된다.
 * 아래 표가 길어져 스크롤해도 하위 메뉴는 계속 보인다.
 * -mx-4 px-4 : main 컨테이너의 좌우 여백까지 배경을 채워 본문이 비쳐 보이지 않도록.
 */
export function StickyTabs({ children }: { children: React.ReactNode }) {
  return (
    <div className="sticky top-14 z-30 -mx-4 px-4 bg-slate-100 border-b border-slate-200">
      {/* -mb-px : 활성 탭의 밑줄이 아래 경계선에 겹치도록 줄 전체를 1px 내린다.
          (버튼에 걸면 세로로 1px 넘쳐 세로 스크롤바가 생긴다)
          overflow-y-hidden + no-scrollbar : 메뉴에는 스크롤바를 노출하지 않는다.
          화면이 좁을 때 가로 스크롤은 그대로 동작한다. */}
      <div className="flex gap-1 -mb-px overflow-x-auto overflow-y-hidden no-scrollbar">
        {children}
      </div>
    </div>
  );
}

/** 하위 메뉴 버튼/링크 공통 스타일 */
export const tabClass = (active: boolean) =>
  `flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold border-b-2 whitespace-nowrap transition-colors ${
    active ? "border-blue-600 text-blue-700" : "border-transparent text-slate-500 hover:text-slate-700"
  }`;

export type SubNavItem = { href: string; label: string; icon: LucideIcon };

/** 라우트가 서로 다른 하위 페이지용 링크 메뉴 */
export function SubNavLinks({ items }: { items: SubNavItem[] }) {
  const path = usePathname();
  const active = (href: string) => path === href || path.startsWith(`${href}/`);

  return (
    <StickyTabs>
      {items.map(({ href, label, icon: Icon }) => (
        <Link key={href} href={href} className={tabClass(active(href))}>
          <Icon className="w-4 h-4" />
          {label}
        </Link>
      ))}
    </StickyTabs>
  );
}
