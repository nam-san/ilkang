// UTF-8 안전 시드 스크립트 (한글 깨짐 방지). 실행: node prisma/seed.mjs
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

// 하자보수기간: 준공일 + 3년 (고정). 타임존 영향 없이 문자열로 계산
function warranty3y(endYmd) {
  const [y, m, d] = endYmd.split("-").map(Number);
  return `${y + 3}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

async function main() {
  // 기존 데이터 초기화
  await prisma.dailyAssignment.deleteMany();
  await prisma.dailyLog.deleteMany();
  await prisma.estimateItem.deleteMany();
  await prisma.bid.deleteMany();
  await prisma.estimateProject.deleteMany();
  await prisma.subcontractorEstimate.deleteMany();
  await prisma.subcontractorCompany.deleteMany();
  await prisma.estimateItem.deleteMany();
  await prisma.worker.deleteMany();
  await prisma.contract.deleteMany();
  await prisma.todo.deleteMany();
  await prisma.memo.deleteMany();

  const c1 = await prisma.contract.create({
    data: {
      siteName: "래미안 원베일리 창호공사",
      builderName: "삼성물산",
      startDate: new Date("2026-03-02T00:00:00"),
      endDate: new Date("2026-09-30T00:00:00"),
      contractAmount: 1850000000,
      manager: "김현장",
      warrantyPeriod: warranty3y("2026-09-30"),
    },
  });
  const c2 = await prisma.contract.create({
    data: {
      siteName: "힐스테이트 자이 창호",
      builderName: "현대건설",
      startDate: new Date("2026-05-10T00:00:00"),
      endDate: new Date("2026-12-20T00:00:00"),
      contractAmount: 920000000,
      manager: "박관리",
      warrantyPeriod: warranty3y("2026-12-20"),
    },
  });
  await prisma.contract.create({
    data: {
      siteName: "디에이치 방배 커튼월",
      builderName: "현대건설",
      startDate: new Date("2026-07-01T00:00:00"),
      endDate: new Date("2027-02-28T00:00:00"),
      contractAmount: 2340000000,
      manager: "최소장",
      warrantyPeriod: warranty3y("2027-02-28"),
    },
  });

  const workers = await Promise.all(
    [
      { name: "이강인", teamName: "시공1팀", dailyWage: 250000 },
      { name: "손흥민", teamName: "시공1팀", dailyWage: 230000 },
      { name: "황희찬", teamName: "시공1팀", dailyWage: 220000 },
      { name: "김민재", teamName: "양중팀", dailyWage: 200000 },
      { name: "정우영", teamName: "양중팀", dailyWage: 190000 },
      { name: "조규성", teamName: "시공2팀", dailyWage: 240000 },
    ].map((w) => prisma.worker.create({ data: w }))
  );

  // 7월 투입 현황 (여러 날짜)
  const team1 = workers.filter((w) => w.teamName === "시공1팀");
  const lift = workers.filter((w) => w.teamName === "양중팀");
  const days = ["2026-07-06", "2026-07-07", "2026-07-08", "2026-07-13"];
  for (const d of days) {
    for (const w of [...team1, ...lift]) {
      await prisma.dailyAssignment.create({
        data: {
          contractId: c1.id,
          date: new Date(`${d}T00:00:00`),
          workerId: w.id,
          actualWage: w.dailyWage,
          teamName: w.teamName,
        },
      });
    }
  }
  // 힐스테이트에 시공2팀 일부
  for (const d of ["2026-07-10", "2026-07-11"]) {
    await prisma.dailyAssignment.create({
      data: {
        contractId: c2.id,
        date: new Date(`${d}T00:00:00`),
        workerId: workers.find((w) => w.name === "조규성").id,
        actualWage: 240000,
        teamName: "시공2팀",
      },
    });
  }

  await prisma.subcontractorCompany.createMany({
    data: [
      { name: "대한창호", category: "창호", ceo: "김대한", phone: "031-000-1234", bizNumber: "123-45-67890", email: "daehan@window.co.kr", address: "경기도 김포시 대곶면", note: "시스템창호 주력, 납기 우수" },
      { name: "동양샤시", category: "창호", ceo: "이동양", phone: "032-111-2222", bizNumber: "222-33-44455", address: "인천광역시 서구" },
      { name: "우진알미늄", category: "알미늄/커튼월", ceo: "박우진", phone: "051-333-4444", bizNumber: "333-44-55566", email: "woojin@alu.co.kr", address: "부산광역시 강서구", note: "대형 커튼월 시공 가능" },
      { name: "삼우유리", category: "유리", ceo: "최삼우", phone: "02-555-6666", bizNumber: "444-55-66677", address: "서울특별시 금천구" },
    ],
  });

  await prisma.subcontractorEstimate.createMany({
    data: [
      { date: new Date("2026-04-01T00:00:00"), companyName: "대한창호", itemName: "시스템창호 24mm", quantity: 120, unitPrice: 85000 },
      { date: new Date("2026-06-15T00:00:00"), companyName: "동양샤시", itemName: "시스템창호 24mm", quantity: 80, unitPrice: 82000 },
      { date: new Date("2026-02-20T00:00:00"), companyName: "우진알미늄", itemName: "시스템창호 24mm", quantity: 200, unitPrice: 88000 },
      { date: new Date("2026-05-03T00:00:00"), companyName: "대한창호", itemName: "복층유리 22mm", quantity: 300, unitPrice: 45000 },
      { date: new Date("2026-06-30T00:00:00"), companyName: "삼우유리", itemName: "복층유리 22mm", quantity: 150, unitPrice: 43500 },
    ],
  });

  // 입찰 + 견적 항목
  const bid1 = await prisma.bid.create({
    data: {
      builderName: "삼성물산",
      siteName: "래미안 원베일리 창호공사",
      startDate: new Date("2026-03-02T00:00:00"),
      endDate: new Date("2026-09-30T00:00:00"),
      dueDate: new Date("2026-02-10T00:00:00"),
    },
  });
  await prisma.estimateItem.createMany({
    data: [
      { bidId: bid1.id, itemName: "시스템창호(발코니)", spec: "PW-250 / 2400x2100", quantity: 320, unit: "EA", unitPrice: 480000 },
      { bidId: bid1.id, itemName: "복층유리", spec: "22mm 로이유리", quantity: 640, unit: "㎡", unitPrice: 55000 },
      { bidId: bid1.id, itemName: "방충망", spec: "롤타입", quantity: 320, unit: "EA", unitPrice: 35000 },
    ],
  });

  await prisma.bid.create({
    data: {
      builderName: "현대건설",
      siteName: "디에이치 방배 커튼월",
      startDate: new Date("2026-07-01T00:00:00"),
      endDate: new Date("2027-02-28T00:00:00"),
      dueDate: new Date("2026-06-05T00:00:00"),
    },
  });

  await prisma.todo.createMany({
    data: [
      { content: "원베일리 3층 유리 자재 발주 확인", assignee: "김현장" },
      { content: "힐스테이트 준공도서 제출 (12/20)", assignee: "박관리", startDate: new Date("2026-12-18T00:00:00") },
      // 기간(시작~종료) 업무 - 캘린더 연동 데모
      { content: "방배 커튼월 착공 전 실측", assignee: "최소장", startDate: new Date("2026-07-15T00:00:00"), endDate: new Date("2026-07-17T00:00:00") },
      { content: "원베일리 준공 검사 입회", assignee: "김현장", startDate: new Date("2026-09-28T00:00:00") },
      { content: "양중팀 크레인 임대 계약 갱신", assignee: null, done: true, completedBy: "최소장", completedAt: new Date("2026-07-12T14:30:00") },
    ],
  });

  // 날짜별 공용 메모 (캘린더에서 그날 메모 복귀 데모)
  const todayMemo = new Date();
  todayMemo.setHours(0, 0, 0, 0);
  await prisma.memo.createMany({
    data: [
      {
        date: todayMemo,
        content:
          "[전사 공유]\n- 우천 예보: 외부 실링 작업 일정 조정 필요\n- 원베일리 3층 자재 입고 지연 → 시공1팀 4층 선행\n- 안전관리 점검 매주 월요일 오전 9시",
      },
      {
        date: new Date("2026-07-10T00:00:00"),
        content: "[7/10] 방배 현장 크레인 반입 완료 · 시공2팀 오후 투입",
      },
    ],
  });

  // 창호 견적 산출 데모 공사 (기준값은 화면의 '기본 기준값 채우기'로 불러오세요)
  await prisma.estimateProject.create({
    data: {
      siteName: "곤지암역세권A1-1BL 제일풍경채",
      workType: "AL창호공사",
      costParam: { create: { barPrices: JSON.stringify({ 단열바: 9520, 일반바: 9300 }), wagePerKg: 5100 } },
    },
  });

  console.log("✅ 시드 완료: 현장 3, 팀원 6, 투입 다수, 하도급 5, 견적 3, TODO 3, 창호견적공사 1");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
