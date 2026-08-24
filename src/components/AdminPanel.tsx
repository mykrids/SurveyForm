"use client";
import { useEffect, useState } from "react";
import { DUPLICATE_CHECK_TYPES, END_MESSAGE_PRESETS } from "@/lib/constants";
import { getDuplicateWarning } from "@/lib/duplicate";

type Survey = {
  id: string;
  title: string;
  start_at: string | null;
  end_at: string | null;
  report_delay_hours: number;
  duplicate_check_type: string;
  end_message_preset: string;
  gas_webapp_url: string | null;
  admin_email: string | null;
  report_sent: boolean;
  form_id: string | null;
};

export default function AdminPanel() {
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<Partial<Survey>>({
    title: "", form_id: "", start_at: "", end_at: "", report_delay_hours: 1,
    duplicate_check_type: "none", end_message_preset: "1", gas_webapp_url: "", admin_email: ""
  });
  const [msg, setMsg] = useState("");

  async function load() {
    setLoading(true);
    try {
      const r = await fetch("/api/admin/surveys");
      const j = await r.json();
      setSurveys(j.surveys || []);
    } catch { /* ignore */ }
    setLoading(false);
  }
  useEffect(()=>{ load(); },[]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg("저장 중…");
    const r = await fetch("/api/admin/surveys", { method: "POST", headers: { "Content-Type":"application/json" }, body: JSON.stringify(form) });
    const j = await r.json();
    if (!r.ok) setMsg(`오류: ${j.error || r.status}`);
    else { setMsg("저장 완료"); setForm({ title:"", form_id:"", start_at:"", end_at:"", report_delay_hours:1, duplicate_check_type:"none", end_message_preset:"1", gas_webapp_url:"", admin_email:"" }); load(); }
  }

  const warning = getDuplicateWarning(form.duplicate_check_type || "none");

  return (
    <div className="mx-auto max-w-5xl px-6 py-8 bg-white text-zinc-900">
      <h1 className="text-2xl font-bold text-zinc-900">관리자 설정 패널</h1>
      <p className="text-sm text-zinc-700">설문 기간·중복방지·종료메시지·GAS URL을 설정합니다. 저장은 Supabase(surveys) + service_role 경유.</p>

      <form onSubmit={submit} className="mt-6 grid gap-4 border border-zinc-200 rounded-2xl p-6 bg-white">
        <div className="grid md:grid-cols-2 gap-4">
          <label className="text-sm font-medium text-zinc-900">설문 제목<input value={form.title||""} onChange={e=>setForm({...form,title:e.target.value})} required className="mt-1 w-full border border-zinc-300 rounded-lg px-3 py-2 bg-white text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900" placeholder="예: 고객 만족도 조사" /></label>
          <label className="text-sm font-medium text-zinc-900">Google Form ID<input value={form.form_id||""} onChange={e=>setForm({...form,form_id:e.target.value})} className="mt-1 w-full border border-zinc-300 rounded-lg px-3 py-2 bg-white text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900" placeholder="1a2b3c… (URL에서 추출)" /></label>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <label className="text-sm font-medium text-zinc-900">시작 일시<input type="datetime-local" value={form.start_at||""} onChange={e=>setForm({...form,start_at:e.target.value})} className="mt-1 w-full border border-zinc-300 rounded-lg px-3 py-2 bg-white text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900" /></label>
          <label className="text-sm font-medium text-zinc-900">종료 일시<input type="datetime-local" value={form.end_at||""} onChange={e=>setForm({...form,end_at:e.target.value})} className="mt-1 w-full border border-zinc-300 rounded-lg px-3 py-2 bg-white text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900" /></label>
        </div>
        <div className="grid md:grid-cols-3 gap-4">
          <label className="text-sm font-medium text-zinc-900">지연 리포트 시간 (시간)
            <input type="number" min={1} max={24} value={form.report_delay_hours||1} onChange={e=>setForm({...form,report_delay_hours: Number(e.target.value)})} className="mt-1 w-full border border-zinc-300 rounded-lg px-3 py-2 bg-white text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900" />
          </label>
          <label className="text-sm font-medium text-zinc-900">중복 방지
            <select value={form.duplicate_check_type} onChange={e=>setForm({...form,duplicate_check_type:e.target.value})} className="mt-1 w-full border border-zinc-300 rounded-lg px-3 py-2 bg-white text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900">
              {Object.entries(DUPLICATE_CHECK_TYPES).map(([k,v])=><option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          <label className="text-sm font-medium text-zinc-900">종료 메시지 프리셋 (10종)
            <select value={form.end_message_preset} onChange={e=>setForm({...form,end_message_preset:e.target.value})} className="mt-1 w-full border border-zinc-300 rounded-lg px-3 py-2 bg-white text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900">
              {Object.entries(END_MESSAGE_PRESETS).map(([k,v])=><option key={k} value={k}>{k}. {v.label}</option>)}
            </select>
          </label>
        </div>
        {warning && <p className="text-xs bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-amber-800">⚠️ {warning}</p>}
        <label className="text-sm font-medium text-zinc-900">GAS Web App URL<input value={form.gas_webapp_url||""} onChange={e=>setForm({...form,gas_webapp_url:e.target.value})} className="mt-1 w-full border border-zinc-300 rounded-lg px-3 py-2 bg-white text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900" placeholder="https://script.google.com/macros/s/…/exec" /></label>
        <label className="text-sm font-medium text-zinc-900">관리자 이메일 (PDF 수신)<input type="email" value={form.admin_email||""} onChange={e=>setForm({...form,admin_email:e.target.value})} className="mt-1 w-full border border-zinc-300 rounded-lg px-3 py-2 bg-white text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900" placeholder="admin@example.com" /></label>
        <button type="submit" className="rounded-full bg-black text-white px-6 py-2 text-sm font-medium self-start hover:bg-zinc-800 transition">설문 저장</button>
        {msg && <p className="text-sm text-zinc-700 font-medium">{msg}</p>}
      </form>

      <div className="mt-8">
        <h2 className="font-semibold text-zinc-900">등록된 설문 {loading ? "(로딩…)" : `(${surveys.length}개)`}</h2>
        <div className="mt-3 grid gap-3">
          {surveys.map(s=>(
            <div key={s.id} className="border border-zinc-200 rounded-xl p-4 flex flex-wrap justify-between gap-3 bg-white">
              <div>
                <p className="font-medium text-zinc-900">{s.title} <span className="text-xs text-zinc-500">/{s.id.slice(0,8)}</span></p>
                <p className="text-xs text-zinc-700">기간: {s.start_at||"—"} ~ {s.end_at||"—"} · 중복:{s.duplicate_check_type} · 지연:{s.report_delay_hours}h · 리포트:{s.report_sent?"발송됨":"대기"} · preset:{s.end_message_preset}</p>
                <p className="text-xs text-zinc-600">Form: {s.form_id||"—"} · GAS: {s.gas_webapp_url ? s.gas_webapp_url.slice(0,40)+"…" : "—"}</p>
              </div>
              <div className="flex gap-2 self-start">
                <a href={`/s/${s.id}`} className="text-xs border border-zinc-300 rounded-full px-3 py-1 text-zinc-800 hover:bg-zinc-50">응답 페이지</a>
                <a href={`/api/forms/${s.form_id || s.id}`} target="_blank" className="text-xs border border-zinc-300 rounded-full px-3 py-1 text-zinc-800 hover:bg-zinc-50">Form JSON</a>
              </div>
            </div>
          ))}
          {!loading && surveys.length===0 && <p className="text-sm text-zinc-600">아직 설문이 없습니다. 위 폼에서 생성하거나 Supabase에 직접 insert 하세요. (env 미설정 시 목업으로 빈 목록 표시)</p>}
        </div>
      </div>
    </div>
  );
}
