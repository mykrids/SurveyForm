// 이메일 오타 사전 차단 — 흔한 도메인 오타를 탐지해 교정 제안
// 현재는 @ 누락 외에 naver.com -> never.com 등 패턴을 잡아냄

const COMMON_DOMAINS = [
  "gmail.com",
  "naver.com",
  "daum.net",
  "hanmail.net",
  "kakao.com",
  "nate.com",
  "hotmail.com",
  "outlook.com",
  "yahoo.com",
  "icloud.com",
  "krids.org",
  "korea.kr",
];

// 명시적 오타 매핑 (key: 잘못 입력한 도메인 -> value: 정정 도메인)
const TYPO_MAP: Record<string, string> = {
  // naver
  "never.com": "naver.com",
  "naver.net": "naver.com",
  "naver.co": "naver.com",
  "naver.con": "naver.com",
  "nave.com": "naver.com",
  "naver.cm": "naver.com",
  "naver.om": "naver.com",
  "naver.co.kr": "naver.com",
  "naver.kr": "naver.com",
  // gmail
  "gmial.com": "gmail.com",
  "gamail.com": "gmail.com",
  "gmail.con": "gmail.com",
  "gmail.cm": "gmail.com",
  "gamil.com": "gmail.com",
  "gmali.com": "gmail.com",
  "gmai.com": "gmail.com",
  "gmail.co": "gmail.com",
  "gmailcom": "gmail.com",
  "google.com": "gmail.com", // 흔한 착각
  // daum
  "daum.ne": "daum.net",
  "daum.com": "daum.net",
  "daun.net": "daum.net",
  "damu.net": "daum.net",
  // hanmail
  "hanmail.ne": "hanmail.net",
  "hanmail.co": "hanmail.net",
  "hanmail.cm": "hanmail.net",
  "hamail.net": "hanmail.net",
  "hanmial.net": "hanmail.net",
  // kakao
  "kakao.ne": "kakao.com",
  "kakao.con": "kakao.com",
  "kaka.com": "kakao.com",
  // nate
  "nate.ne": "nate.com",
  "nate.con": "nate.com",
  // hotmail/outlook
  "hotmial.com": "hotmail.com",
  "hotmai.com": "hotmail.com",
  "outlook.con": "outlook.com",
  "outllook.com": "outlook.com",
  // yahoo
  "yhaoo.com": "yahoo.com",
  "yahoo.con": "yahoo.com",
};

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
}

export type EmailTypoResult = { ok: true } | { ok: false; reason: string; suggestion?: string };

export function checkEmailTypo(email: string): EmailTypoResult {
  const trimmed = email.trim();
  if (!trimmed) return { ok: false, reason: "이메일을 입력해 주세요." };
  if (!trimmed.includes("@")) return { ok: false, reason: "‘@’가 누락되었습니다. 예: example@naver.com" };
  const parts = trimmed.split("@");
  if (parts.length !== 2) return { ok: false, reason: "이메일 형식이 올바르지 않습니다. ‘@’는 하나만 있어야 합니다." };
  const [local, domainRaw] = parts;
  if (!local) return { ok: false, reason: "‘@’ 앞의 아이디가 비어 있습니다." };
  if (!domainRaw) return { ok: false, reason: "‘@’ 뒤의 도메인이 비어 있습니다." };
  const domain = domainRaw.toLowerCase();

  // 1) 명시적 오타 매핑 우선
  if (TYPO_MAP[domain]) {
    const correct = TYPO_MAP[domain];
    return { ok: false, reason: `도메인 오타로 보입니다: ‘${domain}’ → ‘${correct}’`, suggestion: `${local}@${correct}` };
  }

  // 2) 도메인에 점이 없거나 TLD 이상
  if (!domain.includes(".")) {
    // 점 없이 gmail, naver 등으로 끝나는 경우
    if (domain === "gmail" || domain === "naver" || domain === "daum" || domain === "hanmail" || domain === "kakao") {
      const guess = COMMON_DOMAINS.find(d => d.startsWith(domain));
      if (guess) return { ok: false, reason: `도메인에 ‘.’가 빠졌습니다: ‘${domain}’ → ‘${guess}’`, suggestion: `${local}@${guess}` };
    }
    return { ok: false, reason: "도메인에 ‘.’가 없습니다. 예: naver.com, gmail.com" };
  }

  // 3) COMMON_DOMAINS와 레벤슈테인 거리 1~2 이내면 오타로 간주 (길이 5 이상)
  let best: { d: string; dist: number } | null = null;
  for (const cand of COMMON_DOMAINS) {
    const dist = levenshtein(domain, cand);
    if (dist > 0 && dist <= 2) {
      if (!best || dist < best.dist) best = { d: cand, dist };
    }
  }
  if (best) {
    return { ok: false, reason: `도메인 오타로 보입니다: ‘${domain}’ → ‘${best.d}’(이)가 맞나요?`, suggestion: `${local}@${best.d}` };
  }

  // 4) 기본 형식 검사 (간단)
  const emailRe = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i;
  if (!emailRe.test(trimmed)) {
    return { ok: false, reason: "이메일 형식이 올바르지 않습니다. 예: example@naver.com" };
  }

  return { ok: true };
}

// 현재 구현 상태 설명용
export const TYPO_BLOCKING_STATUS = {
  enabled: true,
  checks: ["‘@’ 누락", "도메인 오타 사전(never.com→naver.com 등 30여개)", "레벤슈테인 거리 1~2 오타 탐지", "도메인 점(.) 누락"],
  notYet: "메일 인증 기반(인증 링크 발송 후 클릭해야 제출 완료) — 현재는 미구현, 이메일 입력 + 오타 차단만 운영",
};
