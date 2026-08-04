/**
 * 배포용 기준값(마스터) 시딩.
 * 컨테이너 시작 시 `prisma db push` **직후**에 실행된다.
 * (신규 테이블은 db push 로 생성되므로, 시딩은 반드시 push 이후여야 한다)
 * - 테이블이 비어 있을 때만 기본값을 넣는다 → 운영 중 수정한 단가/기준값을 덮어쓰지 않음
 * - 여러 번 실행해도 안전(idempotent)
 * 실패해도 서버는 기동한다(기준값은 화면에서 직접 등록 가능). 로그로 실패를 남긴다.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/** 캐노피 단가 마스터 시딩 (비어 있을 때만 · 이후에는 관리화면에서 수정) */
async function seedCanopyPrices() {
  const sheetRows = [
    ["AL P/N 2.0T", "2코팅", 70500], ["AL P/N 2.0T", "3코팅", 73000],
    ["AL P/N 3.0T", "2코팅", 93500], ["AL P/N 3.0T", "3코팅", 96000],
    ["EGI P/N 1.2T", "2코팅", 38500], ["EGI P/N 1.2T", "3코팅", 41000],
    ["EGI P/N 1.6T", "2코팅", 43500], ["EGI P/N 1.6T", "3코팅", 46000],
  ];
  const THICK = ["1.4T", "2T", "2.9T", "4T", "4.2T", "5.7T"];
  const pipeRows = {
    "40*40 칼라": [10362, 13321, 18534, null, null, null],
    "40*40 HGI": [11411, 14807, 20605, null, null, null],
    "50*50 칼라": [12959, 16948, 23793, null, null, null],
    "50*50 HGI": [14337, 18842, 26457, null, null, null],
    "75*75 칼라": [20143, 26011, 36937, 50035, 52283, 69469],
    "75*75 HGI": [22230, 28921, 41072, null, null, null],
    "100*100 칼라": [null, 35081, 50081, 68314, 71471, 95927],
    "100*100 HGI": [null, 39008, 55694, null, null, null],
  };

  const sheetCount = await prisma.canopySheetPrice.count();
  const pipeCount = await prisma.canopyPipePrice.count();
  let added = 0;

  if (sheetCount === 0) {
    let i = 0;
    for (const [sheetType, coating, unitPrice] of sheetRows) {
      await prisma.canopySheetPrice.create({ data: { sheetType, coating, unitPrice, sortOrder: i++ } });
      added++;
    }
  }
  if (pipeCount === 0) {
    let i = 0;
    for (const [spec, prices] of Object.entries(pipeRows)) {
      for (let t = 0; t < THICK.length; t++) {
        await prisma.canopyPipePrice.create({
          data: { spec, thickness: THICK[t], unitPrice: prices[t], sortOrder: i * 10 + t },
        });
        added++;
      }
      i++;
    }
  }
  return added > 0
    ? `캐노피 단가: 마스터 ${added}건 시딩`
    : `캐노피 단가: 기존 유지 (시트 ${sheetCount} · 파이프 ${pipeCount})`;
}

/** 원판 기준값 시딩 (비어 있을 때만 · 이후 화면에서 추가·수정) */
async function seedPlateSpecs() {
  const count = await prisma.plateSpec.count();
  if (count > 0) return `원판 기준값: 기존 유지 (${count}종)`;

  const rows = [
    ["1*3", 1000, 3000],
    ["1*4", 1000, 4000],
    ["4*4", 1220, 4000],
    ["4*8", 1220, 2430],
    ["4*3", 1220, 3000],
  ];
  let i = 0;
  for (const [name, width, height] of rows) {
    await prisma.plateSpec.create({ data: { name, width, height, sortOrder: i++ } });
  }
  return `원판 기준값: 기본 ${rows.length}종 시딩`;
}

async function main() {
  console.log("[postdeploy] 기준값 시딩 시작");
  console.log("[postdeploy]", await seedCanopyPrices());
  console.log("[postdeploy]", await seedPlateSpecs());
  console.log("[postdeploy] 완료");
}

main()
  .catch((e) => {
    // 기준값은 화면에서도 등록 가능하므로 서버 기동은 막지 않는다
    console.error("[postdeploy] 시딩 실패 — 기준값을 관리화면에서 등록하세요:", e);
  })
  .finally(() => prisma.$disconnect());
