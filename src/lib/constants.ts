export const END_MESSAGE_PRESETS = {
  "1": { label: "감사합니다! 응답이 정상적으로 제출되었습니다.", body: "소중한 의견을 들려주셔서 감사합니다. 응답은 안전하게 저장되었습니다." },
  "2": { label: "참여해 주셔서 감사합니다!", body: "귀하의 응답이 접수되었습니다. 더 나은 서비스를 위해 활용하겠습니다." },
  "3": { label: "제출 완료 — 감사합니다", body: "응답이 완료되었습니다. 추후 결과는 관리자가 공유할 예정입니다." },
  "4": { label: "소중한 시간 내주셔서 감사합니다", body: "바쁘신 와중에 참여해 주셔서 감사합니다. 응답은 익명으로 처리됩니다." },
  "5": { label: "응답이 저장되었습니다", body: "응답이 안전하게 저장되었습니다. 필요 시 관리자에게 문의해 주세요." },
  "6": { label: "설문에 참여해 주셔서 감사합니다", body: "여러분의 목소리가 더 나은 서비스를 만듭니다. 감사합니다!" },
  "7": { label: "제출해 주셔서 감사합니다", body: "제출이 완료되었습니다. 응답 수정이 필요하면 관리자에게 연락해 주세요." },
  "8": { label: "감사합니다 — 응답 완료!", body: "모든 문항에 응답해 주셔서 감사합니다. 좋은 하루 보내세요!" },
  "9": { label: "응답 감사합니다", body: "응답해 주셔서 감사합니다. 결과는 집계 후 안내드리겠습니다." },
  "10": { label: "완료되었습니다", body: "설문이 성공적으로 제출되었습니다. 참여해 주셔서 감사합니다." },
} as const;

export type EndMessagePresetId = keyof typeof END_MESSAGE_PRESETS;

export const DUPLICATE_CHECK_TYPES = {
  none: "제한 없음",
  cookie: "쿠키/LocalStorage 기반",
  email: "이메일 기반 (정규화 적용)",
  email_verified: "이메일 인증 기반 (추후 확장)",
} as const;

export type DuplicateCheckType = keyof typeof DUPLICATE_CHECK_TYPES;

export const SUPPORTED_QUESTION_TYPES = ["TEXT", "PARAGRAPH_TEXT", "RADIO", "CHECKBOX"] as const;
export type SupportedQuestionType = typeof SUPPORTED_QUESTION_TYPES[number];

export const LANDING_DATA = {
  hero: {
    badge: "krids 스타일 · 구글 시트 연동",
    title: "브랜드에 맞는<br />커스텀 설문조사 SaaS",
    subtitle: "Google Forms의 강력한 백엔드와 Sheets 저장소 위에,귀교의 브랜드 UI를 입히세요. 코드 한 줄 없이 설문을 배포하고 응답을 자동 집계합니다.",
    ctaPrimary: "무료로 시작하기",
    ctaSecondary: "데모 설문 보기",
  },
  features: [
    { icon: "🎨", title: "완전 커스텀 UI", desc: "구글 로고·기본 테마 없이 브랜드 폰트/컬러로 렌더링. 개인정보 고지는 별도 정책 페이지에서 처리." },
    { icon: "🔗", title: "Google Sheets 자동 저장", desc: "응답은 GAS Web App을 경유해 시트에 한 행씩 안전하게 append. 별도 DB 없이 시트가 곧 DB." },
    { icon: "🛡️", title: "중복 방지 & 기간 제어", desc: "쿠키/이메일 정규화 기반 중복 체크와 시작·종료 일시 제어로 깨끗한 데이터 확보." },
    { icon: "⚡", title: "즉시 확인 메일", desc: "제출 즉시 Resend로 응답자에게 확인 메일 발송. 시트 재조회 없이 payload로 발송해 지연 없음." },
    { icon: "📄", title: "지연 PDF 리포트", desc: "종료 후 지연(기본 1시간) 뒤 Cron이 시트 전체를 읽어 통계 PDF를 관리자 메일로 자동 발송." },
    { icon: "🔒", title: "보안 기본", desc: "service_role·GAS Secret·Resend 키는 서버 전용. GAS는 Bearer 검증, Cron은 Secret 헤더로 보호." },
  ],
  templates: [
    { id: "t1", title: "고객 만족도 조사", category: "CSAT", questions: 8, color: "bg-violet-500" },
    { id: "t2", title: "강의 평가", category: "Education", questions: 12, color: "bg-blue-500" },
    { id: "t3", title: "이벤트 참가 신청", category: "Event", questions: 6, color: "bg-emerald-500" },
    { id: "t4", title: "대학생활과 수업 만족도 조사", category: "Education", questions: 10, color: "bg-orange-500" },
    { id: "t5", title: "교육 과정 평가", category: "Education", questions: 9, color: "bg-pink-500" },
    { id: "t6", title: "교육 신청서", category: "Education", questions: 15, color: "bg-cyan-500" },
  ],
  pricing: [
    { name: "Starter", price: "₩0", period: "/월", features: ["설문 3개", "월 응답 100건", "기본 커스텀 UI", "이메일 확인 발송"], cta: "무료 시작", popular: false },
    { name: "Pro", price: "₩29,000", period: "/월", features: ["설문 무제한", "월 응답 5,000건", "쿠키/이메일 중복방지", "PDF 자동 리포트", "우선 지원"], cta: "Pro 시작", popular: true },
    { name: "Enterprise", price: "문의", period: "", features: ["SSO / 팀 관리", "이메일 인증 중복방지", "전용 GAS/시트 분리", "SLA 보장"], cta: "영업 문의", popular: false },
  ],
};
