export function normalizeEmail(email: string): string {
  const trimmed = email.trim().toLowerCase();
  const atIdx = trimmed.indexOf("@");
  if (atIdx === -1) return trimmed;
  let local = trimmed.slice(0, atIdx);
  const domain = trimmed.slice(atIdx + 1);
  const plusIdx = local.indexOf("+");
  if (plusIdx !== -1) local = local.slice(0, plusIdx);
  return `${local}@${domain}`;
}

export function getDuplicateWarning(type: string): string | null {
  if (type === "cookie") return "쿠키/LocalStorage 기반은 완전한 차단이 아닙니다. 브라우저 변경 시 우회될 수 있습니다.";
  if (type === "email") return "이메일 정규화(소문자·+태그 제거) 적용. 완전한 부정 응답 차단은 아닙니다.";
  if (type === "email_verified") return "이메일 인증 링크 기반 (추후 버전).";
  return null;
}
