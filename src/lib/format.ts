// 공통 포맷 유틸리티

/** 숫자를 원화 형식(천단위 콤마)으로 */
export function won(n: number | null | undefined): string {
  if (n === null || n === undefined || isNaN(Number(n))) return "0";
  return Number(n).toLocaleString("ko-KR");
}

/** Date | string -> YYYY-MM-DD */
export function ymd(d: Date | string | null | undefined): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return "";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** 하자보수(품질보증) 기간 - 준공일 기준 고정 연수 */
export const WARRANTY_YEARS = 3;

/** 준공일 + WARRANTY_YEARS 년 = 하자보수 만료일 (YYYY-MM-DD). 준공일 없으면 "" */
export function warrantyEndYmd(
  endDate: Date | string | null | undefined,
  years: number = WARRANTY_YEARS
): string {
  if (!endDate) return "";
  const d = typeof endDate === "string" ? new Date(endDate) : new Date(endDate);
  if (isNaN(d.getTime())) return "";
  d.setFullYear(d.getFullYear() + years);
  return ymd(d);
}

/** YYYY-MM-DD HH:mm */
export function ymdhm(d: Date | string | null | undefined): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return "";
  return `${ymd(date)} ${String(date.getHours()).padStart(2, "0")}:${String(
    date.getMinutes()
  ).padStart(2, "0")}`;
}
