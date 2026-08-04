// 캐노피 단가 마스터 기본값 (최초 시딩용 · 이후에는 DB 값이 기준)
export const CANOPY_SHEET_TYPES = [
  "AL P/N 2.0T",
  "AL P/N 3.0T",
  "EGI P/N 1.2T",
  "EGI P/N 1.6T",
] as const;

export const CANOPY_COATINGS = ["2코팅", "3코팅"] as const;

export const CANOPY_PIPE_SPECS = [
  "40*40 칼라",
  "40*40 HGI",
  "50*50 칼라",
  "50*50 HGI",
  "75*75 칼라",
  "75*75 HGI",
  "100*100 칼라",
  "100*100 HGI",
] as const;

export const CANOPY_PIPE_THICKNESSES = ["1.4T", "2T", "2.9T", "4T", "4.2T", "5.7T"] as const;

/** 시트 단가 (원/㎡) */
export const DEFAULT_SHEET_PRICES: { sheetType: string; coating: string; unitPrice: number }[] = [
  { sheetType: "AL P/N 2.0T", coating: "2코팅", unitPrice: 70500 },
  { sheetType: "AL P/N 2.0T", coating: "3코팅", unitPrice: 73000 },
  { sheetType: "AL P/N 3.0T", coating: "2코팅", unitPrice: 93500 },
  { sheetType: "AL P/N 3.0T", coating: "3코팅", unitPrice: 96000 },
  { sheetType: "EGI P/N 1.2T", coating: "2코팅", unitPrice: 38500 },
  { sheetType: "EGI P/N 1.2T", coating: "3코팅", unitPrice: 41000 },
  { sheetType: "EGI P/N 1.6T", coating: "2코팅", unitPrice: 43500 },
  { sheetType: "EGI P/N 1.6T", coating: "3코팅", unitPrice: 46000 },
];

/** 각파이프 단가 (원/본, 6m) — null = 미취급 조합 */
export const DEFAULT_PIPE_PRICES: Record<string, (number | null)[]> = {
  // [1.4T, 2T, 2.9T, 4T, 4.2T, 5.7T]
  "40*40 칼라": [10362, 13321, 18534, null, null, null],
  "40*40 HGI": [11411, 14807, 20605, null, null, null],
  "50*50 칼라": [12959, 16948, 23793, null, null, null],
  "50*50 HGI": [14337, 18842, 26457, null, null, null],
  "75*75 칼라": [20143, 26011, 36937, 50035, 52283, 69469],
  "75*75 HGI": [22230, 28921, 41072, null, null, null],
  "100*100 칼라": [null, 35081, 50081, 68314, 71471, 95927],
  "100*100 HGI": [null, 39008, 55694, null, null, null],
};
