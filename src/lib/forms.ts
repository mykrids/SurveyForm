export type ParsedQuestion = {
  id: string;
  title: string;
  type: "TEXT" | "PARAGRAPH_TEXT" | "RADIO" | "CHECKBOX" | "UNSUPPORTED";
  required: boolean;
  rawType?: string;
  options?: string[];
  description?: string;
  scaleLow?: number;
  scaleHigh?: number;
  scaleLowLabel?: string;
  scaleHighLabel?: string;
};

export type ParsedForm = {
  formId: string;
  title: string;
  description?: string;
  questions: ParsedQuestion[];
  unsupported: ParsedQuestion[];
  sectionBreaks?: number[];
};

const SUPPORTED_MAP: Record<string, ParsedQuestion["type"]> = {
  TEXT: "TEXT",
  SHORT_ANSWER: "TEXT",
  PARAGRAPH_TEXT: "PARAGRAPH_TEXT",
  LONG_ANSWER: "PARAGRAPH_TEXT",
  RADIO: "RADIO",
  MULTIPLE_CHOICE: "RADIO",
  CHECKBOX: "CHECKBOX",
  CHECKBOXES: "CHECKBOX",
};

export function parseGoogleFormResponse(formId: string, apiJson: Record<string, unknown>): ParsedForm {
  const info = (apiJson as Record<string, unknown>).info as Record<string, unknown> | undefined;
  const items = (apiJson as Record<string, unknown>).items as unknown[] | undefined;

  const title = (info?.title as string) || (apiJson as Record<string, unknown>).title as string || `설문 ${formId}`;
  const description = (info?.description as string) || undefined;

  const questions: ParsedQuestion[] = [];
  const unsupported: ParsedQuestion[] = [];
  const sectionBreaks: number[] = [];

  if (!items || items.length === 0) {
    return { formId, title, description, questions, unsupported, sectionBreaks };
  }

  for (const raw of items as Record<string, unknown>[]) {
    // 섹션 구분 (pageBreak) — 페이지네이션 우선 기준
    if ((raw as Record<string, unknown>).pageBreakItem !== undefined) {
      if (questions.length > 0) sectionBreaks.push(questions.length);
      continue;
    }
    const questionItem = (raw.questionItem || raw.questionGroupItem || raw) as Record<string, unknown>;
    const question = questionItem.question as Record<string, unknown> | undefined;
    if (!question) {
      // image, video 등 -> unsupported
      const titleText = (raw.title as string) || "지원되지 않는 항목";
      const q: ParsedQuestion = { id: String(raw.itemId || Math.random()), title: titleText, type: "UNSUPPORTED", required: false, rawType: String(raw.kind || "UNKNOWN") };
      unsupported.push(q);
      continue;
    }
    const qId = String(question.questionId || raw.itemId || Math.random());
    // actual title is in item.title
    const qTitle = (raw.title as string) || "무제 문항";
    const required = Boolean(question.required);
    const textQuestion = question.textQuestion as Record<string, unknown> | undefined;
    const choiceQuestion = question.choiceQuestion as Record<string, unknown> | undefined;
    const scaleQuestion = question.scaleQuestion as unknown;
    const dateQuestion = question.dateQuestion as unknown;
    const timeQuestion = question.timeQuestion as unknown;
    const fileUploadQuestion = question.fileUploadQuestion as unknown;
    const rowQuestion = question.rowQuestion as unknown;

    let type: ParsedQuestion["type"] = "UNSUPPORTED";
    let rawType = "UNKNOWN";
    let options: string[] | undefined;

    if (textQuestion !== undefined) {
      // heuristic: if choiceQuestion missing and textQuestion exists, check paragraph flag
      // Forms API: textQuestion has paragraph bool
      const para = (textQuestion as Record<string, unknown>).paragraph as boolean | undefined;
      if (para) {
        type = "PARAGRAPH_TEXT"; rawType = "PARAGRAPH_TEXT";
      } else {
        type = "TEXT"; rawType = "TEXT";
      }
    } else if (choiceQuestion) {
      const cType = (choiceQuestion.type as string) || "RADIO";
      rawType = cType;
      const mapped = SUPPORTED_MAP[cType];
      if (mapped) {
        type = mapped;
        const opts = choiceQuestion.options as { value: string }[] | undefined;
        options = opts?.map(o => o.value) || [];
      } else {
        type = "UNSUPPORTED";
      }
    } else if (scaleQuestion) {
      rawType = "SCALE";
      const sq = scaleQuestion as Record<string, unknown>;
      const low = Number(sq.low ?? 1);
      const high = Number(sq.high ?? 7);
      const lowLabel = (sq.lowLabel as string) || "";
      const highLabel = (sq.highLabel as string) || "";
      options = [];
      for (let i = low; i <= high; i++) options.push(String(i));
      type = "RADIO";
      const parsedScale: ParsedQuestion = { id: qId, title: qTitle, type, required, rawType, options, scaleLow: low, scaleHigh: high, scaleLowLabel: lowLabel, scaleHighLabel: highLabel };
      questions.push(parsedScale);
      continue;
    } else if (dateQuestion || timeQuestion || fileUploadQuestion || rowQuestion) {
      rawType = dateQuestion ? "DATE" : timeQuestion ? "TIME" : fileUploadQuestion ? "FILE_UPLOAD" : "GRID";
      type = "UNSUPPORTED";
    }

    const parsed: ParsedQuestion = { id: qId, title: qTitle, type, required, rawType, options };
    if (type === "UNSUPPORTED") unsupported.push(parsed);
    else questions.push(parsed);
  }

  return { formId, title, description, questions, unsupported, sectionBreaks };
}

export function mockForm(formId: string): ParsedForm {
  return {
    formId,
    title: `데모 설문 (${formId})`,
    description: "Google Forms API 키가 없어 목업 데이터로 표시됩니다. 실제 연동 시 서비스계정 JSON과 Form 뷰어 공유가 필요합니다.",
    questions: [
      { id: "q1", title: "이름", type: "TEXT", required: true, rawType: "TEXT" },
      { id: "q2", title: "의견을 자유롭게 적어주세요", type: "PARAGRAPH_TEXT", required: false, rawType: "PARAGRAPH_TEXT" },
      { id: "q3", title: "만족도", type: "RADIO", required: true, rawType: "RADIO", options: ["매우 만족", "만족", "보통", "불만족"] },
      { id: "q4", title: "관심 분야 (복수 선택)", type: "CHECKBOX", required: false, rawType: "CHECKBOX", options: ["제품", "서비스", "가격", "기타"] },
    ],
    unsupported: [],
  };
}
