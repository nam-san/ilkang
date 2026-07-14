# (주)일강이앤지 통합 관리 시스템 - 배포용 Dockerfile
FROM node:22-slim

WORKDIR /app

# Prisma 실행에 필요한 openssl
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

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

# 시작 시 스키마 동기화(볼륨의 DB 생성/갱신) 후 서버 기동
CMD ["sh", "-c", "npx prisma db push --skip-generate && npx next start -H 0.0.0.0 -p ${PORT:-3000}"]
