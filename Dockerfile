# (주)일강이앤지 통합 관리 시스템 - 배포용 Dockerfile
FROM node:22-slim

WORKDIR /app

# Prisma 실행에 필요한 openssl + 한국 시간대 적용용 tzdata
RUN apt-get update -y && apt-get install -y openssl tzdata && rm -rf /var/lib/apt/lists/*

# 서버 시간대를 한국으로 (날짜 계산이 사용자 기준과 일치하도록)
ENV TZ=Asia/Seoul

# 의존성 설치 (devDependencies 포함 — 빌드/prisma CLI 필요)
COPY package*.json ./
RUN npm ci

# 소스 복사
COPY . .

# 빌드 (빌드 중에는 임시 DATABASE_URL 사용, 실제 값은 런타임 환경변수로 주입)
ENV DATABASE_URL="file:/tmp/build.db"
RUN npx prisma generate && npm run build

ENV NODE_ENV=production
EXPOSE 3000

# 시작 순서: ① 데이터 승계 마이그레이션 → ② 스키마 동기화 → ③ 서버 기동
# (①이 실패하면 배포가 중단되어 기존 버전이 계속 서비스됨 = 데이터 보호)
CMD ["sh", "-c", "node prisma/predeploy.mjs && npx prisma db push --skip-generate --accept-data-loss && npx next start -H 0.0.0.0 -p ${PORT:-3000}"]
