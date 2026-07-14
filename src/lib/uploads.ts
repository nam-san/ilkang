import path from "path";

// 업로드 저장 경로. 배포 시 영구 볼륨 경로로 지정 (예: UPLOAD_DIR=/data/uploads)
// 미지정 시 로컬 개발용 public/uploads 사용.
export const UPLOAD_DIR =
  process.env.UPLOAD_DIR || path.join(process.cwd(), "public", "uploads");

// 저장 파일명 → 앱에서 접근할 URL (전용 서빙 라우트)
export function fileUrl(fileName: string): string {
  return `/api/files/${fileName}`;
}

// 저장 URL(/api/files/xxx 또는 /uploads/xxx) → 실제 파일명
export function fileNameFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const m = url.match(/\/(?:api\/files|uploads)\/([^/?#]+)$/);
  return m ? m[1] : null;
}
