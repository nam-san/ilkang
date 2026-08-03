// 창호 견적 기본 기준값 템플릿 (엑셀 기준값 영역 P17:BJ19 실측)
// 새 프로젝트에 "기본 기준값 채우기" 시 사용. 값·부재·유형 모두 UI에서 수정 가능.

export type ComponentDefault = {
  name: string;
  unitWeight: number;
  defaultCountW: number;
  defaultCountH: number;
  /** 부재 묶음 구분 (AGW처럼 AW/AG 2세트가 함께 투입되는 유형) */
  groupName?: string;
  /** 단위 방식: M(치수) | EA(투입갯수) | MT(중량) */
  unit?: "M" | "EA" | "MT";
  /** EA·MT 기준 투입 수량 */
  unitQty?: number;
};
export type WindowTypeDefault = {
  name: string;
  category?: "창호" | "SSD";
  components: ComponentDefault[];
};

export const DEFAULT_WINDOW_TYPES: WindowTypeDefault[] = [
  {
    name: "갤러리창",
    components: [
      { name: "100*45 통바", unitWeight: 0.927, defaultCountW: 2, defaultCountH: 2 },
      { name: "이음살-4", unitWeight: 0.305, defaultCountW: 0, defaultCountH: 4 },
      { name: "갤러리살-5", unitWeight: 0.357, defaultCountW: 5, defaultCountH: 0 },
    ],
  },
  {
    name: "T5 미서기창",
    components: [
      { name: "후레임", unitWeight: 1.176, defaultCountW: 2, defaultCountH: 2 },
      { name: "상살,하살", unitWeight: 0.848, defaultCountW: 2, defaultCountH: 0 },
      { name: "손잡이,고리개", unitWeight: 0.767, defaultCountW: 0, defaultCountH: 2 },
    ],
  },
  {
    name: "T10 미서기창",
    components: [
      { name: "후레임", unitWeight: 1.176, defaultCountW: 2, defaultCountH: 2 },
      { name: "상살,하살", unitWeight: 0.82, defaultCountW: 2, defaultCountH: 0 },
      { name: "손잡이,고리개", unitWeight: 0.74, defaultCountW: 0, defaultCountH: 2 },
    ],
  },
  {
    name: "T24 미서기 이중창",
    components: [
      { name: "후레임", unitWeight: 2.922, defaultCountW: 2, defaultCountH: 2 },
      { name: "상살,하살", unitWeight: 2.047, defaultCountW: 2, defaultCountH: 0 },
      { name: "손잡이,고리개", unitWeight: 1.969, defaultCountW: 0, defaultCountH: 2 },
    ],
  },
  {
    name: "T28 미서기창",
    components: [
      { name: "후레임", unitWeight: 2.103, defaultCountW: 2, defaultCountH: 2 },
      { name: "상살,하살", unitWeight: 1.344, defaultCountW: 2, defaultCountH: 0 },
      { name: "손잡이,고리개", unitWeight: 1.222, defaultCountW: 0, defaultCountH: 2 },
    ],
  },
  {
    name: "FIX+PJ창 (T5)",
    components: [
      { name: "고정창", unitWeight: 1.106, defaultCountW: 3, defaultCountH: 2 },
      { name: "PJ창", unitWeight: 0.905, defaultCountW: 2, defaultCountH: 2 },
    ],
  },
  {
    name: "FIX+PJ창 (T24)",
    components: [
      { name: "고정창", unitWeight: 2.336, defaultCountW: 3, defaultCountH: 2 },
      { name: "PJ창", unitWeight: 1.11, defaultCountW: 2, defaultCountH: 2 },
    ],
  },
  // AGW = AW(창호) + AG(그릴) 2종이 함께 투입되는 복합 유형
  {
    name: "AGW (AW+AG)",
    components: [
      { groupName: "AW", name: "후레임", unitWeight: 1.176, defaultCountW: 2, defaultCountH: 2 },
      { groupName: "AW", name: "상살,하살", unitWeight: 0.848, defaultCountW: 2, defaultCountH: 0 },
      { groupName: "AW", name: "손잡이,고리개", unitWeight: 0.767, defaultCountW: 0, defaultCountH: 2 },
      { groupName: "AG", name: "100*45 통바", unitWeight: 0.927, defaultCountW: 2, defaultCountH: 2 },
      { groupName: "AG", name: "이음살", unitWeight: 0.305, defaultCountW: 0, defaultCountH: 4 },
      { groupName: "AG", name: "갤러리살", unitWeight: 0.357, defaultCountW: 5, defaultCountH: 0 },
    ],
  },
];

/** SSD 기준값 기본 템플릿 — 투입갯수(EA) 또는 중량(MT) 단위로 입력 */
export const DEFAULT_SSD_TYPES: WindowTypeDefault[] = [
  {
    name: "SSD (스틸도어)",
    category: "SSD",
    components: [
      { name: "도어 본체", unit: "EA", unitQty: 1, unitWeight: 0, defaultCountW: 0, defaultCountH: 0 },
      { name: "도어 프레임", unit: "EA", unitQty: 1, unitWeight: 0, defaultCountW: 0, defaultCountH: 0 },
      { name: "강재 물량", unit: "MT", unitQty: 0, unitWeight: 1000, defaultCountW: 0, defaultCountH: 0 },
    ],
  },
];

export const DEFAULT_COST_PARAM = {
  barPrices: { 단열바: 9520, 일반바: 9300 },
  wagePerKg: 5100, // 엑셀 시공비 기준값 참고
  hingeCost: 0,
  screenCost: 0,
  pjInstallCost: 0,
};
