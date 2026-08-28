"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { ParsedForm } from "@/lib/forms";
import { checkEmailTypo } from "@/lib/emailTypo";
import type { TaxonomyField } from "@/lib/taxonomy";
import { validateTaxonomyValues } from "@/lib/taxonomy";
import { ensureDefaults, validateAnswers, getNextPageIndex, type QuestionOverrides } from "@/lib/questionConfig";

export default function SurveyRenderer({ surveyId }: { surveyId: string }) {
  const searchParams = useSearchParams();
  const [form, setForm] = useState<ParsedForm | null>(null);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [taxonomyFields, setTaxonomyFields] = useState<TaxonomyField[]>([]);
  const [taxonomyValues, setTaxonomyValues] = useState<Record<string, string>>({});
  const [overrides, setOverrides] = useState<QuestionOverrides>({});
  const [branchEnded, setBranchEnded] = useState(false);
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<string>("");
  const [done, setDone] = useState<{ presetLabel: string; presetBody: string } | null>(null);
  const [page, setPage] = useState(0);
  const [visited, setVisited] = useState<Set<number>>(()=> new Set([0]));

  useEffect(()=>{
    fetch(`/api/forms/${surveyId}`).then(r=>r.json()).then(j=>{
      if (j.form) {
        // 설문 제목은 Supabase surveys.title을 우선 사용 — Google Form의 documentTitle/title이 비어도 Supabase에 저장된 제목으로 표시
        // 1Ifoy... 처럼 formId 폴백(주소 노출) 방지
        setForm(j.form); setPage(0);
      }
      // 미지원 문항 안내는 배너(form.unsupported)로 이미 표시되므로 status 중복 방지 — 에러성 warning만 상태로 노출
      if (j.warning && !j.warning.includes("지원되지 않는 문항")) setStatus(j.warning);
    }).catch(()=>setStatus("폼 로드 실패"));
    // taxonomy + question_overrides + title meta
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
        if (j.survey?.question_overrides) setOverrides(j.survey.question_overrides as QuestionOverrides);
        if (j.survey?.title) {
          const surveyTitle = j.survey.title as string;
          setForm(prev => prev ? { ...prev, title: surveyTitle } : prev);
        }
      }).catch(()=>{});
    } else {
      const demoFields: TaxonomyField[] = [];
      setTaxonomyFields(demoFields);
    }
  },[surveyId, searchParams]);

  function setAns(id: string, v: string | string[]) { setAnswers(a=>({ ...a, [id]: v })); }
  function setTax(key: string, v: string) { setTaxonomyValues(a=>({ ...a, [key]: v })); }

  const emailTypo = email ? checkEmailTypo(email) : null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (branchEnded) { setStatus("분기 종료 상태에서는 제출할 수 없습니다. ‘이전’으로 돌아가거나 홈으로 이동하세요."); return; }
    if (emailTypo && !emailTypo.ok) {
      const sug = emailTypo.suggestion ? ` → ‘${emailTypo.suggestion}’(으)로 교정해 보세요.` : "";
      setStatus(`이메일 오타 차단: ${emailTypo.reason}${sug}`);
      return;
    }
    const taxErr = validateTaxonomyValues(taxonomyFields, taxonomyValues);
    if (taxErr) { setStatus(`분류 오류: ${taxErr}`); return; }
    // 문항 검증 (필수/검증 프리셋) — 방문한 페이지만 검증 (분기 스킵 문항은 제외)
    if (form) {
      const visitedIds = new Set<string>();
      const breaks = (form as ParsedForm).sectionBreaks;
      const allPages: ParsedForm["questions"][] = (() => {
        if (breaks && breaks.length > 0) {
          const points = [0, ...breaks, form.questions.length];
          return points.slice(0, -1).map((s, i) => form.questions.slice(s, points[i + 1]));
        }
        const chunk = 5;
        const res: ParsedForm["questions"][] = [];
        for (let i = 0; i < form.questions.length; i += chunk) res.push(form.questions.slice(i, i + chunk));
        return res.length ? res : [form.questions];
      })();
      for (const pIdx of visited) {
        for (const qq of (allPages[pIdx] || [])) visitedIds.add(qq.id);
      }
      // 현재 페이지도 포함
      for (const qq of currentQuestions) visitedIds.add(qq.id);
      const qErr = validateAnswers(form.questions.map(q=>({ id:q.id, title:q.title, required:q.required, type:q.type })), answers, overrides, visitedIds);
      if (qErr) { setStatus(qErr); return; }
    }
    // 체크박스 최대 선택 수 검증 (구글폼 "최대 3개" 대응 — Forms API는 검증 규칙을 노출하지 않아 제목으로 유추)
    if (form) {
      for (const q of form.questions) {
        if (q.type === "CHECKBOX" && q.maxChoices) {
          const arr = (answers[q.id] as string[]) || [];
          if (arr.length > q.maxChoices) {
            setStatus(`‘${q.title}’은(는) 최대 ${q.maxChoices}개까지 선택 가능합니다. (${arr.length}/${q.maxChoices})`);
            return;
          }
        }
      }
    }
    setStatus("제출 중…");
    const dupKey = `survey_${surveyId}_submitted`;
    if (localStorage.getItem(dupKey)) {
      setStatus("이미 제출한 것으로 기록되어 있습니다. (쿠키 기반 — 우회 가능)");
    }
    const payload = { surveyId, email, answers, taxonomy: taxonomyValues };
    const r = await fetch("/api/submit", { method:"POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify(payload) });
    const j = await r.json();
    if (!r.ok) {
      const sug = j.suggestion ? ` → ‘${j.suggestion}’(으)로 교정해 보세요.` : "";
      setStatus(`오류: ${j.error}${sug}`);
      return;
    }
    localStorage.setItem(dupKey, "1");
    document.cookie = `${dupKey}=1; path=/; max-age=31536000`;
    setDone({ presetLabel: j.presetLabel, presetBody: j.presetBody });
    setStatus("");
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
      // 강의 평가 템플릿처럼 단락 구분: \n\n 유지 + 대학 행사 템플릿은 조사 대상/소요 시간/익명성 보장 앞에 단락 공백 주입
      const normalized = text.replace(/\r\n/g, "\n")
        .replace(/\n(?=조사 대상\s*:)/g, "\n\n")
        .replace(/\n(?=소요 시간\s*:)/g, "\n")
        .replace(/\n(?=익명성 보장\s*:)/g, "\n")
        .replace(/(익명성 보장\s*:[^\n]*)\n(?=바쁘)/g, "$1\n\n");
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

  // 페이지네이션: 섹션이 있으면 섹션 우선, 없으면 5문항씩
  const pages: ParsedForm["questions"][] = (() => {
    if (!form) return [];
    const breaks = (form as ParsedForm).sectionBreaks;
    if (breaks && breaks.length > 0) {
      const points = [0, ...breaks, form.questions.length];
      return points.slice(0, -1).map((s, i) => form.questions.slice(s, points[i + 1]));
    }
    const chunk = 5;
    const res: ParsedForm["questions"][] = [];
    for (let i = 0; i < form.questions.length; i += chunk) res.push(form.questions.slice(i, i + chunk));
    return res.length ? res : [form.questions];
  })();
  const currentQuestions = pages[page] || [];
  const isLastPage = page === pages.length - 1;
  const totalPages = pages.length;

  function handleNext() {
    // 체크박스 최대 선택 수 먼저 (기존 로직 유지)
    for (const q of currentQuestions) {
      const v = answers[q.id];
      if (q.type === "CHECKBOX" && q.maxChoices) {
        const arr = (v as string[]) || [];
        if (arr.length > q.maxChoices) {
          setStatus(`‘${q.title}’은(는) 최대 ${q.maxChoices}개까지 선택 가능합니다. (${arr.length}/${q.maxChoices})`);
          return;
        }
      }
    }
    // 문항 검증 (필수/검증 프리셋) — 현재 페이지 문항만
    {
      const qErr = validateAnswers(currentQuestions.map(q=>({ id:q.id, title:q.title, required:q.required, type:q.type })), answers, overrides);
      if (qErr) { setStatus(qErr); return; }
    }
    if (page === 0) {
      const t = checkEmailTypo(email);
      if (email && t && !t.ok) { setStatus(`이메일 오타: ${t.reason}`); return; }
      const taxErr = validateTaxonomyValues(taxonomyFields, taxonomyValues);
      if (taxErr) { setStatus(`분류 오류: ${taxErr}`); return; }
    }
    // 조건부 분기
    const next = getNextPageIndex(page, totalPages, currentQuestions.map(q=>({ id: q.id })), answers, overrides);
    if (next === "END") {
      setBranchEnded(true);
      setStatus("선택하신 응답에 따라 설문이 종료되었습니다. 제출하지 않고 종료하려면 홈으로 이동하세요 — 제출하려면 마지막 페이지로 이동해 제출하세요.");
      return;
    }
    setStatus("");
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
    setStatus("");
    setBranchEnded(false);
    setPage(p => Math.max(p - 1, 0));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

      return (
       <div className="mx-auto max-w-[816px] w-full px-6 py-8" style={{maxWidth:816}}>
         <h1 className="text-2xl font-bold dark:text-white">{form.title}</h1>
         {form.description && <div className="text-sm text-zinc-600 dark:text-zinc-300 mt-2 whitespace-pre-wrap leading-relaxed space-y-1">{renderDesc(form.description)}</div>}
        {form.unsupported.length>0 && (
          <div className="mt-4 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-xl p-3 text-sm text-amber-800 dark:text-amber-200">
            ⚠️ 지원되지 않는 문항 {form.unsupported.length}개가 있어 표시하지 않았습니다.
          </div>
        )}
       {status && <p className="mt-3 text-sm text-amber-700 dark:text-amber-300">{status}</p>}
        <form onSubmit={submit} className="mt-6 space-y-5 border dark:border-zinc-800 rounded-2xl p-6 bg-white dark:bg-zinc-900">
         <label className="block text-sm dark:text-white">이메일 (중복 체크·확인 메일용)
           <input type="email" value={email} onChange={e=>setEmail(e.target.value)} className={`mt-1 w-full border rounded-lg px-3 py-2 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder:text-zinc-400 ${emailTypo && !emailTypo.ok ? "border-red-300 dark:border-red-700" : "border-zinc-300 dark:border-zinc-700"}`} placeholder="you@example.com" />
           {emailTypo && !emailTypo.ok ? (
             <div className="mt-1 text-xs flex items-center gap-2">
               <span className="text-red-600 dark:text-red-400">⚠️ {emailTypo.reason}</span>
               {emailTypo.suggestion && <button type="button" onClick={()=>setEmail(emailTypo.suggestion!)} className="underline text-blue-600 dark:text-blue-400">‘{emailTypo.suggestion}’로 교정</button>}
             </div>
           ) : emailTypo && emailTypo.ok ? (
             <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">오타(never.com→naver.com 등) 자동 검사됨 — @ 누락·도메인 오타 시 제출 차단</p>
           ) : null}
         </label>
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
            <span>{form.questions.length}문항</span>
          </div>
        )}
          {currentQuestions.map(q=>{
            const ovEff = ensureDefaults(overrides[q.id]);
            const effReq = ovEff.required !== null ? !!ovEff.required : !!q.required;
            return (
            <div key={q.id} className="border-t pt-4 first:border-0 first:pt-0">
              <label className="text-sm font-medium dark:text-white">{q.title} {effReq && <span className="text-red-500">*</span>}</label>
             {q.description && <p className="text-xs text-zinc-500 dark:text-zinc-400">{q.description}</p>}
              {q.type==="TEXT" && (()=>{ const ovEff=ensureDefaults(overrides[q.id]); const effReq=ovEff.required!==null?!!ovEff.required:!!q.required; return <input value={(answers[q.id] as string)||""} onChange={e=>setAns(q.id, e.target.value)} required={effReq} className="mt-2 w-full border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white" placeholder="단답형" />;})()}
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
            </div>
          ); })}
        <div className="flex gap-3">
          {page > 0 && <button type="button" onClick={handlePrev} className="flex-1 rounded-full border border-zinc-300 dark:border-zinc-700 py-3 text-sm font-medium dark:text-white">이전</button>}
          {!isLastPage ? <button type="button" onClick={handleNext} className="flex-1 rounded-full bg-black dark:bg-white dark:text-black text-white py-3 text-sm font-medium">다음</button> : <button type="submit" className="flex-1 rounded-full bg-black dark:bg-white dark:text-black text-white py-3 text-sm font-medium">제출하기</button>}
        </div>
        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 text-center">제출 시 Supabase 기간/중복 검증 → 분류 검증 → GAS write(분류 포함) → Resend 확인 메일 즉시 발송</p>
      </form>
    </div>
  );
}
