export type TaxonomyField = {
  key: string; // slug: professor_name, dept, course_id …
  label: string; // 표시명: 교수명, 학과명 …
  type: "text" | "select";
  required: boolean;
  hidden: boolean; // true면 URL로만 주입(숨김), false면 사용자에게 노출
  options?: string[]; // type=select 일 때
  entryId?: string; // Google Form 네이티브 pre-filled용 entry.값 (예: entry.123456), 커스텀 트랙이면 불필요
};

export function slugify(input: string): string {
  const trimmed = input.trim().toLowerCase();
  // 한글 라벨 → 영문 slug 자동 생성 맵
  const map: Record<string, string> = {
    "교수명": "prof_name",
    "교수": "prof_name",
    "교수id": "prof_id",
    "과목명": "course_name",
    "과목": "course_name",
    "과목id": "course_id",
    "학과명": "dept",
    "학과": "dept",
    "학년": "grade",
    "반": "class",
    "전공": "major",
  };
  if (map[trimmed]) return map[trimmed];
  // 일반 slugify: 공백→_, 한글 제거 후 영문/숫자/_/- 만
  const slug = trimmed
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_\-]/g, "")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
  if (slug) return slug;
  // 한글만인 경우 랜덤 키
  return `field_${Math.random().toString(36).slice(2, 6)}`;
}

export function validateTaxonomyFields(fields: TaxonomyField[]): string | null {
  if (!Array.isArray(fields)) return "taxonomy_fields는 배열이어야 합니다";
  if (fields.length > 10) return "분류 필드는 최대 10개까지 가능합니다";
  const keys = new Set<string>();
  for (const f of fields) {
    if (!f.key || !/^[a-z0-9_\-]+$/.test(f.key)) return `키 형식이 잘못됨: ${f.key}`;
    if (keys.has(f.key)) return `중복 키: ${f.key}`;
    keys.add(f.key);
    if (!f.label || f.label.trim().length === 0) return `라벨이 비어있음: ${f.key}`;
    if (!["text", "select"].includes(f.type)) return `타입 오류: ${f.key}`;
    if (f.type === "select" && (!f.options || f.options.length === 0)) return `옵션이 비어있음: ${f.key}`;
  }
  return null;
}

export function parseTaxonomyFromQuery(
  fields: TaxonomyField[],
  query: Record<string, string | string[] | undefined>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of fields) {
    const raw = query[f.key];
    const val = Array.isArray(raw) ? raw[0] : raw;
    if (typeof val === "string" && val.trim() !== "") out[f.key] = val.trim();
  }
  return out;
}

export function validateTaxonomyValues(
  fields: TaxonomyField[],
  values: Record<string, string>,
): string | null {
  for (const f of fields) {
    const v = values[f.key];
    if (f.required && (!v || v.trim() === "")) return `${f.label}(${f.key})은(는) 필수입니다`;
    if (v && f.type === "select" && f.options && !f.options.includes(v)) {
      return `${f.label} 값이 허용 목록에 없습니다: ${v}`;
    }
    if (v && v.length > 200) return `${f.label} 값이 너무 깁니다`;
  }
  return null;
}
