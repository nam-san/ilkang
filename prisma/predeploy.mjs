/**
 * 배포용 데이터 승계 마이그레이션.
 * 컨테이너 시작 시 `prisma db push` 직전에 실행된다.
 * - 기존 운영 데이터를 보존하면서 스키마 변경(컬럼 추가/이관)을 미리 수행
 * - 여러 번 실행해도 안전(idempotent), 신규(빈) DB에서도 안전
 * 실패 시 non-zero 종료 → 배포가 중단되어 기존 버전이 계속 서비스된다(데이터 보호).
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function tableExists(name) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT name FROM sqlite_master WHERE type='table' AND name='${name}'`
  );
  return rows.length > 0;
}

async function columns(table) {
  const rows = await prisma.$queryRawUnsafe(`PRAGMA table_info(${table})`);
  return rows.map((r) => r.name);
}

function midnightMs(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
}

/** Todo: dueDate(지정일 1개) → startDate/endDate(기간) 이관 */
async function migrateTodoDates() {
  if (!(await tableExists("Todo"))) return "Todo: 신규 DB (이관 불필요)";
  const cols = await columns("Todo");
  if (!cols.includes("dueDate")) return "Todo: 이미 이관됨";

  if (!cols.includes("startDate"))
    await prisma.$executeRawUnsafe(`ALTER TABLE "Todo" ADD COLUMN "startDate" DATETIME`);
  if (!cols.includes("endDate"))
    await prisma.$executeRawUnsafe(`ALTER TABLE "Todo" ADD COLUMN "endDate" DATETIME`);

  const moved = await prisma.$executeRawUnsafe(
    `UPDATE "Todo" SET "startDate" = "dueDate" WHERE "dueDate" IS NOT NULL AND "startDate" IS NULL`
  );
  return `Todo: 기존 업무 지정일 ${moved}건 → 시작일로 이관`;
}

/** Memo: 단일 공유 메모 → 날짜별 메모 이관 (date 컬럼 추가 + 값 배정) */
async function migrateMemoDate() {
  if (!(await tableExists("Memo"))) return "Memo: 신규 DB (이관 불필요)";
  const cols = await columns("Memo");
  if (cols.includes("date")) return "Memo: 이미 이관됨";

  await prisma.$executeRawUnsafe(`ALTER TABLE "Memo" ADD COLUMN "date" DATETIME`);

  // 기존 메모는 최근 수정순으로 오늘부터 하루씩 거슬러 배정 (date UNIQUE 충돌 방지)
  const rows = await prisma.$queryRawUnsafe(
    `SELECT id FROM "Memo" ORDER BY "updatedAt" DESC, id DESC`
  );
  let day = midnightMs(new Date());
  for (const r of rows) {
    await prisma.$executeRawUnsafe(`UPDATE "Memo" SET "date" = ${day} WHERE id = ${r.id}`);
    day -= 86400000;
  }
  return `Memo: 기존 메모 ${rows.length}건 → 날짜별 메모로 이관 (최신=오늘)`;
}

/**
 * Memo: 날짜별 메모(임시 운영) → 전사 공유 단일 보드로 통합.
 * 여러 날짜에 흩어진 메모 내용을 한 건으로 합치고 나머지 행은 제거한다.
 * (내용이 유실되지 않도록 과거 기록은 날짜 머리말과 함께 이어붙임)
 */
async function consolidateMemo() {
  if (!(await tableExists("Memo"))) return "Memo: 신규 DB (통합 불필요)";
  const rows = await prisma.$queryRawUnsafe(
    `SELECT id, content, date, updatedAt FROM "Memo" ORDER BY "date" DESC, "updatedAt" DESC`
  );
  if (rows.length <= 1) return `Memo: 단일 보드 (통합 불필요, ${rows.length}건)`;

  const filled = rows.filter((r) => (r.content ?? "").trim().length > 0);
  const fmt = (v) => {
    const d = new Date(Number(v) || v);
    return isNaN(d.getTime()) ? "" : d.toLocaleDateString("sv-SE");
  };
  let merged = "";
  if (filled.length === 1) {
    merged = filled[0].content;
  } else if (filled.length > 1) {
    merged = filled
      .map((r, i) => (i === 0 ? r.content : `──── [${fmt(r.date)} 기록] ────\n${r.content}`))
      .join("\n\n");
  }

  const keepId = rows[0].id; // 최신 행을 보드로 사용
  await prisma.$executeRawUnsafe(`UPDATE "Memo" SET "content" = ? WHERE id = ?`, merged, keepId);
  const removed = await prisma.$executeRawUnsafe(
    `DELETE FROM "Memo" WHERE id <> ${keepId}`
  );
  return `Memo: ${rows.length}건 → 단일 보드로 통합 (내용 보존 ${filled.length}건, ${removed}건 정리)`;
}

async function main() {
  console.log("[predeploy] 데이터 승계 마이그레이션 시작");
  console.log("[predeploy]", await migrateTodoDates());
  console.log("[predeploy]", await migrateMemoDate());
  console.log("[predeploy]", await consolidateMemo());
  console.log("[predeploy] 완료");
}

main()
  .catch((e) => {
    console.error("[predeploy] 실패 — 배포를 중단합니다 (기존 데이터 보호):", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
