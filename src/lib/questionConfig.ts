export type ValidationPreset =
  | "email"
  | "phone"
  | "numeric"
  | "length"
  | "range"
  | "date"
  | "url"
  | "regex"
  | "allowedValues";

export type ValidationRule = {
  preset: ValidationPreset;
  enabled: boolean;
  // length
  minLength?: number;
  maxLength?: number;
  // range (numeric)
  minValue?: number;
  maxValue?: number;
  // regex / allowedValues
  pattern?: string;
  allowedValues?: string[];
};

export type QuestionOverride = {
  // null이면 Google required 그대로 사용, 아니면 덮어쓰기
  required?: boolean | null;
  // 검증 룰 — 전부 OFF가 기본
  validations?: ValidationRule[];
  // 조건부 이동 — OFF면 선형, ON이면 선택지 값 → 섹션 인덱스 또는 "END"
  branchEnabled?: boolean;
  branchMap?: Record<string, number | "END">;
};

export type QuestionOverrides = Record<string, QuestionOverride>;

export const PRESET_LABELS: Record<ValidationPreset, string> = {
  email: "이메일 형식",
  phone: "전화번호 (010-0000-0000)",
  numeric: "숫자만",
  length: "글자수 제한",
  range: "숫자 범위",
  date: "날짜 (YYYY-MM-DD)",
  url: "URL (http/https)",
  regex: "정규식 직접",
  allowedValues: "허용값만 (동의 체크 등)",
};

export function defaultValidations(): ValidationRule[] {
  return [
    { preset: "email", enabled: false },
    { preset: "phone", enabled: false },
    { preset: "numeric", enabled: false },
    { preset: "length", enabled: false, minLength: 1, maxLength: 200 },
    { preset: "range", enabled: false, minValue: 0, maxValue: 100 },
    { preset: "date", enabled: false },
    { preset: "url", enabled: false },
    { preset: "regex", enabled: false, pattern: "" },
    { preset: "allowedValues", enabled: false, allowedValues: [] },
  ];
}

export function ensureDefaults(ov: QuestionOverride | undefined): QuestionOverride {
  if (!ov) return { required: null, validations: defaultValidations(), branchEnabled: false, branchMap: {} };
  const map = new Map<string, ValidationRule>();
  for (const d of defaultValidations()) map.set(d.preset, { ...d });
  for (const r of ov.validations || []) {
    map.set(r.preset, { ...map.get(r.preset)!, ...r });
  }
  return {
    required: ov.required ?? null,
    validations: Array.from(map.values()),
    branchEnabled: !!ov.branchEnabled,
    branchMap: ov.branchMap || {},
  };
}

function isEmpty(v: unknown) {
  if (v === undefined || v === null || v === "") return true;
  if (Array.isArray(v) && v.length === 0) return true;
  return false;
}

export function validateSingleValue(
  value: string | string[] | undefined,
  ov: QuestionOverride,
  questionTitle: string
): string | null {
  const vals = ov.validations || [];
  const str = Array.isArray(value) ? value.join(",") : (value || "");

  // allowedValues가 켜져 있으면 최우선 — 체크박스/라디오에서 해당 값만 허용
  const av = vals.find(v => v.preset === "allowedValues" && v.enabled);
  if (av) {
    const allowed = (av.allowedValues || []).map(s => s.trim()).filter(Boolean);
    if (allowed.length > 0) {
      if (Array.isArray(value)) {
        for (const x of value) if (!allowed.includes(x)) return `‘${questionTitle}’은(는) 허용된 값만 선택하세요: ${allowed.join(", ")}`;
        if (value.length === 0) return null; // required는 별도 처리
      } else {
        if (str && !allowed.includes(str)) return `‘${questionTitle}’은(는) 허용된 값만 입력하세요: ${allowed.join(", ")}`;
      }
    }
  }

  for (const r of vals) {
    if (!r.enabled) continue;
    if (r.preset === "allowedValues") continue; // handled above

    if (r.preset === "email") {
      if (str && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str)) return `‘${questionTitle}’ 이메일 형식이 아닙니다.`;
    }
    if (r.preset === "phone") {
      if (str && !/^010-?\d{3,4}-?\d{4}$/.test(str.replace(/\s/g, ""))) return `‘${questionTitle}’ 전화번호 형식(010-0000-0000)이 아닙니다.`;
    }
    if (r.preset === "numeric") {
      if (str && isNaN(Number(str))) return `‘${questionTitle}’ 숫자만 입력하세요.`;
    }
    if (r.preset === "length") {
      const len = str.length;
      if (str && r.minLength !== undefined && len < r.minLength) return `‘${questionTitle}’ ${r.minLength}자 이상 입력하세요. (${len}/${r.minLength})`;
      if (str && r.maxLength !== undefined && len > r.maxLength) return `‘${questionTitle}’ ${r.maxLength}자 이하로 입력하세요. (${len}/${r.maxLength})`;
    }
    if (r.preset === "range") {
      const n = Number(str);
      if (str && !isNaN(n)) {
        if (r.minValue !== undefined && n < r.minValue) return `‘${questionTitle}’ ${r.minValue} 이상 입력하세요.`;
        if (r.maxValue !== undefined && n > r.maxValue) return `‘${questionTitle}’ ${r.maxValue} 이하로 입력하세요.`;
      }
    }
    if (r.preset === "date") {
      if (str && !/^\d{4}-\d{2}-\d{2}$/.test(str)) return `‘${questionTitle}’ 날짜 형식(YYYY-MM-DD)이 아닙니다.`;
      if (str) {
        const d = new Date(str);
        if (isNaN(d.getTime())) return `‘${questionTitle}’ 유효한 날짜가 아닙니다.`;
      }
    }
    if (r.preset === "url") {
      if (str && !/^https?:\/\/.+\..+/.test(str)) return `‘${questionTitle}’ URL 형식(http:// 또는 https://)이 아닙니다.`;
    }
    if (r.preset === "regex") {
      if (str && r.pattern) {
        try {
          const re = new RegExp(r.pattern);
          if (!re.test(str)) return `‘${questionTitle}’ 형식이 올바르지 않습니다.`;
        } catch { return `‘${questionTitle}’ 정규식 오류: ${r.pattern}`; }
      }
    }
  }
  return null;
}

