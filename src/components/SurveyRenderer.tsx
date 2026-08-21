"use client";
import { useEffect, useState } from "react";
import type { ParsedForm } from "@/lib/forms";

export default function SurveyRenderer({ surveyId }: { surveyId: string }) {
  const [form, setForm] = useState<ParsedForm | null>(null);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<string>("");
  const [done, setDone] = useState<{ presetLabel: string; presetBody: string } | null>(null);

  useEffect(()=>{
    fetch(`/api/forms/${surveyId}`).then(r=>r.json()).then(j=>{
      if (j.form) setForm(j.form);
      if (j.warning) setStatus(j.warning);
    }).catch(()=>setStatus("폼 로드 실패"));
  },[surveyId]);

  function setAns(id: string, v: string | string[]) { setAnswers(a=>({ ...a, [id]: v })); }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("제출 중…");
    // cookie duplicate check (client side helper)
    const dupKey = `survey_${surveyId}_submitted`;
    if (localStorage.getItem(dupKey)) {
      setStatus("이미 제출한 것으로 기록되어 있습니다. (쿠키 기반 — 우회 가능)");
    }
    const payload = { surveyId, email, answers };
    const r = await fetch("/api/submit", { method:"POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify(payload) });
    const j = await r.json();
    if (!r.ok) { setStatus(`오류: ${j.error}`); return; }
    localStorage.setItem(dupKey, "1");
    // set cookie too for server check
    document.cookie = `${dupKey}=1; path=/; max-age=31536000`;
    setDone({ presetLabel: j.presetLabel, presetBody: j.presetBody });
    setStatus("");
  }

  if (done) {
    return (
      <div className="mx-auto max-w-xl px-6 py-16 text-center">
        <div className="border rounded-2xl p-8 bg-white">
          <h2 className="text-xl font-bold">{done.presetLabel}</h2>
          <p className="mt-2 text-zinc-600">{done.presetBody}</p>
          <p className="mt-4 text-xs text-zinc-500">확인 메일이 발송되었습니다. (Resend 키 없을 시 스킵)</p>
          <a href="/" className="inline-block mt-6 text-sm border rounded-full px-5 py-2">홈으로</a>{/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        </div>
      </div>
    );
  }

  if (!form) return <div className="mx-auto max-w-xl px-6 py-16 text-center text-zinc-500">설문 로딩 중…</div>;

  return (
    <div className="mx-auto max-w-xl px-6 py-8">
      <h1 className="text-2xl font-bold">{form.title}</h1>
      {form.description && <p className="text-sm text-zinc-600 mt-1">{form.description}</p>}
      {form.unsupported.length>0 && (
        <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-800">
          ⚠️ 이 설문에는 지원되지 않는 문항 유형이 포함되어 있습니다: {form.unsupported.map(u=>`${u.title}(${u.rawType})`).join(", ")}
        </div>
      )}
      {status && <p className="mt-3 text-sm text-amber-700">{status}</p>}
      <form onSubmit={submit} className="mt-6 space-y-5 border rounded-2xl p-6 bg-white">
        <label className="block text-sm">이메일 (중복 체크·확인 메일용)
          <input type="email" value={email} onChange={e=>setEmail(e.target.value)} className="mt-1 w-full border rounded-lg px-3 py-2" placeholder="you@example.com" />
        </label>
        {form.questions.map(q=>(
          <div key={q.id} className="border-t pt-4 first:border-0 first:pt-0">
            <label className="text-sm font-medium">{q.title} {q.required && <span className="text-red-500">*</span>}</label>
            {q.description && <p className="text-xs text-zinc-500">{q.description}</p>}
            {q.type==="TEXT" && <input value={(answers[q.id] as string)||""} onChange={e=>setAns(q.id, e.target.value)} required={q.required} className="mt-2 w-full border rounded-lg px-3 py-2 text-sm" placeholder="단답형" />}
            {q.type==="PARAGRAPH_TEXT" && <textarea value={(answers[q.id] as string)||""} onChange={e=>setAns(q.id, e.target.value)} required={q.required} className="mt-2 w-full border rounded-lg px-3 py-2 text-sm" rows={4} placeholder="장문형" />}
            {q.type==="RADIO" && <div className="mt-2 space-y-2">{q.options?.map(opt=>(
              <label key={opt} className="flex items-center gap-2 text-sm"><input type="radio" name={q.id} checked={answers[q.id]===opt} onChange={()=>setAns(q.id,opt)} required={q.required} />{opt}</label>
            ))}</div>}
            {q.type==="CHECKBOX" && <div className="mt-2 space-y-2">{q.options?.map(opt=>{
              const arr = (answers[q.id] as string[])||[];
              const checked = arr.includes(opt);
              return <label key={opt} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={checked} onChange={e=>{
                const next = e.target.checked ? [...arr, opt] : arr.filter(x=>x!==opt);
                setAns(q.id, next);
              }} />{opt}</label>;
            })}</div>}
          </div>
        ))}
        <button type="submit" className="w-full rounded-full bg-black text-white py-3 text-sm font-medium">제출하기</button>
        <p className="text-[11px] text-zinc-500 text-center">제출 시 Supabase 기간/중복 검증 → GAS write → Resend 확인 메일 즉시 발송</p>
      </form>
    </div>
  );
}
