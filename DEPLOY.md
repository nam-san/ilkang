# 배포 가이드 (Railway / Render)

이 앱은 **SQLite(파일 DB) + 로컬 사진 저장** 방식이므로, 데이터가 유지되려면 **영구 디스크(Persistent Volume)** 가 있는 환경에 배포해야 합니다.
아래는 GitHub 저장소를 만든 뒤 Railway 또는 Render에 배포하는 방법입니다.

> ⚠️ 재배포/재시작해도 데이터를 지키려면 **볼륨 마운트 + 환경변수 2개**가 반드시 필요합니다.

---

## 0. 공통 준비 — GitHub에 코드 올리기

`ilkang-web` 폴더를 GitHub 저장소로 올립니다. (이 폴더가 저장소 최상위가 되도록)

```bash
cd ilkang-web
git init
git add .
git commit -m "일강이앤지 통합 관리 시스템"
git branch -M main
git remote add origin https://github.com/<계정>/<저장소>.git
git push -u origin main
```

---

## A. Railway 배포

1. https://railway.app 접속 → **New Project → Deploy from GitHub repo** → 위 저장소 선택
2. Railway가 `Dockerfile`을 자동 인식해 빌드합니다.
3. **볼륨 추가**: 서비스 → **Variables/Settings 옆 Volume → New Volume**, Mount Path 를 **`/data`** 로 설정
4. **환경변수(Variables)** 2개 추가:
   - `DATABASE_URL` = `file:/data/prod.db`
   - `UPLOAD_DIR` = `/data/uploads`
5. **Settings → Networking → Generate Domain** 으로 공개 URL 발급
6. 발급된 URL을 직원들에게 공유 → 테스트 시작

---

## B. Render 배포

1. https://render.com 접속 → **New → Web Service** → GitHub 저장소 연결
2. **Language/Environment: Docker** 선택 (Dockerfile 자동 사용)
3. **Disks → Add Disk**: Name 자유, **Mount Path = `/data`**, 크기 1GB (사진 양에 따라 조정)
4. **Environment → Environment Variables** 2개 추가:
   - `DATABASE_URL` = `file:/data/prod.db`
   - `UPLOAD_DIR` = `/data/uploads`
5. **Create Web Service** → 빌드/배포 완료 후 제공되는 `https://xxxx.onrender.com` URL 공유

> Render 무료 플랜은 일정 시간 미사용 시 잠들었다가 접속 시 다시 깨어납니다(첫 접속이 느릴 수 있음). 상시 가동이 필요하면 유료 플랜 권장.

---

## 환경변수 요약

| 변수 | 값(볼륨 `/data` 기준) | 설명 |
|------|------|------|
| `DATABASE_URL` | `file:/data/prod.db` | SQLite DB를 영구 디스크에 저장 |
| `UPLOAD_DIR` | `/data/uploads` | 근무일지·도면 사진을 영구 디스크에 저장 |

- 두 값 모두 **볼륨 마운트 경로(`/data`) 하위**를 가리켜야 데이터가 유지됩니다.
- 설정하지 않으면 로컬 기본값(`prisma/dev.db`, `public/uploads`)이 쓰여 **재배포 시 초기화**되니 주의.

---

## 배포 후 확인
- 접속 → 각 메뉴 동작 확인
- 근무일지/도면 사진 업로드 후 **재배포**해도 사진과 데이터가 유지되는지 확인 (영구 볼륨 검증)

## 참고 / 다음 단계
- 현재 **접근 보호(로그인) 없음** — URL을 아는 사람은 누구나 열람·수정 가능. 외부 공개 시 간단한 공용 비밀번호 보호를 추가 권장.
- 사용자·데이터가 많아지면 PostgreSQL + 클라우드 스토리지(S3/R2)로 전환 가능.
- 로컬에서 배포 이미지를 직접 확인하려면: `docker build -t ilkang . && docker run -p 3000:3000 -e DATABASE_URL=file:/data/prod.db -e UPLOAD_DIR=/data/uploads -v ilkang_data:/data ilkang`