export function validateAnswers(
  questions: { id: string; title: string; required: boolean; type: string; gridRows?: { id: string; title: string }[] }[],
  answers: Record<string, string | string[] | Record<string, string>>,
  overrides: QuestionOverrides | undefined,
  visitedIds?: Set<string>
): string | null {
  const ovs = overrides || {};
  for (const q of questions) {
    if (visitedIds && !visitedIds.has(q.id)) continue;
    const ovRaw = ovs[q.id];
    const ov = ensureDefaults(ovRaw);
    const v = answers[q.id];
    const effectiveRequired = ov.required !== null && ov.required !== undefined ? !!ov.required : !!q.required;
    if (q.type === "GRID") {
      const rows = (q as { gridRows?: { id: string; title: string }[] }).gridRows || [];
      const map = (v as Record<string, string> | undefined) || {};
      if (effectiveRequired) {
        for (const r of rows) {
          if (!map[r.id]) return `필수 문항을 입력하세요: ${q.title} - ${r.title}`;
        }
      }
      // 중복 순위 검사 (한국식 순위: 같은 순위를 두 행에 중복 선택 불가 — 필요 시 활성화, 현재는 허용)
      continue;
    }
    if (effectiveRequired && isEmpty(v)) return `필수 문항을 입력하세요: ${q.title}`;
    if (!isEmpty(v)) {
      const err = validateSingleValue(v as string | string[] | undefined, ov, q.title);
      if (err) return err;
    }
  }
  return null;
}

export function validateOverrides(input: unknown): string | null {
  if (input === null || input === undefined) return null;
  if (typeof input !== "object" || Array.isArray(input)) return "question_overrides는 객체여야 합니다";
  const keys = Object.keys(input as Record<string, unknown>);
  if (keys.length > 50) return "문항 수가 너무 많습니다 (50개 제한)";
  for (const [qid, raw] of Object.entries(input as Record<string, unknown>)) {
    if (!qid || typeof qid !== "string") return `잘못된 questionId: ${String(qid)}`;
    if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return `${qid}: override는 객체여야 합니다`;
    const ov = raw as Record<string, unknown>;
    if (ov.required !== undefined && ov.required !== null && typeof ov.required !== "boolean") return `${qid}: required는 boolean/null`;
    if (ov.validations !== undefined) {
      if (!Array.isArray(ov.validations)) return `${qid}: validations는 배열`;
      if (ov.validations.length > 20) return `${qid}: validations 20개 제한`;
      for (const r of ov.validations as Record<string, unknown>[]) {
        if (!r.preset || typeof r.preset !== "string") return `${qid}: preset 필요`;
        if (!(r.preset in PRESET_LABELS)) return `${qid}: 알 수 없는 preset ${r.preset}`;
        if (typeof r.enabled !== "boolean") return `${qid}: enabled는 boolean`;
      }
    }
    if (ov.branchEnabled !== undefined && typeof ov.branchEnabled !== "boolean") return `${qid}: branchEnabled boolean`;
    if (ov.branchMap !== undefined) {
      if (typeof ov.branchMap !== "object" || ov.branchMap === null || Array.isArray(ov.branchMap)) return `${qid}: branchMap 객체`;
      for (const [k, v] of Object.entries(ov.branchMap as Record<string, unknown>)) {
        if (typeof v !== "number" && v !== "END") return `${qid}: branchMap[${k}]는 number 또는 "END"`;
      }
    }
  }
  return null;
}

export function getNextPageIndex(
  currentPage: number,
  totalPages: number,
  currentQuestions: { id: string }[],
  answers: Record<string, string | string[] | Record<string,string>>,
  overrides: QuestionOverrides | undefined
): number | "END" {
  if (!overrides) return Math.min(currentPage + 1, totalPages - 1);
  for (const q of currentQuestions) {
    const ov = overrides[q.id];
    if (!ov?.branchEnabled || !ov.branchMap) continue;
    const ans = answers[q.id];
    const val = Array.isArray(ans) ? ans[0] : (typeof ans === "object" ? undefined : ans as string | undefined);
    if (val && ov.branchMap[val] !== undefined) {
      const target = ov.branchMap[val];
      if (target === "END") return "END";
      if (typeof target === "number") return Math.max(0, Math.min(target, totalPages - 1));
    }
  }
  return Math.min(currentPage + 1, totalPages - 1);
}
