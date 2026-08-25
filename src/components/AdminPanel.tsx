"use client";
import { useEffect, useState } from "react";
import { DUPLICATE_CHECK_TYPES, END_MESSAGE_PRESETS } from "@/lib/constants";
import { getDuplicateWarning } from "@/lib/duplicate";
import { checkEmailTypo } from "@/lib/emailTypo";
import { slugify, validateTaxonomyFields, type TaxonomyField } from "@/lib/taxonomy";

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
  taxonomy_fields?: TaxonomyField[];
};

// 현재 시스템에 설정된 실제 값 ( .env 기준 ) — 테스트용 자동 입력 (비밀값은 마스킹)
const CURRENT_VALUES = {
  github: "mykrids / SurveyForm (krids.org@gmail.com)",
  supabaseUrl: "https://bpvvxsrtfigphxzoztjm.supabase.co",
  supabaseAnon: "sb_publishable_*** (대시보드 > API에서 확인)",
  serviceAccount: "survey-form@velvety-maker-506214-u5.iam.gserviceaccount.com",
  serviceProject: "velvety-maker-506214-u5",
  gasUrl: "https://script.google.com/macros/s/AKfycbyrsz02kQ6IHcBs1IhgTkUr_7d6C3f-8v0SLqW_QIgSAL6qxPkzaXHkImjMeDOXeEzC/exec",
  gasSecret: "2afea94d4edad55049255d7a746004f8 (그대로 사용)",
  resendFrom: "noreply@krids.org",
  resendKey: "re_*** (Resend 대시보드 > API Keys)",
  vercelCron: "344b6d… (env CRON_SECRET)",
  adminEmail: "krids.org@gmail.com",
};

