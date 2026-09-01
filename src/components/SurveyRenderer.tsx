"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { ParsedForm, ParsedQuestion } from "@/lib/forms";
import { checkEmailTypo } from "@/lib/emailTypo";
import type { TaxonomyField } from "@/lib/taxonomy";
import { validateTaxonomyValues } from "@/lib/taxonomy";
import { ensureDefaults, validateAnswers, getNextPageIndex, type QuestionOverrides } from "@/lib/questionConfig";

export default function SurveyRenderer({ surveyId }: { surveyId: string }) {
  const searchParams = useSearchParams();
  const [form, setForm] = useState<ParsedForm | null>(null);
  const [answers, setAnswers] = useState<Record<string, string | string[] | Record<string,string>>>({});
  const [taxonomyFields, setTaxonomyFields] = useState<TaxonomyField[]>([]);
  const [taxonomyValues, setTaxonomyValues] = useState<Record<string, string>>({});
  const [overrides, setOverrides] = useState<QuestionOverrides>({});
  const [branchEnded, setBranchEnded] = useState(false);
  const [email, setEmail] = useState("");
  const [consentChecked, setConsentChecked] = useState(false);
  const [duplicateCheckType, setDuplicateCheckType] = useState<string>("none");
  const [status, setStatus] = useState<string>("");
  const [globalPopup, setGlobalPopup] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [done, setDone] = useState<{ presetLabel: string; presetBody: string } | null>(null);
  const [page, setPage] = useState(0);
  const [visited, setVisited] = useState<Set<number>>(()=> new Set([0]));
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoFit, setLogoFit] = useState<string>("contain");

  useEffect(()=>{
    fetch(`/api/forms/${surveyId}`).then(r=>r.json()).then(j=>{
      if (j.form) {
        setForm(j.form); setPage(0);
        // 구글 폼의 goToSectionId(분기) 자동 추론 — DB question_overrides가 없어도 동작 (마이그레이션 전/구글 설정 미연동 대비)
        if (j.raw) {
          const inferred = inferBranchFromRaw(j.raw as Record<string, unknown>, j.form as ParsedForm);
          if (Object.keys(inferred).length > 0) {
            setOverrides(prev => {
              // DB에 이미 분기가 있으면 그것을 우선, 없으면 추론값 사용
              const merged: QuestionOverrides = { ...inferred };
              for (const [k, v] of Object.entries(prev)) {
                if (v && (v as QuestionOverrides[string])?.branchEnabled) merged[k] = v as QuestionOverrides[string];
              }
              // 추론 결과가 있고 DB가 비어있으면 즉시 적용
              if (Object.keys(prev).length === 0) return inferred;
              return Object.keys(merged).length ? merged : prev;
            });
          }
        }
      }
      if (j.warning && !j.warning.includes("지원되지 않는 문항")) setStatus(j.warning);
    }).catch(()=>setStatus("폼 로드 실패"));
    // taxonomy + question_overrides + title meta + logo
    if (surveyId !== "demo") {
      fetch(`/api/surveys/${surveyId}`).then(r=>r.json()).then(j=>{
        if (j.survey?.taxonomy_fields) {
          const fields = j.survey.taxonomy_fields as TaxonomyField[];
          setTaxonomyFields(fields);
          const init: Record<string, string> = {};
          for (const f of fields) {
            const v = searchParams.get(f.key);
            if (v) init[f.key] = v;
          }
          if (Object.keys(init).length>0) setTaxonomyValues(init);
        }
        if (j.survey?.question_overrides && Object.keys(j.survey.question_overrides as object).length > 0) {
          const dbOv = j.survey.question_overrides as QuestionOverrides;
          setOverrides(prev => ({ ...prev, ...dbOv }));
        }
        if (j.survey?.title) {
          const surveyTitle = j.survey.title as string;
          setForm(prev => prev ? { ...prev, title: surveyTitle } : prev);
        }
        if (j.survey?.duplicate_check_type) {
          setDuplicateCheckType(j.survey.duplicate_check_type as string);
        } else if (surveyId === "6440c1c4-ab8c-42f0-a8c3-1ad731565d6f") {
          // 강의 평가는 항상 쿠키 기반 (개인정보 수집 없음)
          setDuplicateCheckType("cookie");
        }
        if (j.survey?.logo_url) {
          setLogoUrl(j.survey.logo_url as string);
          setLogoFit((j.survey.logo_fit as string) || "contain");
        } else {
          // 데모 6종 즉시 표시 — DB 마이그레이션 전에도 기준 240×240 견본 로고가 보이도록 폴백
          const DEMO_WITH_LOGO = new Set([
            "790f4713-0894-49a4-8e93-297f8f68a614",
            "6440c1c4-ab8c-42f0-a8c3-1ad731565d6f",
            "983d0315-4c2c-48cc-81b6-c7da291ed20a",
            "afb5c989-95c4-4a8b-9846-e63be0d27b09",
            "e6524f44-b0c7-4897-83c0-d934c5ed5e2a",
            "18bcc7b5-e1b7-4915-a9a8-ca3711af895f",
          ]);
          if (DEMO_WITH_LOGO.has(surveyId)) {
            setLogoUrl("/logos/sampleLogo.gif");
            setLogoFit("contain");
          }
        }
      }).catch(()=>{
        // 네트워크 실패 시에도 데모는 견본 로고 폴백
        const DEMO_WITH_LOGO = new Set([
          "790f4713-0894-49a4-8e93-297f8f68a614",
          "6440c1c4-ab8c-42f0-a8c3-1ad731565d6f",
          "983d0315-4c2c-48cc-81b6-c7da291ed20a",
          "afb5c989-95c4-4a8b-9846-e63be0d27b09",
          "e6524f44-b0c7-4897-83c0-d934c5ed5e2a",
          "18bcc7b5-e1b7-4915-a9a8-ca3711af895f",
        ]);
        if (DEMO_WITH_LOGO.has(surveyId)) {
          setLogoUrl("/logos/sampleLogo.gif");
          setLogoFit("contain");
        }
      });
    } else {
      const demoFields: TaxonomyField[] = [];
      setTaxonomyFields(demoFields);
    }
  },[surveyId, searchParams]);

  function inferBranchFromRaw(raw: Record<string, unknown>, parsed: ParsedForm): QuestionOverrides {
    const items = raw.items as unknown[] | undefined;
    if (!items) return {};
    const pageBreakIds: string[] = [];
    for (const it of items as Record<string, unknown>[]) {
      if ((it as Record<string, unknown>).pageBreakItem !== undefined) {
        const id = String((it as Record<string, unknown>).itemId || "");
        if (id) pageBreakIds.push(id);
      }
    }
    // sectionId -> 페이지 인덱스 (pageBreakIds 순서 기반: 0=첫 페이지, 1=첫 브레이크 이후, ...)
    const sectionToPage = (sid: string): number | null => {
      const idx = pageBreakIds.indexOf(sid);
      if (idx >= 0) return idx + 1;
      return null;
    };
    const overrides: QuestionOverrides = {};
    // 각 questionItem의 choice 옵션 goToSectionId 파싱
    for (const it of items as Record<string, unknown>[]) {
      const qi = (it as Record<string, unknown>).questionItem as Record<string, unknown> | undefined;
      if (!qi) continue;
      const q = qi.question as Record<string, unknown> | undefined;
      if (!q) continue;
      const qId = String(q.questionId || (it as Record<string, unknown>).itemId || "");
      const cq = q.choiceQuestion as Record<string, unknown> | undefined;
      if (!cq) continue;
      const opts = cq.options as { value: string; goToSectionId?: string }[] | undefined;
      if (!opts || opts.length === 0) continue;
      const hasBranch = opts.some(o => !!o.goToSectionId);
      if (!hasBranch) continue;
      const branchMap: Record<string, number | "END"> = {};
      for (const o of opts) {
        if (!o.goToSectionId) continue;
        // SUBMIT 같은 특수값은 END로, 그 외는 페이지 매핑
        const sid = String(o.goToSectionId);
        if (sid.toUpperCase() === "SUBMIT") {
          branchMap[o.value] = "END";
        } else {
          const pageIdx = sectionToPage(sid);
          if (pageIdx !== null) branchMap[o.value] = pageIdx;
        }
      }
      if (Object.keys(branchMap).length > 0) {
        // parsed에 해당 질문이 실제로 존재하는지 확인 (지원 유형만)
        const exists = parsed.questions.some(pq => pq.id === qId);
        if (!exists) continue;
        overrides[qId] = { branchEnabled: true, branchMap };
      }
    }
    return overrides;
  }

  function setAns(id: string, v: string | string[] | Record<string,string>) {
    setAnswers(a=>({ ...a, [id]: v }));
    setFieldErrors(prev=>{ if(!prev[id]) return prev; const n={...prev}; delete n[id]; return n; });
    if (globalPopup) setGlobalPopup(null);
  }
  function setTax(key: string, v: string) { setTaxonomyValues(a=>({ ...a, [key]: v })); }
  function setGridAns(gridId: string, rowId: string, col: string) {
    setAnswers(a=>{
      const cur = (a[gridId] as Record<string,string> | undefined) || {};
      return { ...a, [gridId]: { ...cur, [rowId]: col } };
    });
    setFieldErrors(prev=>{ if(!prev[gridId]) return prev; const n={...prev}; delete n[gridId]; return n; });
    if (globalPopup) setGlobalPopup(null);
  }

  const isCookieMode = duplicateCheckType === "cookie" || surveyId === "6440c1c4-ab8c-42f0-a8c3-1ad731565d6f";
  const emailTypo = email ? checkEmailTypo(email) : null;

  // 교육과정 선택 복구 — 구글 폼에 과정 선택 문항이 없어 안내(①/②)와 불일치하므로 합성 문항 주입 (데모/실사용 공통)
  const EDU_COURSE_SURVEY_ID = "18bcc7b5-e1b7-4915-a9a8-ca3711af895f";
  const EDU_COURSE_QUESTION_ID = "syn_course_edu_18bcc7b5";
  const eduCourseQuestion: ParsedQuestion = {
    id: EDU_COURSE_QUESTION_ID,
    title: "희망 교육과정 선택",
    type: "RADIO",
    required: true,
    rawType: "RADIO",
    options: [
      "교육과정 ① 산업체 대상 AI 실무교육 (2026.09.15 14:00~17:00)",
      "교육과정 ② 생성형 AI(ChatGPT) 업무 활용 (2026.09.22 14:00~17:00)",
    ],
  };
  function getEffectiveQuestions(): ParsedQuestion[] {
    if (!form) return [];
    if (surveyId !== EDU_COURSE_SURVEY_ID) return form.questions;
    if (form.questions.some(q => q.id === EDU_COURSE_QUESTION_ID)) return form.questions;
    // 연락처(인덱스 3) 다음, 이메일(인덱스 4) 전에 삽입 — 기존 순서 유지
    const arr = [...form.questions];
    const insertAt = Math.min(4, arr.length);
    arr.splice(insertAt, 0, eduCourseQuestion);
    return arr;
  }

  function showGlobal(msg: string) { setStatus(msg); setGlobalPopup(msg); }
  function clearPopups() { setStatus(""); setGlobalPopup(null); setFieldErrors({}); }
  function setFieldErrorFromMessage(msg: string) {
    if (!form) { showGlobal(msg); return; }
    // "필수 문항을 입력하세요: 제목" 또는 "‘제목’은(는) ..." 에서 제목 추출
    const m = msg.match(/:\s*(.+)$/) || msg.match(/‘(.+?)’/);
    const title = m ? m[1].trim() : "";
    let targetId: string | null = null;
    if (title) {
      const hit = form.questions.find(q => q.title === title || q.title.includes(title) || title.includes(q.title));
      if (hit) targetId = hit.id;
      // GRID 행 제목인 경우 부모 GRID id 찾기
      if (!targetId) {
        for (const q of form.questions) {
          if (q.type === "GRID" && q.gridRows) {
            const rowHit = q.gridRows.find(r => r.title === title || title.includes(r.title));
            if (rowHit) { targetId = q.id; break; }
          }
        }
      }
    }
    if (targetId) {
      setFieldErrors(prev => ({ ...prev, [targetId!]: msg }));
      // 해당 문항으로 스크롤 (가리지 않게 상단 여백)
      setTimeout(()=>{
        document.getElementById(`q-${targetId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 100);
    }
    showGlobal(msg);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (isSubmitting) return;
    clearPopups();
    if (branchEnded) { showGlobal("분기 종료 상태에서는 제출할 수 없습니다. ‘이전’으로 돌아가거나 홈으로 이동하세요."); return; }
    // 이메일/동의 검증 — 강의 평가는 쿠키 기반이므로 이메일/동의 없음, 그 외는 이메일 필수 + 개인정보 동의 필수
    if (!isCookieMode) {
      if (!email.trim()) { showGlobal("이메일을 입력해 주세요. 중복 체크와 접수 확인 회신을 위해 필요합니다."); setFieldErrors(prev=> ({...prev, email: "이메일을 입력해 주세요."})); setTimeout(()=> document.getElementById("q-email")?.scrollIntoView({ behavior: "smooth", block: "center" }), 100); return; }
      if (emailTypo && !emailTypo.ok) {
        const sug = emailTypo.suggestion ? ` → ‘${emailTypo.suggestion}’(으)로 교정해 보세요.` : "";
        showGlobal(`이메일 오타 차단: ${emailTypo.reason}${sug}`);
        setFieldErrors(prev=> ({...prev, email: emailTypo.reason}));
        setTimeout(()=> document.getElementById("q-email")?.scrollIntoView({ behavior: "smooth", block: "center" }), 100);
        return;
      }
      if (!consentChecked) {
        showGlobal("개인정보 수집·이용에 동의해 주세요. 중복 체크와 접수 확인 회신을 위해 필요합니다.");
        setFieldErrors(prev=> ({...prev, consent: "개인정보 수집·이용에 동의해 주세요."}));
        setTimeout(()=> document.getElementById("q-consent")?.scrollIntoView({ behavior: "smooth", block: "center" }), 100);
        return;
      }
    } else {
      // 쿠키 기반은 이메일 오타만 있으면 차단 (이메일이 있을 때만)
      if (email && emailTypo && !emailTypo.ok) {
        const sug = emailTypo.suggestion ? ` → ‘${emailTypo.suggestion}’(으)로 교정해 보세요.` : "";
        showGlobal(`이메일 오타 차단: ${emailTypo.reason}${sug}`);
        return;
      }
    }
    const taxErr = validateTaxonomyValues(taxonomyFields, taxonomyValues);
    if (taxErr) { showGlobal(`분류 오류: ${taxErr}`); return; }
    // 문항 검증 (필수/검증 프리셋) — 교육과정 합성 문항 포함 + 분기 스킵 문항 제외
    if (form) {
      const effQ = getEffectiveQuestions();
      const breaks = (form as ParsedForm).sectionBreaks;
      const allPages: ParsedForm["questions"][] = (() => {
        if (breaks && breaks.length > 0) {
          const points = [0, ...breaks, effQ.length];
          return points.slice(0, -1).map((s, i) => effQ.slice(s, points[i + 1]));
        }
        const chunk = 5;
        const res: ParsedForm["questions"][] = [];
        for (let i = 0; i < effQ.length; i += chunk) res.push(effQ.slice(i, i + chunk));
        return res.length ? res : [effQ];
      })();
      const total = allPages.length;
      // 분기 도달 가능 페이지 계산 — branching answers에 따라 건너뛴 페이지 제외 (실사용 필수 검증 방지)
      const reachable = new Set<number>();
      let cur = 0;
      reachable.add(0);
      const maxLoop = total * 2;
      for (let loop = 0; loop < maxLoop; loop++) {
        if (cur >= total - 1) break;
        const qs = allPages[cur] || [];
        const nxt = getNextPageIndex(cur, total, qs.map(q=>({id:q.id})), answers, overrides);
        if (nxt === "END") break;
        const nextIdx = typeof nxt === "number" ? nxt : cur + 1;
        if (nextIdx <= cur) break;
        if (nextIdx >= total) break;
        // cur+1 .. nextIdx-1 은 분기로 건너뛰므로 도달 불가 — visited에 있어도 제외
        reachable.add(nextIdx);
        cur = nextIdx;
      }
      // 현재 페이지도 포함 (사용자가 직접 이동한 경우)
      reachable.add(page);
      // visited와 교집합이 아닌 reachable만으로 검증 — 건너뛴 페이지는 visited에 있어도 제외되어 3번 문항 오류 방지
      const visitedIds = new Set<string>();
      for (const pIdx of reachable) {
        for (const qq of (allPages[pIdx] || [])) visitedIds.add(qq.id);
      }
      const effQ2 = getEffectiveQuestions();
      const qErr = validateAnswers(effQ2.map(q=>({ id:q.id, title:q.title, required:q.required, type:q.type, gridRows: q.gridRows })), answers, overrides, visitedIds);
      if (qErr) { setFieldErrorFromMessage(qErr); return; }
    }
    // 체크박스 최대 선택 수 검증 (구글폼 "최대 3개" 대응 — Forms API는 검증 규칙을 노출하지 않아 제목으로 유추)
    if (form) {
      const effQ3 = getEffectiveQuestions();
      for (const q of effQ3) {
        if (q.type === "CHECKBOX" && q.maxChoices) {
          const arr = (answers[q.id] as string[]) || [];
          if (arr.length > q.maxChoices) {
            const msg = `‘${q.title}’은(는) 최대 ${q.maxChoices}개까지 선택 가능합니다. (${arr.length}/${q.maxChoices})`;
            setFieldErrorFromMessage(msg);
            return;
          }
        }
        // GRID는 행별 독립 평가(1~5순위 각각) — 중복 허용 (10개 항목을 5개 순위로 평가하므로 같은 순위 중복이 정상)
      }
    }
    setIsSubmitting(true);
    setStatus("제출 중 입니다. 잠시 기다려 주세요.");
    setGlobalPopup("제출 중 입니다. 잠시 기다려 주세요.");
    const dupKey = `survey_${surveyId}_submitted`;
    if (localStorage.getItem(dupKey)) {
      // 쿠키 기반 경고는 제출 중 모달과 별개로, 제출 후에도 표시되지만 진행은 계속
      console.warn("이미 제출한 것으로 기록되어 있습니다. (쿠키 기반 — 우회 가능)");
    }
    const payload = { surveyId, email, answers, taxonomy: taxonomyValues };
    try {
      const r = await fetch("/api/submit", { method:"POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify(payload) });
      const j = await r.json();
      if (!r.ok) {
        const sug = j.suggestion ? ` → ‘${j.suggestion}’(으)로 교정해 보세요.` : "";
        showGlobal(`오류: ${j.error}${sug}`);
        return;
      }
      localStorage.setItem(dupKey, "1");
      document.cookie = `${dupKey}=1; path=/; max-age=31536000`;
      setDone({ presetLabel: j.presetLabel, presetBody: j.presetBody });
      setStatus("");
      setGlobalPopup(null);
    } finally {
      setIsSubmitting(false);
    }
  }

   if (done) {
      return (
        <div className="mx-auto max-w-[816px] w-full px-6 py-16 text-center" style={{maxWidth:816}}>
          <div className="border dark:border-zinc-800 rounded-2xl p-8 bg-white dark:bg-zinc-900">
            <h2 className="text-xl font-bold dark:text-white">{done.presetLabel}</h2>
            <p className="mt-2 text-zinc-600 dark:text-zinc-300">{done.presetBody}</p>
            <p className="mt-4 text-xs text-zinc-500 dark:text-zinc-400">확인 메일이 발송되었습니다. (Resend 키 없을 시 스킵)</p>
            <Link href="/" className="inline-block mt-6 text-sm border dark:border-zinc-700 rounded-full px-5 py-2 dark:text-white">홈으로</Link>
          </div>
        </div>
      );
    }

    if (!form) return <div className="mx-auto max-w-[816px] w-full px-6 py-16 text-center text-zinc-500 dark:text-zinc-400" style={{maxWidth:816}}>설문 로딩 중…</div>;

    function renderDesc(text: string) {
      // 강의 평가 템플릿처럼 단락 구분: \n\n 유지 + 대학 행사/교육신청서 템플릿 단락 공백 주입
      const normalized = text.replace(/\r\n/g, "\n")
        .replace(/\n(?=조사 대상\s*:)/g, "\n\n")
        .replace(/\n(?=소요 시간\s*:)/g, "\n")
        .replace(/\n(?=익명성 보장\s*:)/g, "\n")
        .replace(/(익명성 보장\s*:[^\n]*)\n(?=바쁘)/g, "$1\n\n")
        // 교육신청서: "동일 교육과정은 중복 신청할 수 없습니다." 뒤 단락 여백
        .replace(/(동일 교육과정은 중복 신청할 수 없습니다\.)\s*\n/g, "$1\n\n")
        // 교육신청서: "모집방법: 선착순" 뒤 단락 여백 (과정별 반복 포함)
        .replace(/(모집방법:\s*선착순)\s*\n/g, "$1\n\n")
        // 고객만족도(산업체): "우수 인재 배출에 반영하고자 실시됩니다." 뒤 단락 여백
        .replace(/(우수 인재 배출에 반영하고자 실시됩니다\.)\s*\n/g, "$1\n\n");
      const lines = normalized.split("\n");
      const out: React.ReactNode[] = [];
      for (let li = 0; li < lines.length; li++) {
        const line = lines[li];
        const trimmed = line.trim();
        if (!trimmed) { out.push(<div key={li} className="h-3" />); continue; }
        // 조사 대상 / 소요 시간 / 익명성 보장 명시적 볼드 매핑
        const boldTargets = ["조사 대상", "소요 시간", "익명성 보장"];
        const parts = line.split(/(\*\*.*?\*\*)/g);
        const nodes: React.ReactNode[] = (parts as string[]).flatMap((p: string, i: number): React.ReactNode[] => {
          if (p.startsWith("**") && p.endsWith("**")) return [<strong key={`${li}-${i}-b`} className="font-semibold text-zinc-900 dark:text-white">{p.slice(2, -2)}</strong>];
          if (p.match(/^\[.*\]$/)) return [<strong key={`${li}-${i}-br`} className="font-semibold text-zinc-900 dark:text-white">{p}</strong>];
          // 명시적 3키워드 먼저 볼드 치환
          for (const kw of boldTargets) {
            if (p.includes(kw)) {
              const segs = p.split(kw);
              const res: React.ReactNode[] = [];
              for (let k = 0; k < segs.length; k++) {
                if (k > 0) res.push(<strong key={`${li}-${i}-kw-${k}`} className="font-semibold text-zinc-900 dark:text-white">{kw}</strong>);
                if (segs[k]) {
                  // 남은 콜론 전 볼드 로직은 아래에서 처리하므로 일단 span으로
                  res.push(<span key={`${li}-${i}-seg-${k}`}>{segs[k]}</span>);
                }
              }
              // segs 내부에 :가 있으면 이후 colon 로직에서 다시 볼드될 수 있으니 일단 반환 (중복 볼드 방지 위해 kw는 이미 볼드)
              // 간단히 colon 로직 스킵하고 res 반환
              // 하지만 : 뒤 텍스트가 있으면 그대로 둠
              // colons가 segs에 포함된 경우 추가 처리 불필요 — kw가 이미 볼드이므로 그대로
              return res;
            }
          }
          if (p.includes(":")) {
            const segs: React.ReactNode[] = [];
            let rest: string = p;
            let si = 0;
            while (rest.includes(":")) {
              const idx = rest.indexOf(":");
              const before: string = rest.slice(0, idx);
              const afterColon: string = rest.slice(idx + 1);
              const beforeTrim = before.trimEnd();
              const lastSep = Math.max(beforeTrim.lastIndexOf(" "), beforeTrim.lastIndexOf("~"), beforeTrim.lastIndexOf("("));
              const prefix = lastSep >= 0 ? beforeTrim.slice(lastSep + 1).trim() : beforeTrim.trim();
              const head = lastSep >= 0 ? before.slice(0, lastSep + 1) : "";
              if (prefix.length >= 1 && prefix.length <= 12 && !prefix.includes("http") && !prefix.includes("//")) {
                segs.push(<span key={`${li}-${i}-${si++}`}>{head}<strong className="font-semibold text-zinc-900 dark:text-white">{prefix}</strong>:</span>);
              } else {
                segs.push(<span key={`${li}-${i}-${si++}`}>{before}:</span>);
              }
              rest = afterColon;
              if (rest === "") break;
            }
            if (rest) segs.push(<span key={`${li}-${i}-${si++}`}>{rest}</span>);
            return segs as React.ReactNode[];
          }
          return [<span key={`${li}-${i}`}>{p}</span>];
        });
        out.push(<div key={li}>{nodes}</div>);
      }
      return out;
    }

  // 페이지네이션: 섹션이 있으면 섹션 우선, 없으면 5문항씩 — 교육과정 합성 문항 포함
  const pages: ParsedForm["questions"][] = (() => {
    if (!form) return [];
    const eff = getEffectiveQuestions();
    const breaks = (form as ParsedForm).sectionBreaks;
    if (breaks && breaks.length > 0) {
      const points = [0, ...breaks, eff.length];
      return points.slice(0, -1).map((s, i) => eff.slice(s, points[i + 1]));
    }
    const chunk = 5;
    const res: ParsedForm["questions"][] = [];
    for (let i = 0; i < eff.length; i += chunk) res.push(eff.slice(i, i + chunk));
    return res.length ? res : [eff];
  })();
  const currentQuestions = pages[page] || [];
  const isLastPage = page === pages.length - 1;
  const totalPages = pages.length;

  function handleNext() {
    clearPopups();
    // 체크박스 최대 선택 수 먼저 (기존 로직 유지)
    for (const q of currentQuestions) {
      const v = answers[q.id];
      if (q.type === "CHECKBOX" && q.maxChoices) {
        const arr = (v as string[]) || [];
        if (arr.length > q.maxChoices) {
          const msg = `‘${q.title}’은(는) 최대 ${q.maxChoices}개까지 선택 가능합니다. (${arr.length}/${q.maxChoices})`;
          setFieldErrorFromMessage(msg);
          return;
        }
      }
    }
    // 문항 검증 (필수/검증 프리셋) — 현재 페이지 문항만
    {
      const qErr = validateAnswers(currentQuestions.map(q=>({ id:q.id, title:q.title, required:q.required, type:q.type, gridRows: (q as ParsedForm["questions"][number]).gridRows })), answers, overrides);
      if (qErr) { setFieldErrorFromMessage(qErr); return; }
    }
    if (page === 0) {
      if (!isCookieMode) {
        const t = checkEmailTypo(email);
        if (email && t && !t.ok) { showGlobal(`이메일 오타: ${t.reason}`); return; }
        // 이메일은 제출 시 필수로 검증, 다음 이동 시에는 오타만 차단
      } else {
        if (email) {
          const t = checkEmailTypo(email);
          if (t && !t.ok) { showGlobal(`이메일 오타: ${t.reason}`); return; }
        }
      }
      const taxErr = validateTaxonomyValues(taxonomyFields, taxonomyValues);
      if (taxErr) { showGlobal(`분류 오류: ${taxErr}`); return; }
    }
    // 조건부 분기
    const next = getNextPageIndex(page, totalPages, currentQuestions.map(q=>({ id: q.id })), answers, overrides);
    if (next === "END") {
      setBranchEnded(true);
      showGlobal("선택하신 응답에 따라 설문이 종료되었습니다. 제출하지 않고 종료하려면 홈으로 이동하세요 — 제출하려면 마지막 페이지로 이동해 제출하세요.");
      return;
    }
    clearPopups();
    setBranchEnded(false);
    const target = typeof next === "number" ? next : page;
    if (typeof next === "number" && next !== page + 1) {
      setPage(next);
      setVisited(v=> { const n=new Set(v); n.add(next); return n; });
    } else {
      setPage(p => { const n=Math.min(p + 1, totalPages - 1); setVisited(v=>{ const s=new Set(v); s.add(n); return s; }); return n; });
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function handlePrev() {
    clearPopups();
    setBranchEnded(false);
    setPage(p => Math.max(p - 1, 0));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

      return (
       <div className="mx-auto max-w-[816px] w-full px-6 py-8" style={{maxWidth:816}}>
         {logoUrl && (
           <div className="flex justify-center mb-4">
             <img
               src={logoUrl}
               alt="대학 로고"
               onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
               className="block"
               style={
                 logoFit === "height_fixed"
                   ? { height: 240, width: "auto", maxWidth: "100%", objectFit: "contain" }
                   : logoFit === "width_fixed"
                   ? { width: 240, height: "auto", maxHeight: 240, objectFit: "contain" }
                   : { maxWidth: 240, maxHeight: 240, width: "auto", height: "auto", objectFit: "contain" }
               }
             />
           </div>
         )}
         <h1 className="text-2xl font-bold dark:text-white text-center">{form.title}</h1>
         {form.description && <div className="text-sm text-zinc-600 dark:text-zinc-300 mt-2 whitespace-pre-wrap leading-relaxed space-y-1">{renderDesc(form.description)}</div>}
         {form.unsupported.length>0 && (
          <div className="mt-4 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-xl p-3 text-sm text-amber-800 dark:text-amber-200">
            ⚠️ 지원되지 않는 문항 {form.unsupported.length}개가 있어 표시하지 않았습니다.
          </div>
        )}
        {status && !globalPopup && <p className="mt-3 text-sm text-amber-700 dark:text-amber-300">{status}</p>}
         <form onSubmit={submit} className="mt-6 space-y-5 border dark:border-zinc-800 rounded-2xl p-6 bg-white dark:bg-zinc-900">
          {!isCookieMode ? (
          <label id="q-email" className="block text-sm dark:text-white scroll-mt-24">이메일 (중복 체크·확인 메일용) <span className="text-red-500">*</span>
            <input type="email" value={email} onChange={e=>{ setEmail(e.target.value); if(fieldErrors.email) setFieldErrors(prev=>{ const n={...prev}; delete n.email; return n; }); if(globalPopup) setGlobalPopup(null); }} className={`mt-1 w-full border rounded-lg px-3 py-2 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder:text-zinc-400 ${emailTypo && !emailTypo.ok ? "border-red-300 dark:border-red-700" : fieldErrors.email ? "border-red-300 dark:border-red-700" : "border-zinc-300 dark:border-zinc-700"}`} placeholder="you@example.com" />
            {emailTypo && !emailTypo.ok ? (
              <div className="mt-1 text-xs flex items-center gap-2">
                <span className="text-red-600 dark:text-red-400">⚠️ {emailTypo.reason}</span>
                {emailTypo.suggestion && <button type="button" onClick={()=>setEmail(emailTypo.suggestion!)} className="underline text-blue-600 dark:text-blue-400">‘{emailTypo.suggestion}’로 교정</button>}
              </div>
            ) : fieldErrors.email ? (
              <div className="mt-1 text-xs text-red-600 dark:text-red-400">⚠️ {fieldErrors.email}</div>
            ) : <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">오타(never.com→naver.com 등) 자동 검사됨 — @ 누락·도메인 오타 시 제출 차단</p>}
          </label>
          ) : (
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800 rounded-lg px-3 py-2">이 설문은 <strong>쿠키 기반 중복 체크</strong>로 운영됩니다 — 이메일 없이도 제출 가능하며, 개인정보 수집·이용 동의가 필요 없습니다.</p>
          )}
         {/* 분류 필드 */}
         {taxonomyFields.map(f=>{
           const isHidden = f.hidden && taxonomyValues[f.key];
           if (isHidden) {
             return <input key={f.key} type="hidden" value={taxonomyValues[f.key]} readOnly />;
           }
           if (f.hidden && !taxonomyValues[f.key] && f.required) {
             // hidden인데 URL에 없음 → 노출로 폴백 (경고)
             return (
               <label key={f.key} className="block text-sm font-medium dark:text-white">
                 {f.label} <span className="text-red-500">*</span> <span className="text-[11px] text-amber-600 dark:text-amber-400">(링크에 분류 값이 없어 직접 입력)</span>
                 {f.type==="select" ? (
                   <select value={taxonomyValues[f.key]||""} onChange={e=>setTax(f.key, e.target.value)} required={f.required} className="mt-1 w-full border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-2 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white">
                     <option value="">선택하세요</option>
                     {f.options?.map(opt=><option key={opt} value={opt}>{opt}</option>)}
                   </select>
                 ) : (
                   <input value={taxonomyValues[f.key]||""} onChange={e=>setTax(f.key, e.target.value)} required={f.required} className="mt-1 w-full border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-2 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white" placeholder={f.label} />
                 )}
               </label>
             );
           }
           if (f.hidden) return null; // hidden + 값 있음 → 렌더 안 함
           return (
             <label key={f.key} className="block text-sm font-medium dark:text-white">
               {f.label} {f.required && <span className="text-red-500">*</span>}
               {f.type==="select" ? (
                 <select value={taxonomyValues[f.key]||""} onChange={e=>setTax(f.key, e.target.value)} required={f.required} className="mt-1 w-full border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-2 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white">
                   <option value="">선택하세요</option>
                   {f.options?.map(opt=><option key={opt} value={opt}>{opt}</option>)}
                 </select>
               ) : (
                 <input value={taxonomyValues[f.key]||""} onChange={e=>setTax(f.key, e.target.value)} required={f.required} className="mt-1 w-full border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-2 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white" placeholder={f.label} />
               )}
             </label>
           );
         })}
          {taxonomyFields.length>0 && <p className="text-[11px] text-zinc-500 dark:text-zinc-400">분류: {taxonomyFields.map(f=>`${f.label}(${f.key})`).join(", ")} — 숨김 필드는 URL로 자동 기록됩니다.</p>}
        {totalPages > 1 && (
          <div className="flex justify-between items-center text-xs text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800 rounded-full px-3 py-1">
            <span>페이지 {page + 1} / {totalPages}</span>
            <span>{getEffectiveQuestions().length}문항</span>
          </div>
        )}
          {currentQuestions.map(q=>{
            const ovEff = ensureDefaults(overrides[q.id]);
            const effReq = ovEff.required !== null ? !!ovEff.required : !!q.required;
            return (
            <div key={q.id} id={`q-${q.id}`} className="border-t pt-4 first:border-0 first:pt-0 scroll-mt-24">
              <label className="text-sm font-medium dark:text-white">{q.title} {effReq && <span className="text-red-500">*</span>}</label>
             {q.description && <p className="text-xs text-zinc-500 dark:text-zinc-400">{q.description}</p>}
              {q.type==="TEXT" && (()=>{ const ovEff=ensureDefaults(overrides[q.id]); const effReq=ovEff.required!==null?!!ovEff.required:!!q.required; const isPhone = q.title.includes("전화번호") || q.title.includes("연락처") || q.title.includes("휴대폰"); const ph = isPhone ? "예: 01012341004 (- 없이 입력)" : q.title.includes("이메일") ? "예: you@example.com" : "단답형"; return <input value={(answers[q.id] as string)||""} onChange={e=>setAns(q.id, e.target.value)} required={effReq} inputMode={isPhone ? "numeric" : undefined} pattern={isPhone ? "[0-9]*" : undefined} className="mt-2 w-full border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white" placeholder={ph} />;})()}
              {q.type==="PARAGRAPH_TEXT" && (()=>{ const ovEff=ensureDefaults(overrides[q.id]); const effReq=ovEff.required!==null?!!ovEff.required:!!q.required; return <textarea value={(answers[q.id] as string)||""} onChange={e=>setAns(q.id, e.target.value)} required={effReq} className="mt-2 w-full border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white" rows={4} placeholder="장문형" />;})()}
              {q.type==="RADIO" && q.rawType==="SCALE" && (
                <div className="mt-3 overflow-x-auto">
                  <div className="min-w-[560px] border border-zinc-200 dark:border-zinc-700 rounded-xl overflow-hidden">
                    <div className="grid" style={{gridTemplateColumns:`110px repeat(${q.options?.length||7},1fr) 110px`}}>
                      <div className="text-[11px] text-zinc-400 p-2"></div>
                      {(q.options||[]).map(o=><div key={o} className="text-center text-xs font-medium text-zinc-700 dark:text-zinc-300 p-2">{o}</div>)}
                      <div className="text-[11px] text-zinc-400 p-2"></div>
                    </div>
                    <div className="grid border-t dark:border-zinc-700" style={{gridTemplateColumns:`110px repeat(${q.options?.length||7},1fr) 110px`}}>
                      <div className="text-[11px] text-zinc-600 dark:text-zinc-400 p-2 text-right pr-1 break-keep whitespace-nowrap">{q.scaleLowLabel || "전혀 그렇지 않다"}</div>
                       {(q.options||[]).map(o=>{
                        const ovEffSc=ensureDefaults(overrides[q.id]); const effReqSc=ovEffSc.required!==null?!!ovEffSc.required:!!q.required;
                        return (
                        <label key={o} className="flex justify-center items-center p-2">
                          <input type="radio" name={q.id} checked={answers[q.id]===o} onChange={()=>setAns(q.id,o)} required={effReqSc} className="accent-zinc-900" />
                        </label>
                      );})}
                      <div className="text-[11px] text-zinc-600 dark:text-zinc-400 p-2 break-keep whitespace-nowrap">{q.scaleHighLabel || "매우 그렇다"}</div>
                    </div>
                  </div>
                </div>
              )}
              {q.type==="RADIO" && q.rawType!=="SCALE" && (()=>{ const ovEff=ensureDefaults(overrides[q.id]); const effReq=ovEff.required!==null?!!ovEff.required:!!q.required; return <div className="mt-2 space-y-2">{q.options?.map(opt=>(
                <label key={opt} className="flex items-center gap-2 text-sm dark:text-white"><input type="radio" name={q.id} checked={answers[q.id]===opt} onChange={()=>setAns(q.id,opt)} required={effReq} />{opt}</label>
              ))}</div>;})()}
              {q.type==="CHECKBOX" && (()=>{ const arr = (answers[q.id] as string[])||[]; const atLimit = q.maxChoices ? arr.length >= q.maxChoices : false; return (
                <div className="mt-2 space-y-2">
                  {q.maxChoices && <p className={`text-[11px] ${arr.length > q.maxChoices ? "text-red-600 dark:text-red-400" : "text-zinc-500 dark:text-zinc-400"}`}>최대 {q.maxChoices}개까지 선택 가능 ({arr.length}/{q.maxChoices}) {arr.length > q.maxChoices ? "— 초과 선택됨" : atLimit ? "— 추가 선택 시 경고" : ""}</p>}
                  {q.options?.map(opt=>{
                const checked = arr.includes(opt);
                const disabled = !checked && !!q.maxChoices && arr.length >= (q.maxChoices as number);
                return <label key={opt} className={`flex items-center gap-2 text-sm ${disabled ? "opacity-50" : ""} dark:text-white`}><input type="checkbox" checked={checked} disabled={disabled} onChange={e=>{
                  if (e.target.checked && q.maxChoices && arr.length >= (q.maxChoices as number)) {
                    setStatus(`‘${q.title}’은(는) 최대 ${q.maxChoices}개까지 선택 가능합니다.`);
                    return;
                  }
                  const next = e.target.checked ? [...arr, opt] : arr.filter(x=>x!==opt);
                  setStatus("");
                  setAns(q.id, next);
                }} />{opt}</label>;
              })}</div>
               );})()}
              {q.type==="GRID" && (()=>{
                const cols = q.gridColumns || q.options || [];
                const rows = q.gridRows || [];
                const map = (answers[q.id] as Record<string,string> | undefined) || {};
                const allFilled = rows.length > 0 && rows.every(r=> !!map[r.id]);
                return (
                  <div className="mt-3 overflow-x-auto">
                    <div className="min-w-[560px] border border-zinc-200 dark:border-zinc-700 rounded-xl overflow-hidden">
                      <div className="grid bg-zinc-50 dark:bg-zinc-800" style={{gridTemplateColumns:`1fr repeat(${cols.length}, 72px)`}}>
                        <div className="text-[11px] font-medium text-zinc-600 dark:text-zinc-300 p-2 border-b dark:border-zinc-700">항목 / 순위</div>
                        {cols.map(c=> <div key={c} className="text-center text-xs font-semibold text-zinc-700 dark:text-zinc-300 p-2 border-b dark:border-zinc-700 border-l dark:border-zinc-700">{c}</div>)}
                      </div>
                      {rows.map(row=>{
                        const sel = map[row.id];
                        return (
                          <div key={row.id} className="grid border-t dark:border-zinc-700" style={{gridTemplateColumns:`1fr repeat(${cols.length}, 72px)`}}>
                            <div className="text-sm text-zinc-800 dark:text-zinc-200 p-3 pr-2 border-r dark:border-zinc-700 bg-white dark:bg-zinc-900 flex items-center">{row.title} {effReq && <span className="text-red-500 ml-1">*</span>}</div>
                            {cols.map(col=>{
                              const checked = sel === col;
                              return (
                                <label key={col} className="flex justify-center items-center p-2 border-l dark:border-zinc-700 bg-white dark:bg-zinc-900">
                                  <input type="radio" name={`${q.id}_${row.id}`} checked={checked} onChange={()=>{ setGridAns(q.id, row.id, col); setStatus(""); }} className="accent-zinc-900" />
                                </label>
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>
                    <p className="mt-2 text-[11px] text-zinc-500 dark:text-zinc-400">{allFilled ? "✓ 모든 항목에 순위를 선택했습니다." : `각 행마다 하나의 순위를 선택하세요 — 행별 독립 평가, 같은 순위 중복 가능 (${Object.keys(map).length}/${rows.length})`}</p>
                  </div>
                );
              })()}
              {fieldErrors[q.id] && (
                <div className="mt-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2 text-xs text-red-700 dark:text-red-300 flex items-start gap-2">
                  <span>⚠️</span><span className="flex-1">{fieldErrors[q.id]}</span>
                  <button type="button" onClick={()=> setFieldErrors(prev=>{ const n={...prev}; delete n[q.id]; return n; })} className="ml-2 text-red-500 hover:text-red-700">✕</button>
                </div>
              )}
            </div>
          ); })}
          {!isCookieMode && isLastPage && (
            <div id="q-consent" className={`border rounded-xl p-4 scroll-mt-24 ${fieldErrors.consent ? "border-red-300 bg-red-50 dark:bg-red-950 dark:border-red-800" : "border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800"}`}>
              <label className="flex items-start gap-3 cursor-pointer">
                <input type="checkbox" checked={consentChecked} onChange={e=>{ setConsentChecked(e.target.checked); setFieldErrors(prev=>{ const n={...prev}; delete n.consent; return n; }); if(globalPopup) setGlobalPopup(null); }} className="mt-1 accent-zinc-900" />
                <span className="text-sm text-zinc-800 dark:text-zinc-200 leading-relaxed">중복 체크와 접수 확인 회신으로 위해 이메일 개인정보를 수집·이용하는 것에 동의합니다. <span className="text-red-500">*</span></span>
              </label>
              {fieldErrors.consent && <div className="mt-2 text-xs text-red-600 dark:text-red-400">⚠️ {fieldErrors.consent}</div>}
            </div>
          )}
        <div className="flex gap-3">
          {page > 0 && <button type="button" onClick={handlePrev} disabled={isSubmitting} className="flex-1 rounded-full border border-zinc-300 dark:border-zinc-700 py-3 text-sm font-medium dark:text-white disabled:opacity-50">이전</button>}
          {!isLastPage ? <button type="button" onClick={handleNext} disabled={isSubmitting} className="flex-1 rounded-full bg-black dark:bg-white dark:text-black text-white py-3 text-sm font-medium disabled:opacity-50">다음</button> : <button type="submit" disabled={isSubmitting} className="flex-1 rounded-full bg-black dark:bg-white dark:text-black text-white py-3 text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2">{isSubmitting ? <><span className="h-4 w-4 border-2 border-white dark:border-black border-t-transparent rounded-full animate-spin" /><span>제출 중…</span></> : "제출하기"}</button>}
        </div>
        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 text-center">{isCookieMode ? "제출 시 Supabase 기간/쿠키 중복 검증 → 분류 검증 → GAS write(분류 포함) — 이메일 없이 쿠키로 중복 체크" : "제출 시 Supabase 기간/이메일 중복 검증 → 분류 검증 → GAS write(분류 포함) → Resend 확인 메일 즉시 발송"}</p>
      </form>
      {globalPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" onClick={()=> { if (!isSubmitting) setGlobalPopup(null); }}>
          <div className="max-w-md w-full bg-white dark:bg-zinc-900 rounded-2xl p-6 border dark:border-zinc-800 shadow-xl" onClick={e=> e.stopPropagation()}>
            <p className="text-sm text-zinc-800 dark:text-zinc-200 leading-relaxed whitespace-pre-wrap">{globalPopup}</p>
            {isSubmitting && globalPopup.includes("제출 중") ? (
              <div className="mt-5 flex justify-center"><span className="h-6 w-6 border-2 border-zinc-300 dark:border-zinc-600 border-t-zinc-900 dark:border-t-white rounded-full animate-spin" /></div>
            ) : (
              <button onClick={()=> setGlobalPopup(null)} className="mt-5 w-full rounded-full bg-black dark:bg-white dark:text-black text-white py-2.5 text-sm font-medium">확인</button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
