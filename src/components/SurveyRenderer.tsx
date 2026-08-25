"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { ParsedForm } from "@/lib/forms";
import { checkEmailTypo } from "@/lib/emailTypo";
import type { TaxonomyField } from "@/lib/taxonomy";
import { validateTaxonomyValues } from "@/lib/taxonomy";

export default function SurveyRenderer({ surveyId }: { surveyId: string }) {
  const searchParams = useSearchParams();
  const [form, setForm] = useState<ParsedForm | null>(null);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [taxonomyFields, setTaxonomyFields] = useState<TaxonomyField[]>([]);
  const [taxonomyValues, setTaxonomyValues] = useState<Record<string, string>>({});
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<string>("");
  const [done, setDone] = useState<{ presetLabel: string; presetBody: string } | null>(null);

  useEffect(()=>{
    fetch(`/api/forms/${surveyId}`).then(r=>r.json()).then(j=>{
      if (j.form) setForm(j.form);
      if (j.warning) setStatus(j.warning);
    }).catch(()=>setStatus("폼 로드 실패"));
    // taxonomy meta
    if (surveyId !== "demo") {
      fetch(`/api/surveys/${surveyId}`).then(r=>r.json()).then(j=>{
        if (j.survey?.taxonomy_fields) {
          const fields = j.survey.taxonomy_fields as TaxonomyField[];
          setTaxonomyFields(fields);
          // URL에서 hidden 값 주입
          const init: Record<string, string> = {};
          for (const f of fields) {
            const v = searchParams.get(f.key);
            if (v) init[f.key] = v;
          }
          if (Object.keys(init).length>0) setTaxonomyValues(init);
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
    if (emailTypo && !emailTypo.ok) {
      const sug = emailTypo.suggestion ? ` → ‘${emailTypo.suggestion}’(으)로 교정해 보세요.` : "";
      setStatus(`이메일 오타 차단: ${emailTypo.reason}${sug}`);
      return;
    }
    const taxErr = validateTaxonomyValues(taxonomyFields, taxonomyValues);
    if (taxErr) { setStatus(`분류 오류: ${taxErr}`); return; }
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
       <div className="mx-auto max-w-xl px-6 py-16 text-center">
         <div className="border dark:border-zinc-800 rounded-2xl p-8 bg-white dark:bg-zinc-900">
           <h2 className="text-xl font-bold dark:text-white">{done.presetLabel}</h2>
           <p className="mt-2 text-zinc-600 dark:text-zinc-300">{done.presetBody}</p>
           <p className="mt-4 text-xs text-zinc-500 dark:text-zinc-400">확인 메일이 발송되었습니다. (Resend 키 없을 시 스킵)</p>
           <Link href="/" className="inline-block mt-6 text-sm border dark:border-zinc-700 rounded-full px-5 py-2 dark:text-white">홈으로</Link>
         </div>
       </div>
     );
   }

    if (!form) return <div className="mx-auto max-w-xl px-6 py-16 text-center text-zinc-500 dark:text-zinc-400">설문 로딩 중…</div>;

    function renderDesc(text: string) {
      const parts = text.split(/(\*\*.*?\*\*)/g);
      return parts.map((p, i) => {
        if (p.startsWith("**") && p.endsWith("**")) return <strong key={i} className="font-semibold text-zinc-900 dark:text-white">{p.slice(2, -2)}</strong>;
        return <span key={i}>{p}</span>;
      });
    }

     return (
       <div className="mx-auto max-w-xl px-6 py-8">
         <h1 className="text-2xl font-bold dark:text-white">{form.title}</h1>
         {form.description && <div className="text-sm text-zinc-600 dark:text-zinc-300 mt-2 whitespace-pre-wrap leading-relaxed">{renderDesc(form.description)}</div>}
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
        {form.questions.map(q=>(
          <div key={q.id} className="border-t pt-4 first:border-0 first:pt-0">
            <label className="text-sm font-medium dark:text-white">{q.title} {q.required && <span className="text-red-500">*</span>}</label>
            {q.description && <p className="text-xs text-zinc-500 dark:text-zinc-400">{q.description}</p>}
            {q.type==="TEXT" && <input value={(answers[q.id] as string)||""} onChange={e=>setAns(q.id, e.target.value)} required={q.required} className="mt-2 w-full border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white" placeholder="단답형" />}
            {q.type==="PARAGRAPH_TEXT" && <textarea value={(answers[q.id] as string)||""} onChange={e=>setAns(q.id, e.target.value)} required={q.required} className="mt-2 w-full border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white" rows={4} placeholder="장문형" />}
            {q.type==="RADIO" && q.rawType==="SCALE" && (
              <div className="mt-3 overflow-x-auto">
                <div className="min-w-[420px] border border-zinc-200 dark:border-zinc-700 rounded-xl overflow-hidden">
                  <div className="grid" style={{gridTemplateColumns:`80px repeat(${q.options?.length||7},1fr) 80px`}}>
                    <div className="text-[11px] text-zinc-400 p-2"></div>
                    {(q.options||[]).map(o=><div key={o} className="text-center text-xs font-medium text-zinc-700 dark:text-zinc-300 p-2">{o}</div>)}
                    <div className="text-[11px] text-zinc-400 p-2"></div>
                  </div>
                  <div className="grid border-t dark:border-zinc-700" style={{gridTemplateColumns:`80px repeat(${q.options?.length||7},1fr) 80px`}}>
                    <div className="text-[11px] text-zinc-600 dark:text-zinc-400 p-2 text-right pr-1">{q.scaleLowLabel || "전혀 그렇지 않다"}</div>
                    {(q.options||[]).map(o=>(
                      <label key={o} className="flex justify-center items-center p-2">
                        <input type="radio" name={q.id} checked={answers[q.id]===o} onChange={()=>setAns(q.id,o)} required={q.required} className="accent-zinc-900" />
                      </label>
                    ))}
                    <div className="text-[11px] text-zinc-600 dark:text-zinc-400 p-2">{q.scaleHighLabel || "매우 그렇다"}</div>
                  </div>
                </div>
              </div>
            )}
            {q.type==="RADIO" && q.rawType!=="SCALE" && <div className="mt-2 space-y-2">{q.options?.map(opt=>(
              <label key={opt} className="flex items-center gap-2 text-sm dark:text-white"><input type="radio" name={q.id} checked={answers[q.id]===opt} onChange={()=>setAns(q.id,opt)} required={q.required} />{opt}</label>
            ))}</div>}
            {q.type==="CHECKBOX" && <div className="mt-2 space-y-2">{q.options?.map(opt=>{
              const arr = (answers[q.id] as string[])||[];
              const checked = arr.includes(opt);
              return <label key={opt} className="flex items-center gap-2 text-sm dark:text-white"><input type="checkbox" checked={checked} onChange={e=>{
                const next = e.target.checked ? [...arr, opt] : arr.filter(x=>x!==opt);
                setAns(q.id, next);
              }} />{opt}</label>;
            })}</div>}
          </div>
        ))}
        <button type="submit" className="w-full rounded-full bg-black dark:bg-white dark:text-black text-white dark:text-black py-3 text-sm font-medium">제출하기</button>
        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 text-center">제출 시 Supabase 기간/중복 검증 → 분류 검증 → GAS write(분류 포함) → Resend 확인 메일 즉시 발송</p>
      </form>
    </div>
  );
}
