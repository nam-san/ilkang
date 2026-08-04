"use client";

import { usePathname } from "next/navigation";
import { FileSpreadsheet, Calculator } from "lucide-react";
import { SubNavLinks, type SubNavItem } from "./SubNav";

// 견적 하위 메뉴 — 창호견적산출은 견적의 하위 기능이다.
const ITEMS: SubNavItem[] = [
  { href: "/estimates", label: "견적 관리 (입찰)", icon: FileSpreadsheet },
  { href: "/window-estimate", label: "창호견적산출", icon: Calculator },
];

export default function EstimateSubNav() {
  const path = usePathname();
  // 창호견적산출 작업창은 자체 탭(기준값·라인·자재·비용)을 상단에 고정하므로 중복 표시하지 않는다
  if (/^\/window-estimate\/\d+/.test(path)) return null;
  return <SubNavLinks items={ITEMS} />;
}