export default function AdminPanel({ role }: { role?: "administrator" | "supervisor" }) {
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<Partial<Survey> & { taxonomy_fields?: TaxonomyField[] }>({
    title: "",
    form_id: "",
    start_at: "",
    end_at: "",
    report_delay_hours: 1,
    duplicate_check_type: "none",
    end_message_preset: "1",
    gas_webapp_url: CURRENT_VALUES.gasUrl,
    admin_email: CURRENT_VALUES.adminEmail,
    taxonomy_fields: [],
  });
  const [msg, setMsg] = useState("");
  const [newTaxLabel, setNewTaxLabel] = useState("");
  const [newTaxType, setNewTaxType] = useState<"text"|"select">("text");
  const [newTaxHidden, setNewTaxHidden] = useState(false);
  const [newTaxOptions, setNewTaxOptions] = useState("");

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

  function addTaxonomy() {
    const label = newTaxLabel.trim();
    if (!label) { setMsg("오류: 분류 라벨(예: 교수명, 학과명)을 입력하세요"); return; }
    const key = slugify(label);
    const fields = form.taxonomy_fields || [];
    if (fields.some(f=>f.key===key)) { setMsg(`오류: 이미 존재하는 분류 키: ${key} (${label})`); return; }
    const opts = newTaxType==="select" ? newTaxOptions.split(",").map(s=>s.trim()).filter(Boolean) : undefined;
    if (newTaxType==="select" && (!opts || opts.length===0)) { setMsg("오류: 선택형은 옵션을 콤마로 구분해 입력하세요 (예: 국문과,컴퓨터공학,경영학과)"); return; }
    const field: TaxonomyField = { key, label, type: newTaxType, required: true, hidden: newTaxHidden, ...(opts ? { options: opts } : {}) };
    const next = [...fields, field];
    const err = validateTaxonomyFields(next);
    if (err) { setMsg(`오류: ${err}`); return; }
    setForm({ ...form, taxonomy_fields: next });
    setNewTaxLabel(""); setNewTaxOptions(""); setMsg(`분류 추가됨: ${label} → ${key}`);
  }
  function removeTaxonomy(key: string) {
    setForm({ ...form, taxonomy_fields: (form.taxonomy_fields||[]).filter(f=>f.key!==key) });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (form.admin_email) {
      const typo = checkEmailTypo(form.admin_email);
      if (!typo.ok) {
        setMsg(`오류: 관리자 이메일 오타 — ${typo.reason}`);
        return;
      }
    }
    if (form.taxonomy_fields) {
      const err = validateTaxonomyFields(form.taxonomy_fields);
      if (err) { setMsg(`오류: 분류 필드 검증 실패 — ${err}`); return; }
    }
    setMsg("저장 중…");
    const r = await fetch("/api/admin/surveys", { method: "POST", headers: { "Content-Type":"application/json" }, body: JSON.stringify(form) });
    const j = await r.json();
    if (!r.ok) setMsg(`오류: ${j.error || r.status}`);
    else {
      setMsg("저장 완료 — 응답 페이지 링크가 아래 목록에 생성되었습니다.");
      setForm({ title:"", form_id:"", start_at:"", end_at:"", report_delay_hours:1, duplicate_check_type:"none", end_message_preset:"1", gas_webapp_url: CURRENT_VALUES.gasUrl, admin_email: CURRENT_VALUES.adminEmail, taxonomy_fields: [] });
      load();
    }
  }

  const warning = getDuplicateWarning(form.duplicate_check_type || "none");
  const selectedPreset = END_MESSAGE_PRESETS[form.end_message_preset as keyof typeof END_MESSAGE_PRESETS] || END_MESSAGE_PRESETS["1"];
  const adminEmailTypo = form.admin_email ? checkEmailTypo(form.admin_email) : null;

  return (
    <div className="mx-auto max-w-5xl px-6 py-8 bg-background text-foreground">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">관리자 설정 패널</h1>
        {role && <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${role === "administrator" ? "bg-zinc-900 dark:bg-white dark:text-black text-white" : "bg-blue-600 text-white"}`}>{role === "administrator" ? "Administrator" : "Supervisor"} 모드</span>}
      </div>
      <p className="text-sm text-zinc-700 dark:text-zinc-300 mt-1">설문 기간·중복방지·종료메시지·GAS URL을 설정합니다. 저장은 Supabase(surveys) + service_role 경유.</p>
      <div className="mt-3 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950 px-3 py-2 text-xs leading-relaxed">
        <span className="font-semibold text-blue-900 dark:text-blue-200">분리 운영:</span> <span className="text-blue-800 dark:text-blue-300">구글 설문지 폼의 문항 편집/공유는 관리자 기능과 분리되어 있습니다 — 폼 수정은 drive.google.com에서 직접 하고, 관리자 대시보드에서는 <b>Form ID 연결만</b> 하면 됩니다. (네, 그렇게 운영하면 됩니다)</span>
      </div>

      {/* 현재 시스템 설정 - 자동 입력됨 */}
      <div className="mt-6 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 bg-zinc-50 dark:bg-zinc-900">
        <h2 className="font-semibold text-zinc-900 dark:text-white flex items-center gap-2">⚙️ 현재 시스템 설정 <span className="text-xs font-normal bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 px-2 py-0.5 rounded-full">자동 입력됨 · 테스트 가능</span></h2>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">아래 값들은 현재 서버(.env)가 실제로 사용 중인 값입니다. 응답 수가 늘어나면 각 사이트에서 요금제를 신청하면 되고, 코드는 변경 없이 env만 교체하면 됩니다.</p>
        <div className="mt-4 grid md:grid-cols-2 gap-3 text-xs leading-relaxed">
          <div className="border dark:border-zinc-800 rounded-xl p-3 bg-white dark:bg-zinc-950">
            <p className="font-semibold text-zinc-900 dark:text-white">Supabase <span className="text-zinc-500 font-normal">(항상 동일)</span></p>
            <p className="text-zinc-600 dark:text-zinc-400 break-all">URL: {CURRENT_VALUES.supabaseUrl}</p>
            <p className="text-zinc-600 dark:text-zinc-400">Anon: {CURRENT_VALUES.supabaseAnon}</p>
            <p className="text-zinc-500 dark:text-zinc-500 mt-1">→ 응답 5만건 이상 시 Supabase Pro 요금제 신청 (대시보드 &gt; Billing)</p>
          </div>
          <div className="border dark:border-zinc-800 rounded-xl p-3 bg-white dark:bg-zinc-950">
            <p className="font-semibold text-zinc-900 dark:text-white">krids 서비스 계정 <span className="text-zinc-500 font-normal">(항상 동일)</span></p>
            <p className="text-zinc-600 dark:text-zinc-400 break-all">{CURRENT_VALUES.serviceAccount}</p>
            <p className="text-zinc-600 dark:text-zinc-400">프로젝트: {CURRENT_VALUES.serviceProject}</p>
            <p className="text-zinc-500 dark:text-zinc-500 mt-1">→ 모든 구글폼에 이 krids 서비스 계정을 ‘뷰어’로 공유해야 함</p>
          </div>
          <div className="border dark:border-zinc-800 rounded-xl p-3 bg-white dark:bg-zinc-950">
            <p className="font-semibold text-zinc-900 dark:text-white">GAS Web App <span className="text-amber-600 dark:text-amber-400 font-normal">(시트 생성 시 갱신)</span></p>
            <p className="text-zinc-600 dark:text-zinc-400 break-all">{CURRENT_VALUES.gasUrl.slice(0, 55)}…</p>
            <p className="text-zinc-600 dark:text-zinc-400">Secret: {CURRENT_VALUES.gasSecret.slice(0, 8)}…</p>
            <p className="text-zinc-500 dark:text-zinc-500 mt-1">→ 시트마다 Apps Script를 새로 배포하면 URL이 바뀜 — 갱신 필요</p>
          </div>
          <div className="border dark:border-zinc-800 rounded-xl p-3 bg-white dark:bg-zinc-950">
            <p className="font-semibold text-zinc-900 dark:text-white">Resend / Vercel / GitHub <span className="text-zinc-500 font-normal">(항상 동일)</span></p>
            <p className="text-zinc-600 dark:text-zinc-400">From: {CURRENT_VALUES.resendFrom} / Key: {CURRENT_VALUES.resendKey.slice(0,12)}…</p>
            <p className="text-zinc-600 dark:text-zinc-400">Cron: {CURRENT_VALUES.vercelCron} / GitHub: {CURRENT_VALUES.github}</p>
            <p className="text-zinc-500 dark:text-zinc-500 mt-1">→ 월 메일 3천통 초과 시 Resend Pro, Vercel은 사용량 기반</p>
          </div>
        </div>
      </div>

      <form onSubmit={submit} className="mt-6 grid gap-5 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 bg-white dark:bg-zinc-900">
        <div className="grid md:grid-cols-2 gap-4">
          <label className="text-sm font-medium text-zinc-900 dark:text-white">
            설문 제목
            <input value={form.title||""} onChange={e=>setForm({...form,title:e.target.value})} required className="mt-1 w-full border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-2 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:focus:ring-white/10 focus:border-zinc-900" placeholder="예: 2026 강의 평가 (시트 생성 시 갱신)" />
            <span className="text-xs text-zinc-500 dark:text-zinc-400">시트 생성 시 갱신 — 매번 새 설문 제목으로 교체</span>
          </label>
          <label className="text-sm font-medium text-zinc-900 dark:text-white">
            Google Form ID <span className="ml-1 text-xs bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-full">시트 생성 시 갱신</span>
            <input value={form.form_id||""} onChange={e=>setForm({...form,form_id:e.target.value})} className="mt-1 w-full border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-2 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900" placeholder="예: 1FAIpQLSdXx… (URL에서 복사, 시트마다 다름)" />
            <span className="text-xs text-zinc-500 dark:text-zinc-400">예시: https://docs.google.com/forms/d/<b>1FAIpQLSd…</b>/edit → 굵은 부분이 ID</span>
          </label>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <label className="text-sm font-medium text-zinc-900 dark:text-white">
            시작 일시 <span className="text-xs text-zinc-500 font-normal">시트 생성 시 갱신</span>
            <input type="datetime-local" value={form.start_at||""} onChange={e=>setForm({...form,start_at:e.target.value})} className="mt-1 w-full border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-2 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900" />
            <span className="text-xs text-zinc-500 dark:text-zinc-400">비우면 즉시 시작</span>
          </label>
          <label className="text-sm font-medium text-zinc-900 dark:text-white">
            종료 일시 <span className="text-xs text-zinc-500 font-normal">시트 생성 시 갱신</span>
            <input type="datetime-local" value={form.end_at||""} onChange={e=>setForm({...form,end_at:e.target.value})} className="mt-1 w-full border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-2 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900" />
            <span className="text-xs text-zinc-500 dark:text-zinc-400">예시: 2026-08-31 23:59 — 종료 후 1시간 뒤 PDF 자동 발송</span>
          </label>
        </div>
        <div className="grid md:grid-cols-3 gap-4">
          <label className="text-sm font-medium text-zinc-900 dark:text-white">
            지연 리포트 시간 (시간)
            <input type="number" min={1} max={24} value={form.report_delay_hours||1} onChange={e=>setForm({...form,report_delay_hours: Number(e.target.value)})} className="mt-1 w-full border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-2 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900" />
            <span className="text-xs text-zinc-500 dark:text-zinc-400">기본 1시간 — 종료 후 그래프/PDF 발송 지연</span>
          </label>
          <label className="text-sm font-medium text-zinc-900 dark:text-white">
            중복 방지
            <select value={form.duplicate_check_type} onChange={e=>setForm({...form,duplicate_check_type:e.target.value})} className="mt-1 w-full border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-2 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900">
              {Object.entries(DUPLICATE_CHECK_TYPES).map(([k,v])=><option key={k} value={k}>{v}</option>)}
            </select>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">아래 ‘중복 방지 상세’ 참고 — 응답자는 별도 조치 없음</span>
          </label>
          <label className="text-sm font-medium text-zinc-900 dark:text-white">
            종료 메시지 프리셋 (10종) <span className="text-xs text-zinc-500 font-normal">1~10번</span>
            <select value={form.end_message_preset} onChange={e=>setForm({...form,end_message_preset:e.target.value})} className="mt-1 w-full border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-2 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900">
              {Object.entries(END_MESSAGE_PRESETS).map(([k,v])=><option key={k} value={k}>{k}. {v.label}</option>)}
            </select>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">선택한 번호의 문구가 응답 완료 화면에 표시</span>
          </label>
        </div>
        {/* 프리셋 미리보기 */}
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800 p-3">
          <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">선택된 종료 메시지 미리보기 — {form.end_message_preset}번</p>
          <p className="text-sm font-medium text-zinc-900 dark:text-white mt-1">{selectedPreset.label}</p>
          <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">{selectedPreset.body}</p>
        </div>
        {warning && <p className="text-xs bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2 text-amber-800 dark:text-amber-200">⚠️ {warning}</p>}
        {/* 분류 필드 (유연) */}
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800 p-4">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">🏷️ 분류 필드 (선택) <span className="text-xs font-normal text-zinc-500 dark:text-zinc-400">예: 교수명, 학과명, 과목명 등 — 설문별 유연 지정</span></h3>
          <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">설문 응답을 교수/학과/과목 등으로 나누어 집계해야 할 때, 관리자 사이트에서 분류 단어를 직접 지정하세요. 예) 강의평가: <code className="bg-zinc-100 dark:bg-zinc-700 px-1 rounded">교수명</code> + <code className="bg-zinc-100 dark:bg-zinc-700 px-1 rounded">과목명</code>, 교육과정 평가: <code className="bg-zinc-100 dark:bg-zinc-700 px-1 rounded">학과명</code>. 남기면 분류 없이 저장됩니다.</p>
          {(form.taxonomy_fields||[]).length>0 && (
            <div className="mt-3 space-y-2">
              {(form.taxonomy_fields||[]).map(f=>(
                <div key={f.key} className="flex flex-wrap items-center gap-2 border dark:border-zinc-700 rounded-xl px-3 py-2 bg-white dark:bg-zinc-900 text-xs">
                  <span className="font-medium text-zinc-900 dark:text-white">{f.label}</span>
                  <span className="text-zinc-500 dark:text-zinc-400">→ key: {f.key}</span>
                  <span className={`px-2 py-0.5 rounded-full ${f.type==="select" ? "bg-violet-100 dark:bg-violet-900 text-violet-700 dark:text-violet-300" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300"}`}>{f.type==="select" ? "선택형" : "단답형"}</span>
                  {f.hidden && <span className="px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300">숨김(URL 주입)</span>}
                  {!f.hidden && <span className="px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300">노출(직접 입력)</span>}
                  {f.options && <span className="text-zinc-500 dark:text-zinc-400">옵션: {f.options.join(", ")}</span>}
                  <button type="button" onClick={()=>removeTaxonomy(f.key)} className="ml-auto text-red-600 dark:text-red-400 hover:underline">삭제</button>
                </div>
              ))}
            </div>
          )}
          <div className="mt-3 grid md:grid-cols-12 gap-2 items-end">
            <label className="md:col-span-3 text-xs font-medium text-zinc-900 dark:text-white">
              라벨 (예: 교수명)
              <input value={newTaxLabel} onChange={e=>setNewTaxLabel(e.target.value)} placeholder="교수명 / 학과명 / 과목명" className="mt-1 w-full border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-2 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder:text-zinc-400" />
              <span className="text-[11px] text-zinc-500 dark:text-zinc-400">입력 시 key는 자동 생성({newTaxLabel ? slugify(newTaxLabel) : "—"})</span>
            </label>
            <label className="md:col-span-2 text-xs font-medium text-zinc-900 dark:text-white">
              타입
              <select value={newTaxType} onChange={e=>setNewTaxType(e.target.value as "text"|"select")} className="mt-1 w-full border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-2 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white">
                <option value="text">단답형</option>
                <option value="select">선택형</option>
              </select>
            </label>
            <label className="md:col-span-4 text-xs font-medium text-zinc-900 dark:text-white">
              옵션 (선택형만, 콤마 구분)
              <input value={newTaxOptions} onChange={e=>setNewTaxOptions(e.target.value)} placeholder="예: 국문과,컴퓨터공학,경영학과" disabled={newTaxType!=="select"} className="mt-1 w-full border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-2 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder:text-zinc-400 disabled:opacity-50" />
            </label>
            <label className="md:col-span-2 text-xs font-medium text-zinc-900 dark:text-white flex items-center gap-2">
              <input type="checkbox" checked={newTaxHidden} onChange={e=>setNewTaxHidden(e.target.checked)} /> 숨김
              <span className="text-[11px] text-zinc-500 dark:text-zinc-400">URL 주입</span>
            </label>
            <button type="button" onClick={addTaxonomy} className="md:col-span-1 rounded-full bg-zinc-900 dark:bg-white dark:text-black text-white px-4 py-2 text-xs font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200">추가</button>
          </div>
          <p className="mt-2 text-[11px] text-zinc-500 dark:text-zinc-400">숨김=체크 시 <code className="bg-zinc-100 dark:bg-zinc-700 px-1 rounded">/s/{"{id}"}?{newTaxLabel?slugify(newTaxLabel):"key"}=값</code> 형태로 링크를 배포하면 응답자에게 보이지 않게 자동 기록. 노출=미체크 시 응답자가 직접 선택/입력.</p>
        </div>
        {/* 중복 방지 응답자 안내 */}
        <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950 p-3 text-xs leading-relaxed">
          <p className="font-semibold text-blue-900 dark:text-blue-200">응답자 안내 — 중복 방지별 “해야 할 일”</p>
          <ul className="mt-1 list-disc list-inside text-blue-800 dark:text-blue-300 space-y-1">
            <li><b>제한 없음:</b> 응답자는 그냥 설문 응답하면 됩니다. 여러 번 제출 가능.</li>
            <li><b>쿠키/LocalStorage:</b> 응답자는 그냥 응답하면 됩니다. 같은 브라우저에서 재응답 시 “이미 제출됨”으로 차단 — 브라우저 변경/쿠키 삭제 시 우회 가능.</li>
            <li><b>이메일 기반:</b> 응답자는 이메일 칸에 본인 메일을 입력하고 응답하면 됩니다. 같은 이메일로 재제출 시 차단 (대소문자·공백·+태그 정규화).</li>
          </ul>
        </div>
        <label className="text-sm font-medium text-zinc-900 dark:text-white">
          GAS Web App URL
          <input value={form.gas_webapp_url||""} onChange={e=>setForm({...form,gas_webapp_url:e.target.value})} className="mt-1 w-full border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-2 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900" placeholder="https://script.google.com/macros/s/…/exec (시트마다 새로 배포 시 URL 변경)" />
          <span className="text-xs text-zinc-500 dark:text-zinc-400">배포 후 받은 전체 URL을 그대로 붙여넣으면 됩니다 — 자동으로 저장됨</span>
        </label>
        <label className="text-sm font-medium text-zinc-900 dark:text-white">
          관리자 이메일 (PDF 수신) <span className="text-xs text-zinc-500 font-normal">항상 동일: krids.org@gmail.com</span>
          <input type="email" value={form.admin_email||""} onChange={e=>setForm({...form,admin_email:e.target.value})} className={`mt-1 w-full border rounded-lg px-3 py-2 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 ${adminEmailTypo && !adminEmailTypo.ok ? "border-red-300 dark:border-red-700" : "border-zinc-300 dark:border-zinc-700"}`} placeholder="krids.org@gmail.com (자동 입력됨)" />
          {adminEmailTypo && !adminEmailTypo.ok ? (
            <div className="mt-1 flex items-center gap-2 text-xs">
              <span className="text-red-600 dark:text-red-400">⚠️ {adminEmailTypo.reason} — 오타 차단됨</span>
              {adminEmailTypo.suggestion && <button type="button" onClick={()=>setForm({...form, admin_email: adminEmailTypo.suggestion})} className="underline text-blue-600 dark:text-blue-400">‘{adminEmailTypo.suggestion}’로 교정</button>}
            </div>
          ) : (
            <span className="text-xs text-zinc-500 dark:text-zinc-400">보고서 PDF가 이 메일로 자동 발송됩니다 — 오타(never.com 등) 자동 차단됨</span>
          )}
        </label>
        <button type="submit" className="rounded-full bg-black dark:bg-white dark:text-black text-white px-6 py-2 text-sm font-medium self-start hover:bg-zinc-800 dark:hover:bg-zinc-200 transition">설문 저장</button>
        {msg && <p className="text-sm text-zinc-700 dark:text-zinc-300 font-medium">{msg}</p>}
      </form>

      <div className="mt-8">
        <h2 className="font-semibold text-zinc-900 dark:text-white">등록된 설문 {loading ? "(로딩…)" : `(${surveys.length}개)`}</h2>
        <div className="mt-3 grid gap-3">
          {surveys.map(s=>(
            <div key={s.id} className="border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 flex flex-wrap justify-between gap-3 bg-white dark:bg-zinc-900">
              <div>
                <p className="font-medium text-zinc-900 dark:text-white">{s.title} <span className="text-xs text-zinc-500 dark:text-zinc-400">/{s.id.slice(0,8)}</span></p>
                <p className="text-xs text-zinc-700 dark:text-zinc-300">기간: {s.start_at||"—"} ~ {s.end_at||"—"} · 중복:{s.duplicate_check_type} · 지연:{s.report_delay_hours}h · 리포트:{s.report_sent?"발송됨":"대기"} · preset:{s.end_message_preset}</p>
                <p className="text-xs text-zinc-600 dark:text-zinc-400">Form: {s.form_id||"—"} · GAS: {s.gas_webapp_url ? s.gas_webapp_url.slice(0,40)+"…" : "—"}</p>
                {s.taxonomy_fields && s.taxonomy_fields.length>0 && <p className="text-xs text-violet-600 dark:text-violet-300 mt-1">분류: {s.taxonomy_fields.map((f: TaxonomyField)=>`${f.label}(${f.key})${f.hidden?"·숨김":""}`).join(", ")}</p>}
                {s.taxonomy_fields && s.taxonomy_fields.length>0 && <p className="text-[11px] text-zinc-500 dark:text-zinc-400">링크 예: /s/{s.id}?{s.taxonomy_fields.map((f: TaxonomyField)=>`${f.key}=값`).join("&")}</p>}
              </div>
              <div className="flex gap-2 self-start">
                <a href={`/s/${s.id}`} className="text-xs border border-zinc-300 dark:border-zinc-700 rounded-full px-3 py-1 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800">응답 페이지</a>
                <a href={`/api/forms/${s.form_id || s.id}`} target="_blank" className="text-xs border border-zinc-300 dark:border-zinc-700 rounded-full px-3 py-1 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800">폼 JSON</a>
              </div>
            </div>
          ))}
          {!loading && surveys.length===0 && <p className="text-sm text-zinc-600 dark:text-zinc-400">아직 설문이 없습니다. 위 폼에서 생성하거나 Supabase에 직접 insert 하세요. (env 미설정 시 목업으로 빈 목록 표시)</p>}
        </div>
      </div>

      {/* 도움말 섹션 */}
      <div className="mt-10 space-y-4">
        <details className="border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 bg-white dark:bg-zinc-900 open:bg-zinc-50 dark:open:bg-zinc-800" open>
          <summary className="font-semibold text-zinc-900 dark:text-white cursor-pointer">1️⃣ 설문 생성 — 구글폼을 먼저 만들어야 하나요? (네, 그렇습니다)</summary>
          <ol className="mt-4 list-decimal list-inside space-y-2 text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">
            <li><b>구글폼에서 설문지 먼저 생성:</b> drive.google.com → 새로 만들기 → Google Forms → 제목/문항 작성 (단답형·장문형·객관식·체크박스 모두 지원).</li>
            <li><b>krids 서비스 계정에 뷰어 공유:</b> 폼 편집 화면 우측 상단 ‘공유’ → <code className="bg-zinc-100 dark:bg-zinc-800 px-1 rounded">survey-form@velvety-maker-506214-u5.iam.gserviceaccount.com</code> 에 뷰어 권한 추가 (안 하면 API가 폼을 읽지 못함).</li>
            <li><b>Form ID 복사:</b> 폼 URL이 <code className="bg-zinc-100 dark:bg-zinc-800 px-1 rounded">https://docs.google.com/forms/d/1FAIpQLSd…/edit</code> 일 때 <b>1FAIpQLSd…</b> 부분이 ID — 관리자 패널의 ‘Google Form ID’ 칸에 붙여넣기 (시트 생성 시 갱신).</li>
            <li><b>시트 연결:</b> 폼 → 응답 탭 → 스프레드시트 연결(새 시트 생성) → 해당 시트에서 확장 프로그램 → Apps Script → <code className="bg-zinc-100 dark:bg-zinc-800 px-1 rounded">gas/Code.gs</code> 붙여넣기 → Script Properties에 <code className="bg-zinc-100 dark:bg-zinc-800 px-1 rounded">SHARED_SECRET=2afea94…</code> 등록 → 웹앱으로 배포(액세스: Anyone) → URL을 ‘GAS Web App URL’ 칸에 붙여넣기 (시트 생성 시 갱신).</li>
            <li><b>관리자 패널에서 저장:</b> 설문 제목·기간·GAS URL·관리자 이메일 입력 후 ‘설문 저장’ — 아래 목록에 링크가 생기면 완료.</li>
          </ol>
        </details>

        <details className="border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 bg-white dark:bg-zinc-900">
          <summary className="font-semibold text-zinc-900 dark:text-white cursor-pointer">2️⃣ 설문 템플릿 만드는 방법</summary>
          <div className="mt-4 space-y-2 text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">
            <p>랜딩 페이지의 6개 카드(고객 만족도 조사, 강의 평가 등)는 <b>예시</b>입니다. 실제 템플릿은 코드가 아니라 <b>구글폼을 복제</b>해서 만듭니다.</p>
            <ul className="list-disc list-inside space-y-1">
              <li>구글폼에서 기존 폼을 ‘사본 만들기’로 복제 → 문항만 수정 (예: ‘강의 평가’용 질문으로 교체) → 새 Form ID로 관리자 패널에 등록.</li>
              <li>자주 쓰는 폼은 구글 드라이브에서 ‘템플릿 갤러리’에 보관하거나, 폼 URL을 북마크해 복제용 원본으로 유지.</li>
              <li>랜딩의 템플릿 카드가 실제 폼과 연결되게 하려면: 카드 링크를 <code className="bg-zinc-100 dark:bg-zinc-800 px-1 rounded">/s/저장된설문ID</code> 로 연결 (현재는 데모 <code className="bg-zinc-100 dark:bg-zinc-800 px-1 rounded">/s/demo</code> 로 고정 — 필요 시 개발자에게 카드-설문 매핑 요청).</li>
            </ul>
          </div>
        </details>

        <details className="border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 bg-white dark:bg-zinc-900" open>
          <summary className="font-semibold text-zinc-900 dark:text-white cursor-pointer">3️⃣ 중복 방지 — 쿠키/이메일은 어떻게 방지되고 응답자는 무엇을 해야 하나?</summary>
          <div className="mt-4 space-y-3 text-sm leading-relaxed">
            {[
              { k: "none", title: "제한 없음", how: "검사를 하지 않습니다. 같은 사람이 여러 번 제출해도 모두 저장됩니다.", todo: "응답자는 그냥 설문 응답하면 됩니다. 추가 조치 없음." },
              { k: "cookie", title: "쿠키 / LocalStorage 기반", how: "제출 시 브라우저에 survey_*_submitted 쿠키와 localStorage를 1년 동안 저장합니다. 동일 브라우저에서 재접속 시 서버와 클라이언트 모두에서 차단합니다. 단, 다른 브라우저·시크릿모드·쿠키 삭제로 우회될 수 있습니다.", todo: "응답자는 그냥 설문 응답하면 됩니다. 두 번째 접속 시 ‘이미 제출됨’ 메시지가 뜨면 정상 차단입니다." },
              { k: "email", title: "이메일 기반 (권장)", how: "응답 시 입력한 이메일을 소문자·공백 제거·+태그 제거로 정규화한 뒤, 해당 설문에서 이미 저장된 이메일 목록과 비교합니다. 일치하면 409 오류로 차단합니다.", todo: "응답자는 이메일 칸에 본인 메일을 정확히 입력하고 응답하면 됩니다. 같은 이메일로 재응답 시 ‘이미 응답한 이메일입니다’ 메시지가 뜹니다." },
              { k: "email_verified", title: "이메일 인증 기반 (추후 확장)", how: "현재는 선택만 가능하고 실제 인증 메일 발송은 미구현입니다. 선택 시 일반 이메일 방식과 동일하게 동작합니다.", todo: "추후 인증 링크를 누르는 방식이 추가될 예정 — 현재는 그냥 이메일 입력 후 응답하면 됩니다." },
            ].map(item=>(
              <div key={item.k} className={`border rounded-xl p-3 ${form.duplicate_check_type===item.k ? "border-blue-400 dark:border-blue-600 bg-blue-50 dark:bg-blue-950" : "border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800"}`}>
                <p className="font-semibold text-zinc-900 dark:text-white">{DUPLICATE_CHECK_TYPES[item.k as keyof typeof DUPLICATE_CHECK_TYPES]} {form.duplicate_check_type===item.k && "← 현재 선택"}</p>
                <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">방식: {item.how}</p>
                <p className="text-xs font-medium text-blue-700 dark:text-blue-300 mt-1">응답자 할 일: {item.todo}</p>
              </div>
            ))}
          </div>
        </details>

        <div className="border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 bg-zinc-50 dark:bg-zinc-900">
          <h3 className="font-semibold text-zinc-900 dark:text-white">💡 빠른 체크리스트</h3>
          <ul className="mt-3 space-y-1 text-sm text-zinc-700 dark:text-zinc-300 list-disc list-inside">
            <li>새 시트 만들 때마다 갱신: <b>설문 제목, Google Form ID, 시작/종료 일시, GAS Web App URL</b></li>
            <li>항상 동일 (변경 불필요): <b>관리자 이메일(krids.org@gmail.com), Supabase, Resend, krids 서비스계정, GitHub, Vercel Cron</b></li>
            <li>요금제: 응답 수가 늘면 Supabase(대시보드 &gt; Billing), Resend(발송량), Vercel(사용량)에서 각각 Pro 신청 — 코드 수정 불필요</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
