// 창호 견적 산출 - 도메인 계산 로직 (서버 단일 소스)
// 스펙 3-1 ~ 3-2 구현. 순수 함수로 단위테스트 가능.

/** 규격 문자열 파싱 결과 */
export type SpecParse = { widthMm: number | null; heightMm: number | null; ok: boolean };

/**
 * 3-1. 규격 문자열 파싱
 * 예: "1.100 x 1.150 = 1.265 / [일반Bar] / ..." -> { W:1100, H:1150 }
 * - 'x' 앞: 폭, 'x'와 '=' 사이(또는 그 다음 수): 높이
 * - "1.100" 처럼 천단위 구분용 소수점을 제거해 mm 정수화 (1.100 -> 1100)
 * - 실패 시 ok=false (수동입력 허용)
 */
export function parseSpec(spec: string | null | undefined): SpecParse {
  if (!spec) return { widthMm: null, heightMm: null, ok: false };
  // W x H 패턴 (= 앞까지). 공백/전각 대응.
  const m = spec.replace(/×/g, "x").match(/([\d.,]+)\s*x\s*([\d.,]+)/i);
  if (!m) return { widthMm: null, heightMm: null, ok: false };
  const toMm = (s: string): number | null => {
    // 숫자만 남김 (소수점/콤마 제거) -> "1.100" -> "1100", "1,100" -> "1100"
    const digits = s.replace(/[^\d]/g, "");
    if (!digits) return null;
    const n = parseInt(digits, 10);
    return isNaN(n) ? null : n;
  };
  const widthMm = toMm(m[1]);
  const heightMm = toMm(m[2]);
  return { widthMm, heightMm, ok: widthMm != null && heightMm != null };
}

/**
 * 3-2. 부재 물량
 * 길이(M) = (W*개수W + H*개수H) / 1000
 * 중량(kg) = 길이(M) * 단위중량(kg/M)
 */
export function componentLengthM(
  widthMm: number,
  countW: number,
  heightMm: number,
  countH: number
): number {
  return (widthMm * countW + heightMm * countH) / 1000;
}

export function componentWeightKg(lengthM: number, unitWeight: number): number {
  return lengthM * unitWeight;
}

/** 라인 총중량 O = 부재 중량 합 */
export function lineTotalWeight(weights: number[]): number {
  return weights.reduce((s, w) => s + w, 0);
}

/**
 * 3-5-2. 창호유형 자동 추천 (품명/규격/비고 키워드 기반, 수정 가능)
 * typeNames 중 라인 텍스트에 가장 잘 맞는 유형명을 반환. 없으면 null.
 */
export function recommendWindowType(
  text: string,
  typeNames: string[]
): string | null {
  const hay = (text || "").replace(/\s/g, "");
  // 유형명이 텍스트에 직접 포함되면 우선 (긴 이름 우선 매칭)
  const byName = [...typeNames]
    .sort((a, b) => b.length - a.length)
    .find((t) => hay.includes(t.replace(/\s/g, "")));
  if (byName) return byName;

  // 키워드 힌트 매핑
  const hints: { kw: RegExp; match: (t: string) => boolean }[] = [
    { kw: /FIX|고정창.*PJ|PJ.*고정창/i, match: (t) => /FIX|PJ/i.test(t) },
    { kw: /미서기|미세기/, match: (t) => t.includes("미서기") },
    { kw: /갤러리|그릴/, match: (t) => /갤러리|그릴/.test(t) },
    { kw: /이중창/, match: (t) => t.includes("이중") },
  ];
  for (const h of hints) {
    if (h.kw.test(text)) {
      const cand = typeNames.find((t) => h.match(t));
      if (cand) return cand;
    }
  }
  return null;
}

/** 3-4. 금액(재료/노무/경비) = TRUNC(단가 × 수량) — 원 단위 버림 */
export function lineAmount(unitPrice: number, quantity: number): number {
  return Math.trunc(unitPrice * quantity);
}

// ── 3-3. 비용 계산 ──────────────────────────────────────────

/** ROUNDUP(n, -2) : 100원 단위 올림 */
export function roundUp100(n: number): number {
  return Math.ceil(n / 100) * 100;
}

/**
 * 총자재비 = ROUNDUP( kg당자재비 × 총중량 + 흰지비 + 방충망비, -2 )
 */
export function totalMaterialCost(
  barPricePerKg: number,
  totalWeight: number,
  hingeCost: number,
  screenCost: number
): number {
  return roundUp100(barPricePerKg * totalWeight + hingeCost + screenCost);
}

/** 시공비 = ROUNDUP( 총중량 × kg당시공비, -2 ) */
export function installCost(totalWeight: number, wagePerKg: number): number {
  return roundUp100(totalWeight * wagePerKg);
}

/** 총시공비 = 시공비 + PJ시공비 */
export function totalLaborCost(install: number, pjInstallCost: number): number {
  return install + pjInstallCost;
}
