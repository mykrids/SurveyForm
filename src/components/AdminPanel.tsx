"use client";
import { useEffect, useState, useMemo } from "react";
import { DUPLICATE_CHECK_TYPES, END_MESSAGE_PRESETS } from "@/lib/constants";
import { getDuplicateWarning } from "@/lib/duplicate";
import { checkEmailTypo } from "@/lib/emailTypo";
import { slugify, validateTaxonomyFields, type TaxonomyField } from "@/lib/taxonomy";
import { PRESET_LABELS, defaultValidations, ensureDefaults, validateOverrides, type QuestionOverrides, type QuestionOverride, type ValidationRule } from "@/lib/questionConfig";
import type { ParsedQuestion } from "@/lib/forms";

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
  is_template?: boolean;
  template_category?: string | null;
  template_color?: string | null;
  template_order?: number | null;
  taxonomy_fields?: TaxonomyField[];
  question_overrides?: QuestionOverrides;
  created_at?: string;
};

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

// 랜딩 6종 데모 템플릿 ID — 목록에서 구분용 (Landing.tsx TEMPLATE_SURVEY_MAP과 동일)
const DEMO_SURVEY_IDS = new Set([
  "790f4713-0894-49a4-8e93-297f8f68a614",
  "6440c1c4-ab8c-42f0-a8c3-1ad731565d6f",
  "983d0315-4c2c-48cc-81b6-c7da291ed20a",
  "afb5c989-95c4-4a8b-9846-e63be0d27b09",
  "e6524f44-b0c7-4897-83c0-d934c5ed5e2a",
  "18bcc7b5-e1b7-4915-a9a8-ca3711af895f",
]);

type Tab = "settings" | "edit" | "list";

export default function AdminPanel({ role }: { role?: "administrator" | "supervisor" }) {
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("settings");
  const [form, setForm] = useState<Partial<Survey> & { taxonomy_fields?: TaxonomyField[]; question_overrides?: QuestionOverrides }>({
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
    question_overrides: {},
  });
  const [msg, setMsg] = useState("");
  const [newTaxLabel, setNewTaxLabel] = useState("");
  const [newTaxType, setNewTaxType] = useState<"text"|"select">("text");
  const [newTaxHidden, setNewTaxHidden] = useState(false);
  const [newTaxOptions, setNewTaxOptions] = useState("");
  const [fetchedQuestions, setFetchedQuestions] = useState<ParsedQuestion[] | null>(null);
  const [fetchStatus, setFetchStatus] = useState("");
  const [sectionCount, setSectionCount] = useState(0);
  // 목록 스마트 관리
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all"|"active"|"ended"|"draft"|"demo">("all");
  const [listPage, setListPage] = useState(1);
  const PAGE_SIZE = 6;
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [templateModal, setTemplateModal] = useState<Survey | null>(null);
  const [templateCategory, setTemplateCategory] = useState("Education");
  const [templateColor, setTemplateColor] = useState("bg-violet-500");

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
  // 해시로 탭 직접 이동 — 메뉴 찾기 쉽게 /admin#list
  useEffect(()=>{
    const h = window.location.hash.replace("#","") as Tab;
    if (h==="settings"||h==="edit"||h==="list") setActiveTab(h);
  },[]);
  function clearAllFilters() {
    setSearch("");
    setStatusFilter("all");
    setListPage(1);
    setSelectedIds(new Set());
  }

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

  async function fetchQuestions() {
    const fid = form.form_id?.trim();
    if (!fid) { setFetchStatus("Form ID를 먼저 입력하세요"); return; }
    setFetchStatus("문항 불러오는 중…");
    try {
      const r = await fetch(`/api/forms/${fid}`);
      const j = await r.json();
      if (j.form?.questions) {
        setFetchedQuestions(j.form.questions as ParsedQuestion[]);
        setSectionCount((j.form.sectionBreaks?.length || 0) + 1);
        const cur = form.question_overrides || {};
        let added = 0;
        for (const q of j.form.questions as ParsedQuestion[]) {
          if (!cur[q.id]) {
            cur[q.id] = { required: q.required ? true : null, validations: defaultValidations(), branchEnabled: false, branchMap: {} };
            added++;
          }
        }
        if (added > 0) setForm(f => ({ ...f, question_overrides: { ...cur } }));
        setFetchStatus(`문항 ${j.form.questions.length}개 로드됨 — 편집 가능`);
      } else setFetchStatus("문항을 찾을 수 없습니다");
    } catch (e) {
      setFetchStatus(`로드 실패: ${String(e)}`);
    }
  }
  function updateOverride(qid: string, patch: Partial<QuestionOverride>) {
    const cur = form.question_overrides || {};
    const base = ensureDefaults(cur[qid]);
    const next = { ...cur, [qid]: { ...base, ...patch } };
    setForm({ ...form, question_overrides: next });
  }
  function updateValidation(qid: string, preset: string, patch: Partial<ValidationRule>) {
    const cur = form.question_overrides || {};
    const base = ensureDefaults(cur[qid]);
    const vals = (base.validations || []).map(v => v.preset === preset ? { ...v, ...patch } : v);
    updateOverride(qid, { validations: vals });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (form.admin_email) {
      const typo = checkEmailTypo(form.admin_email);
      if (!typo.ok) { setMsg(`오류: 관리자 이메일 오타 — ${typo.reason}`); return; }
    }
    if (form.taxonomy_fields) {
      const err = validateTaxonomyFields(form.taxonomy_fields);
      if (err) { setMsg(`오류: 분류 필드 검증 실패 — ${err}`); return; }
    }
    if (form.question_overrides) {
      const err = validateOverrides(form.question_overrides);
      if (err) { setMsg(`오류: 문항 설정 오류 — ${err}`); return; }
    }
    setMsg("저장 중…");
    const r = await fetch("/api/admin/surveys", { method: "POST", headers: { "Content-Type":"application/json" }, body: JSON.stringify(form) });
    const j = await r.json();
    if (!r.ok) setMsg(`오류: ${j.error || r.status}`);
    else {
      setMsg("저장 완료 — 응답 페이지 링크가 아래 목록에 생성되었습니다.");
      setForm({ title:"", form_id:"", start_at:"", end_at:"", report_delay_hours:1, duplicate_check_type:"none", end_message_preset:"1", gas_webapp_url: CURRENT_VALUES.gasUrl, admin_email: CURRENT_VALUES.adminEmail, taxonomy_fields: [], question_overrides: {} });
      setFetchedQuestions(null); setFetchStatus("");
      load();
      setActiveTab("list");
    }
  }

  function loadToEdit(s: Survey) {
    setForm({
      title: s.title,
      form_id: s.form_id || "",
      start_at: s.start_at ? s.start_at.slice(0,16) : "",
      end_at: s.end_at ? s.end_at.slice(0,16) : "",
      report_delay_hours: s.report_delay_hours,
      duplicate_check_type: s.duplicate_check_type,
      end_message_preset: s.end_message_preset,
      gas_webapp_url: s.gas_webapp_url,
      admin_email: s.admin_email,
      taxonomy_fields: s.taxonomy_fields || [],
      question_overrides: s.question_overrides || {},
    });
    setFetchedQuestions(null);
    setFetchStatus("기존 설문을 불러왔습니다 — Form ID로 문항을 다시 불러와 편집하세요");
    setActiveTab("settings");
    window.scrollTo({ top: 0, behavior: "smooth" });
    setMsg(`편집 모드: ${s.title} (${s.id.slice(0,8)}) — 수정 후 저장하면 새 설문으로 생성됩니다 (동일 제목으로 관리)`);
  }

  const warning = getDuplicateWarning(form.duplicate_check_type || "none");
  const selectedPreset = END_MESSAGE_PRESETS[form.end_message_preset as keyof typeof END_MESSAGE_PRESETS] || END_MESSAGE_PRESETS["1"];
  const adminEmailTypo = form.admin_email ? checkEmailTypo(form.admin_email) : null;

  const filtered = useMemo(()=>{
    let arr = [...surveys];
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      arr = arr.filter(s => s.title.toLowerCase().includes(q) || s.id.toLowerCase().includes(q) || (s.form_id||"").toLowerCase().includes(q));
    }
    const now = new Date();
    if (statusFilter !== "all") {
      arr = arr.filter(s=>{
        const isDemo = DEMO_SURVEY_IDS.has(s.id) || !!s.is_template;
        const start = s.start_at ? new Date(s.start_at) : null;
        const end = s.end_at ? new Date(s.end_at) : null;
        const isDraft = !s.form_id;
        const isEnded = end ? now > end : false;
        const isActive = (!start || now >= start) && (!end || now <= end) && !isDraft;
        if (statusFilter==="demo") return isDemo;
        if (statusFilter==="draft") return isDraft && !isDemo;
        if (statusFilter==="ended") return isEnded && !isDemo;
        if (statusFilter==="active") return isActive && !isDemo;
        return true;
      });
    }
    return arr;
  }, [surveys, search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((listPage-1)*PAGE_SIZE, listPage*PAGE_SIZE);
  useEffect(()=>{ setListPage(1); }, [search, statusFilter]);
  useEffect(()=>{ setSelectedIds(new Set()); }, [search, statusFilter]);

  function toggleSelect(id: string, isEnded: boolean) {
    if (!isEnded) return;
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function deleteSelected() {
    if (selectedIds.size === 0) return;
    if (role !== "administrator") { setMsg("오류: 삭제는 Administrator만 가능합니다."); return; }
    if (!confirm(`선택한 종료 설문 ${selectedIds.size}개를 삭제하시겠습니까? (복구 불가, 응답 로그도 함께 삭제)`)) return;
    setMsg("삭제 중…");
    try {
      const r = await fetch("/api/admin/surveys", { method: "DELETE", headers: { "Content-Type":"application/json" }, body: JSON.stringify({ ids: Array.from(selectedIds) }) });
      const j = await r.json();
      if (!r.ok) { setMsg(`오류: ${j.error || r.status}`); return; }
      setMsg(`삭제 완료: ${j.deleted}개 삭제됨`);
      setSelectedIds(new Set());
      load();
    } catch (e) { setMsg(`삭제 실패: ${String(e)}`); }
  }

  function openTemplateModal(s: Survey) {
    setTemplateCategory(s.template_category || "Education");
    setTemplateColor(s.template_color || "bg-violet-500");
    setTemplateModal(s);
  }
  async function confirmTemplateRegister() {
    if (!templateModal) return;
    const isDeregister = !!templateModal.is_template;
    const body = isDeregister
      ? { id: templateModal.id, is_template: false }
      : { id: templateModal.id, is_template: true, template_category: templateCategory, template_color: templateColor };
    setMsg(isDeregister ? "템플릿 해제 중…" : "템플릿 등록 중…");
    try {
      const r = await fetch("/api/admin/surveys", { method: "PATCH", headers: { "Content-Type":"application/json" }, body: JSON.stringify(body) });
      const j = await r.json();
      if (!r.ok) { setMsg(`오류: ${j.error || r.status}`); return; }
      setMsg(isDeregister ? "템플릿 해제됨 — 랜딩에서 제거됨" : "템플릿 등록됨 — 랜딩 + 버튼 펼치면 노출");
      setTemplateModal(null);
      load();
    } catch (e) { setMsg(`실패: ${String(e)}`); }
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-8 bg-background text-foreground">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">관리자</h1>
        {role && <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${role === "administrator" ? "bg-zinc-900 dark:bg-white dark:text-black text-white" : "bg-blue-600 text-white"}`}>{role === "administrator" ? "Administrator" : "Supervisor"} 모드</span>}
        <span className="text-xs text-zinc-500 dark:text-zinc-400">{surveys.length}개 설문</span>
      </div>

      {/* 탭 메뉴 — sticky + hash 지원으로 찾기 쉽게 */}
      <div id="admin-tabs" className="mt-6 flex gap-1 p-1.5 bg-zinc-900 dark:bg-zinc-800 rounded-2xl w-fit sticky top-2 z-10 shadow-lg border border-zinc-700/20">
        {[
          { id: "settings", label: "① 설문 설정", desc: "제목·기간·분류" },
          { id: "edit", label: "② 설문 편집", desc: "필수·검증·분기" },
          { id: "list", label: "③ 등록 목록", desc: `(${surveys.length})` },
        ].map(t=>(
          <button key={t.id} onClick={()=>{ setActiveTab(t.id as Tab); history.replaceState(null,"",`#${t.id}`); }} className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition ${activeTab===t.id ? "bg-white dark:bg-white text-zinc-900 shadow" : "text-zinc-400 hover:text-white hover:bg-white/10"}`}>
            {t.label} <span className="text-xs font-normal hidden md:inline opacity-70">{t.desc}</span>
          </button>
        ))}
      </div>
      <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
        {activeTab==="settings" && "설문 제목·기간·중복방지·GAS URL을 설정합니다. 저장 전 설문 편집 탭에서 문항 제어를 추가할 수 있습니다."}
        {activeTab==="edit" && "Google Form 문항을 불러와 문항별 필수·검증·조건부 이동을 체크만으로 적용합니다. 전부 OFF가 기본이라 안전합니다."}
        {activeTab==="list" && "등록된 설문을 검색·필터·페이지로 관리합니다. 편집 버튼으로 설정/편집 탭에 불러올 수 있습니다. — 필터가 안 보이면 아래 검색/상태 칩의 × 또는 “필터 초기화”를 누르세요."}
      </p>

      {/* 공통 안내 */}
      <div className="mt-4 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950 px-3 py-2 text-xs leading-relaxed">
        <span className="font-semibold text-blue-900 dark:text-blue-200">분리 운영:</span> <span className="text-blue-800 dark:text-blue-300">구글 폼 문항 편집은 drive.google.com에서 직접, 관리자에서는 <b>Form ID 연결 + 제어 설정</b>만 합니다.</span>
      </div>

      {/* 시스템 설정 — 접기 가능 */}
      <details className="mt-4 border border-zinc-200 dark:border-zinc-800 rounded-2xl bg-zinc-50 dark:bg-zinc-900">
        <summary className="px-5 py-3 text-sm font-semibold text-zinc-900 dark:text-white cursor-pointer flex justify-between items-center">⚙️ 현재 시스템 설정 <span className="text-xs font-normal bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 px-2 py-0.5 rounded-full">자동 입력됨</span></summary>
        <div className="px-5 pb-5">
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
      </details>

      {/* 탭 ①: 설문 설정 */}
      {activeTab==="settings" && (
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
            <span className="text-xs text-zinc-500 dark:text-zinc-400">중복 방지 상세는 도움말 참고</span>
          </label>
          <label className="text-sm font-medium text-zinc-900 dark:text-white">
            종료 메시지 프리셋 (10종) <span className="text-xs text-zinc-500 font-normal">1~10번</span>
            <select value={form.end_message_preset} onChange={e=>setForm({...form,end_message_preset:e.target.value})} className="mt-1 w-full border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-2 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900">
              {Object.entries(END_MESSAGE_PRESETS).map(([k,v])=><option key={k} value={k}>{k}. {v.label}</option>)}
            </select>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">선택한 번호의 문구가 응답 완료 화면에 표시</span>
          </label>
        </div>
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800 p-3">
          <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">선택된 종료 메시지 미리보기 — {form.end_message_preset}번</p>
          <p className="text-sm font-medium text-zinc-900 dark:text-white mt-1">{selectedPreset.label}</p>
          <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">{selectedPreset.body}</p>
        </div>
        {warning && <p className="text-xs bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2 text-amber-800 dark:text-amber-200">⚠️ {warning}</p>}
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800 p-4">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">🏷️ 분류 필드 (선택) <span className="text-xs font-normal text-zinc-500 dark:text-zinc-400">예: 교수명, 학과명, 과목명 등 — 설문별 유연 지정</span></h3>
          <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">설문 응답을 교수/학과/과목 등으로 나누어 집계해야 할 때, 관리자 사이트에서 분류 단어를 직접 지정하세요. 예) 강의평가: <code className="bg-zinc-100 dark:bg-zinc-700 px-1 rounded">교수명</code> + <code className="bg-zinc-100 dark:bg-zinc-700 px-1 rounded">과목명</code>, 교육과정 평가: <code className="bg-zinc-100 dark:bg-zinc-700 px-1 rounded">학과명</code>.</p>
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
          <p className="mt-2 text-[11px] text-zinc-500 dark:text-zinc-400">숨김 시 <code className="bg-zinc-100 dark:bg-zinc-700 px-1 rounded">/s/{"{id}"}?{newTaxLabel?slugify(newTaxLabel):"key"}=값</code> 형태로 링크 배포</p>
        </div>
        <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950 p-3 text-xs leading-relaxed">
          <p className="font-semibold text-blue-900 dark:text-blue-200">응답자 안내 — 중복 방지별 “해야 할 일”</p>
          <ul className="mt-1 list-disc list-inside text-blue-800 dark:text-blue-300 space-y-1">
            <li><b>제한 없음:</b> 응답자는 그냥 설문 응답하면 됩니다.</li>
            <li><b>쿠키/LocalStorage:</b> 그냥 응답하면 됩니다. 같은 브라우저 재응답 시 “이미 제출됨” 차단.</li>
            <li><b>이메일 기반:</b> 이메일 칸에 본인 메일을 입력하고 응답하면 됩니다.</li>
          </ul>
        </div>
        <label className="text-sm font-medium text-zinc-900 dark:text-white">
          GAS Web App URL
          <input value={form.gas_webapp_url||""} onChange={e=>setForm({...form,gas_webapp_url:e.target.value})} className="mt-1 w-full border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-2 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900" placeholder="https://script.google.com/macros/s/…/exec (시트마다 새로 배포 시 URL 변경)" />
          <span className="text-xs text-zinc-500 dark:text-zinc-400">배포 후 받은 전체 URL을 그대로 붙여넣으면 됩니다</span>
        </label>
        <label className="text-sm font-medium text-zinc-900 dark:text-white">
          관리자 이메일 (PDF 수신) <span className="text-xs text-zinc-500 font-normal">항상 동일: krids.org@gmail.com</span>
          <input type="email" value={form.admin_email||""} onChange={e=>setForm({...form,admin_email:e.target.value})} className={`mt-1 w-full border rounded-lg px-3 py-2 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 ${adminEmailTypo && !adminEmailTypo.ok ? "border-red-300 dark:border-red-700" : "border-zinc-300 dark:border-zinc-700"}`} placeholder="krids.org@gmail.com (자동 입력됨)" />
          {adminEmailTypo && !adminEmailTypo.ok ? (
            <div className="mt-1 flex items-center gap-2 text-xs">
              <span className="text-red-600 dark:text-red-400">⚠️ {adminEmailTypo.reason}</span>
              {adminEmailTypo.suggestion && <button type="button" onClick={()=>setForm({...form, admin_email: adminEmailTypo.suggestion})} className="underline text-blue-600 dark:text-blue-400">‘{adminEmailTypo.suggestion}’로 교정</button>}
            </div>
          ) : (
            <span className="text-xs text-zinc-500 dark:text-zinc-400">보고서 PDF가 이 메일로 자동 발송됩니다</span>
          )}
        </label>
        <div className="flex flex-wrap gap-3 items-center">
          <button type="submit" className="rounded-full bg-black dark:bg-white dark:text-black text-white px-6 py-2 text-sm font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200 transition">설문 저장</button>
          <button type="button" onClick={()=>setActiveTab("edit")} className="rounded-full border border-zinc-300 dark:border-zinc-700 px-5 py-2 text-sm dark:text-white">다음: 설문 편집 →</button>
          {msg && <span className="text-sm text-zinc-700 dark:text-zinc-300 font-medium">{msg}</span>}
        </div>
      </form>
      )}

      {/* 탭 ②: 설문 편집 */}
      {activeTab==="edit" && (
      <div className="mt-6 grid gap-5 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 bg-white dark:bg-zinc-900">
        <div>
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">📝 설문 편집 <span className="text-xs font-normal text-zinc-500 dark:text-zinc-400">문항별 필수·검증·조건부 이동 — 전부 OFF가 기본</span></h3>
          <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">현재 입력된 Form ID: <code className="bg-zinc-100 dark:bg-zinc-800 px-1 rounded">{form.form_id || "— (설정 탭에서 입력)"}</code> — 문항을 불러와 체크만으로 제어하세요. OFF면 현재 동작과 동일해 안전합니다.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={fetchQuestions} className="rounded-full bg-zinc-900 dark:bg-white dark:text-black text-white px-4 py-2 text-xs font-medium hover:bg-amber-600 dark:hover:bg-amber-500 hover:text-white dark:hover:text-white transition">문항 불러오기</button>
          {fetchStatus && <span className="text-xs text-zinc-600 dark:text-zinc-400 self-center">{fetchStatus}</span>}
        </div>
        {!fetchedQuestions && <p className="text-xs text-zinc-500 dark:text-zinc-400">Form ID를 입력한 뒤 문항을 불러오면 편집 UI가 나타납니다.</p>}
        {fetchedQuestions && fetchedQuestions.length>0 && (
          <div className="space-y-3">
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">섹션 {sectionCount}개 — 페이지네이션은 섹션 우선, 없으면 5문항씩</p>
            {fetchedQuestions.map((q, idx)=> {
              const ov = ensureDefaults((form.question_overrides || {})[q.id]);
              const isRequiredEffective = ov.required !== null ? !!ov.required : !!q.required;
              return (
              <div key={q.id} className="border dark:border-zinc-700 rounded-xl p-3 bg-zinc-50 dark:bg-zinc-800">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-medium text-zinc-900 dark:text-white">{idx+1}. {q.title}</span>
                  <span className="text-[11px] px-1.5 py-0.5 rounded bg-white dark:bg-zinc-900 border dark:border-zinc-700 text-zinc-600 dark:text-zinc-300">{q.type}{q.rawType?`(${q.rawType})`:""}</span>
                  {q.required && <span className="text-[11px] px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300">Google 필수</span>}
                  {isRequiredEffective && <span className="text-[11px] px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300">필수 적용</span>}
                </div>
                {q.options && q.options.length>0 && <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1">선택지: {q.options.join(", ")}</p>}
                <div className="mt-3 grid gap-3">
                  <label className="flex items-center gap-2 text-xs dark:text-white bg-white dark:bg-zinc-900 border dark:border-zinc-700 rounded-lg px-2 py-1.5">
                    <input type="checkbox" checked={isRequiredEffective} onChange={e=>updateOverride(q.id,{ required: e.target.checked })} />
                    필수 — 체크 시 반드시 입력해야 다음으로 이동 <span className="text-zinc-500">OFF=Google 유지</span>
                  </label>
                  <div className="border dark:border-zinc-700 rounded-lg p-2 bg-white dark:bg-zinc-900">
                    <p className="text-xs font-medium dark:text-white">검증 프리셋 — 필요한 것만 ON</p>
                    <div className="mt-2 grid md:grid-cols-2 gap-2">
                      {(ov.validations||[]).map(r=> (
                        <div key={r.preset} className={`flex flex-col gap-1 border rounded-lg px-2 py-1.5 ${r.enabled?"bg-white dark:bg-zinc-900 border-blue-300 dark:border-blue-700":"bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 opacity-70"}`}>
                          <label className="flex items-center gap-1.5 text-xs dark:text-white">
                            <input type="checkbox" checked={!!r.enabled} onChange={e=>updateValidation(q.id, r.preset, { enabled: e.target.checked })} />
                            {PRESET_LABELS[r.preset as keyof typeof PRESET_LABELS]}
                          </label>
                          {r.preset==="length" && r.enabled && <div className="flex gap-1"><input type="number" value={r.minLength??""} onChange={e=>updateValidation(q.id,"length",{ minLength: e.target.value?Number(e.target.value):undefined })} placeholder="min" className="w-16 border rounded px-1 py-0.5 text-xs" />~<input type="number" value={r.maxLength??""} onChange={e=>updateValidation(q.id,"length",{ maxLength: e.target.value?Number(e.target.value):undefined })} placeholder="max" className="w-16 border rounded px-1 py-0.5 text-xs" /></div>}
                          {r.preset==="range" && r.enabled && <div className="flex gap-1"><input type="number" value={r.minValue??""} onChange={e=>updateValidation(q.id,"range",{ minValue: e.target.value?Number(e.target.value):undefined })} placeholder="min" className="w-16 border rounded px-1 py-0.5 text-xs" />~<input type="number" value={r.maxValue??""} onChange={e=>updateValidation(q.id,"range",{ maxValue: e.target.value?Number(e.target.value):undefined })} placeholder="max" className="w-16 border rounded px-1 py-0.5 text-xs" /></div>}
                          {r.preset==="regex" && r.enabled && <input value={r.pattern||""} onChange={e=>updateValidation(q.id,"regex",{ pattern: e.target.value })} placeholder="정규식 (예: ^010-\\d{4}-\\d{4}$)" className="w-full border rounded px-1.5 py-1 text-xs" />}
                          {r.preset==="allowedValues" && r.enabled && <input value={(r.allowedValues||[]).join(",")} onChange={e=>updateValidation(q.id,"allowedValues",{ allowedValues: e.target.value.split(",").map(s=>s.trim()).filter(Boolean) })} placeholder="허용값 콤마 구분 (예: 동의함)" className="w-full border rounded px-1.5 py-1 text-xs" />}
                        </div>
                      ))}
                    </div>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1">개인정보: 필수 ON + 허용값 ‘동의함’ 시 미동의 상태에서 ‘다음’ 차단</p>
                  </div>
                  <div className="border dark:border-zinc-700 rounded-lg p-2 bg-white dark:bg-zinc-900">
                    <label className="flex items-center gap-2 text-xs font-medium dark:text-white"><input type="checkbox" checked={!!ov.branchEnabled} onChange={e=>updateOverride(q.id,{ branchEnabled: e.target.checked })} />조건부 이동 ON/OFF — 선택지 값에 따라 섹션 이동</label>
                    {ov.branchEnabled && (
                      <div className="mt-2 space-y-1">
                        {(q.options||[]).length===0 && <p className="text-[11px] text-amber-600">선택지 문항(RADIO/CHECKBOX)에서만 동작</p>}
                        {(q.options||[]).map(opt=>(
                          <div key={opt} className="flex items-center gap-2 text-xs">
                            <span className="min-w-[80px] truncate dark:text-white">{opt}</span>
                            <span className="text-zinc-500">→</span>
                            <select value={String(ov.branchMap?.[opt] ?? "")} onChange={e=>{ const v=e.target.value; const map={...(ov.branchMap||{})}; if(v==="") delete map[opt]; else if(v==="END") map[opt]="END"; else map[opt]=Number(v); updateOverride(q.id,{ branchMap: map }); }} className="border rounded px-1.5 py-1 text-xs bg-white dark:bg-zinc-900 dark:text-white">
                              <option value="">다음 섹션(기본)</option>
                              <option value="END">종료(제출 차단 없이 건너뜀)</option>
                              {Array.from({length: sectionCount}, (_,i)=> <option key={i} value={i}>섹션 {i+1}로 이동</option>)}
                            </select>
                          </div>
                        ))}
                        <p className="text-[11px] text-zinc-500">미지정 시 선형 다음 페이지로 진행</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              );
            })}
          </div>
        )}
        {fetchedQuestions && fetchedQuestions.length===0 && <p className="text-xs text-zinc-500 mt-2">불러온 문항이 없습니다 — Form ID와 뷰어 공유를 확인하세요</p>}
        <div className="flex flex-wrap gap-3 items-center border-t dark:border-zinc-700 pt-4">
          <button type="button" onClick={()=>setActiveTab("settings")} className="rounded-full border border-zinc-300 dark:border-zinc-700 px-5 py-2 text-sm dark:text-white">← 설정으로</button>
          <button type="button" onClick={submit as unknown as ()=>void} className="rounded-full bg-black dark:bg-white dark:text-black text-white px-6 py-2 text-sm font-medium">설문 저장</button>
          {msg && <span className="text-sm text-zinc-700 dark:text-zinc-300">{msg}</span>}
        </div>
      </div>
      )}

      {/* 탭 ③: 등록 목록 — 스마트 관리 */}
      {activeTab==="list" && (
      <div className="mt-6 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 bg-white dark:bg-zinc-900">
        <div className="flex flex-wrap justify-between gap-3 items-center">
          <h2 className="font-semibold text-zinc-900 dark:text-white">등록된 설문 {loading ? "(로딩…)" : `(${filtered.length}/${surveys.length})`} {selectedIds.size>0 && <span className="text-amber-600 dark:text-amber-400">· {selectedIds.size}개 선택</span>}</h2>
          <div className="flex gap-2">
            {selectedIds.size>0 && <button onClick={deleteSelected} className="text-xs rounded-full bg-red-600 text-white px-4 py-1.5 font-medium hover:bg-red-700 transition">선택 삭제 ({selectedIds.size})</button>}
            <button onClick={load} className="text-xs border border-zinc-300 dark:border-zinc-700 rounded-full px-3 py-1 dark:text-white hover:bg-zinc-50 dark:hover:bg-zinc-800">새로고침</button>
          </div>
        </div>
        {selectedIds.size>0 && <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">종료된 설문만 선택 가능 — 체크된 항목은 제목 앞에 ✓ 표시</p>}
        <div className="mt-3 grid md:grid-cols-12 gap-2">
          <div className="md:col-span-7 relative">
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="검색: 제목 / ID / Form ID" className="w-full border border-zinc-300 dark:border-zinc-700 rounded-full pl-4 pr-8 py-2 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder:text-zinc-400" />
            {search && (
              <button onClick={()=>setSearch("")} aria-label="검색어 지우기" className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 rounded-full bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-300 dark:hover:bg-zinc-600 flex items-center justify-center text-sm leading-none">×</button>
            )}
          </div>
          <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value as typeof statusFilter)} className="md:col-span-3 border border-zinc-300 dark:border-zinc-700 rounded-full px-3 py-2 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white">
            <option value="all">전체</option>
            <option value="active">진행중</option>
            <option value="ended">종료됨</option>
            <option value="draft">초안(Form 미연결)</option>
            <option value="demo">데모템플릿</option>
          </select>
          <span className="md:col-span-2 text-xs text-zinc-500 dark:text-zinc-400 self-center text-right">{totalPages} 페이지 중 {listPage}</span>
        </div>
        {(search || statusFilter!=="all") && (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {search && <span className="inline-flex items-center gap-1.5 text-xs bg-zinc-100 dark:bg-zinc-800 border dark:border-zinc-700 rounded-full pl-3 pr-1 py-1">검색: “{search}” <button type="button" onClick={()=>setSearch("")} className="h-5 w-5 rounded-full bg-white dark:bg-zinc-700 border dark:border-zinc-600 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-900 hover:text-white dark:hover:bg-white dark:hover:text-zinc-900 flex items-center justify-center leading-none">×</button></span>}
            {statusFilter!=="all" && <span className="inline-flex items-center gap-1.5 text-xs bg-zinc-100 dark:bg-zinc-800 border dark:border-zinc-700 rounded-full pl-3 pr-1 py-1">상태: {statusFilter==="active"?"진행중":statusFilter==="ended"?"종료됨":statusFilter==="draft"?"초안":statusFilter==="demo"?"데모템플릿":statusFilter} <button type="button" onClick={()=>setStatusFilter("all")} className="h-5 w-5 rounded-full bg-white dark:bg-zinc-700 border dark:border-zinc-600 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-900 hover:text-white dark:hover:bg-white dark:hover:text-zinc-900 flex items-center justify-center leading-none">×</button></span>}
            <button type="button" onClick={clearAllFilters} className="text-xs font-semibold underline text-amber-700 dark:text-amber-300 hover:text-amber-900 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-full px-3 py-1">필터 모두 제거 (Clear Filters)</button>
          </div>
        )}
        <div className="mt-4 grid gap-3">
          {paged.map(s=>{
            const end = s.end_at ? new Date(s.end_at) : null;
            const isEnded = end ? new Date() > end : false;
            const isDraft = !s.form_id;
            const isFixedDemo = DEMO_SURVEY_IDS.has(s.id);
            const isTemplate = !!s.is_template;
            const isDemo = isFixedDemo || isTemplate;
            const isSelected = selectedIds.has(s.id);
            const canCheck = isEnded && !isDemo;
            const canPromote = !isFixedDemo && !isDraft && !!s.form_id;
            return (
            <div key={s.id} className={`border rounded-xl p-4 flex gap-3 ${isSelected ? "border-amber-400 dark:border-amber-600 bg-amber-50 dark:bg-amber-950" : isDemo ? "border-violet-200 dark:border-violet-800 bg-violet-50/50 dark:bg-violet-950/30" : "border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800"}`}>
              <input type="checkbox" checked={isSelected} disabled={!canCheck} onChange={()=>toggleSelect(s.id, canCheck)} title={isDemo ? "데모템플릿은 삭제 불가" : canCheck ? "종료 설문 선택" : "종료된 설문만 선택 가능"} className="mt-1 h-4 w-4 accent-amber-600 disabled:opacity-30" />
              <div className="flex-1 min-w-0">
              <div className="flex flex-wrap justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-zinc-900 dark:text-white truncate">{isSelected && <span className="text-amber-600 dark:text-amber-400 mr-1">✓</span>}{s.title} <span className="text-xs text-zinc-500 dark:text-zinc-400">/{s.id.slice(0,8)}</span> {isDemo && <span className="ml-1 text-[11px] px-1.5 py-0.5 rounded bg-violet-100 dark:bg-violet-900 text-violet-700 dark:text-violet-300">{isFixedDemo ? "데모템플릿" : "추가 템플릿"}</span>} {isDraft && !isDemo && <span className="ml-1 text-[11px] px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300">초안</span>} {isEnded && !isDemo && <span className="ml-1 text-[11px] px-1.5 py-0.5 rounded bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300">종료</span>}</p>
                  <p className="text-xs text-zinc-700 dark:text-zinc-300 mt-1">기간: {s.start_at||"—"} ~ {s.end_at||"—"} · 중복:{s.duplicate_check_type} · 지연:{s.report_delay_hours}h · preset:{s.end_message_preset}</p>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400 truncate">Form: {s.form_id||"—"} · GAS: {s.gas_webapp_url ? s.gas_webapp_url.slice(0,40)+"…" : "—"}</p>
                  {s.taxonomy_fields && s.taxonomy_fields.length>0 && <p className="text-xs text-violet-600 dark:text-violet-300 mt-1">분류: {s.taxonomy_fields.map((f: TaxonomyField)=>`${f.label}(${f.key})${f.hidden?"·숨김":""}`).join(", ")}</p>}
                  {s.question_overrides && Object.keys(s.question_overrides).length>0 && <p className="text-[11px] text-blue-600 dark:text-blue-300">문항제어 {Object.keys(s.question_overrides).length}개 · {Object.values(s.question_overrides).filter(v=>v.branchEnabled).length}개 분기</p>}
                </div>
                <div className="flex gap-2 self-start flex-wrap">
                  <button onClick={()=>loadToEdit(s)} disabled={isDemo} title={isDemo ? "데모템플릿은 편집 불가 — 복제 후 사용" : "설정/편집 탭으로 불러오기"} className={`text-xs border rounded-full px-3 py-1 ${isDemo ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 border-zinc-200 dark:border-zinc-700 cursor-not-allowed" : "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white border-zinc-300 dark:border-zinc-700 hover:bg-zinc-900 hover:text-white dark:hover:bg-white dark:hover:text-zinc-900 transition"}`}>편집 불러오기</button>
                  <a href={`/s/${s.id}`} className="text-xs border border-zinc-300 dark:border-zinc-700 rounded-full px-3 py-1 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white hover:bg-zinc-900 hover:text-white dark:hover:bg-white dark:hover:text-zinc-900 transition">응답 페이지</a>
                  {canPromote && (
                    isTemplate ? (
                      <button onClick={()=>openTemplateModal(s)} className="text-xs border border-violet-300 dark:border-violet-700 rounded-full px-3 py-1 bg-violet-600 text-white hover:bg-violet-700 transition">★ 해제</button>
                    ) : (
                      <button onClick={()=>openTemplateModal(s)} className="text-xs border border-violet-300 dark:border-violet-700 rounded-full px-3 py-1 bg-white dark:bg-zinc-900 text-violet-700 dark:text-violet-300 hover:bg-violet-50 dark:hover:bg-violet-950 transition">★ 템플릿 등록</button>
                    )
                  )}
                </div>
              </div>
              {s.taxonomy_fields && s.taxonomy_fields.length>0 && <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-2 break-all">링크 예: /s/{s.id}?{s.taxonomy_fields.map((f: TaxonomyField)=>`${f.key}=값`).join("&")}</p>}
              </div>
            </div>
          );})}
          {!loading && filtered.length===0 && <div className="text-center py-6"><p className="text-sm text-zinc-600 dark:text-zinc-400">검색 결과가 없습니다 — No Results. No surveys match the current filters.</p><button type="button" onClick={clearAllFilters} className="mt-3 text-sm rounded-full border-2 border-amber-400 bg-amber-500 text-white px-6 py-2 font-semibold hover:bg-amber-600 transition">Clear Filters — 필터 초기화 (클릭 시 전체 보기)</button><p className="mt-2 text-[11px] text-zinc-500 dark:text-zinc-400">제자리면 새로고침(F5) 후 다시 시도 — 브라우저 캐시 문제일 수 있음</p></div>}
          {!loading && surveys.length===0 && <p className="text-sm text-zinc-600 dark:text-zinc-400">아직 설문이 없습니다. 설정 탭에서 생성하세요.</p>}
        </div>
        {totalPages > 1 && (
          <div className="mt-4 flex justify-center gap-2">
            <button disabled={listPage<=1} onClick={()=>setListPage(p=>Math.max(1,p-1))} className="px-3 py-1 text-xs border rounded-full disabled:opacity-50 dark:text-white dark:border-zinc-700">이전</button>
            <span className="text-xs px-3 py-1 text-zinc-600 dark:text-zinc-400">{listPage} / {totalPages}</span>
            <button disabled={listPage>=totalPages} onClick={()=>setListPage(p=>Math.min(totalPages,p+1))} className="px-3 py-1 text-xs border rounded-full disabled:opacity-50 dark:text-white dark:border-zinc-700">다음</button>
          </div>
        )}
        <p className="mt-3 text-[11px] text-zinc-500 dark:text-zinc-400 text-center">팁: 검색+상태 필터(전체/진행중/종료/초안/데모템플릿)+페이지(6개씩)로 관리. 데모템플릿은 편집·삭제 불가(보라색 배지), 실설문만 편집/삭제 가능. ★ 템플릿 등록은 실설문(Form 연결)에서만 — 등록 시 랜딩 6종 아래 아코디언에 자동 추가(최대 9개, 총 15개).</p>
      </div>
       )}
      {templateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="max-w-md w-full bg-white dark:bg-zinc-900 rounded-2xl p-6 border dark:border-zinc-800">
            <h3 className="font-bold dark:text-white">{templateModal.is_template ? "템플릿 해제" : "템플릿으로 등록"}</h3>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed">
              {templateModal.is_template
                ? `"${templateModal.title}"을(를) 랜딩 템플릿에서 제거합니다.`
                : `"${templateModal.title}"을(를) 랜딩 6종 아래 추가 템플릿으로 공개합니다. 소비자 데모로 노출됩니다.`}
            </p>
            {!templateModal.is_template && (
              <div className="mt-4 grid gap-3">
                <label className="text-xs font-medium dark:text-white">카테고리
                  <select value={templateCategory} onChange={e=>setTemplateCategory(e.target.value)} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm bg-white dark:bg-zinc-800 dark:text-white">
                    <option value="CSAT">CSAT</option>
                    <option value="Education">Education</option>
                    <option value="Event">Event</option>
                  </select>
                </label>
                <label className="text-xs font-medium dark:text-white">색상
                  <select value={templateColor} onChange={e=>setTemplateColor(e.target.value)} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm bg-white dark:bg-zinc-800 dark:text-white">
                    <option value="bg-violet-500">violet</option>
                    <option value="bg-blue-500">blue</option>
                    <option value="bg-emerald-500">emerald</option>
                    <option value="bg-orange-500">orange</option>
                    <option value="bg-pink-500">pink</option>
                    <option value="bg-cyan-500">cyan</option>
                  </select>
                </label>
                <p className="text-[11px] text-zinc-500">총 15개 제한(기본 6 + 추가 9) — 초과 시 해제 후 등록하세요.</p>
              </div>
            )}
            <div className="mt-6 flex justify-end gap-2">
              <button onClick={()=>setTemplateModal(null)} className="rounded-full border dark:border-zinc-700 px-5 py-2 text-sm dark:text-white">취소</button>
              <button onClick={confirmTemplateRegister} className={`rounded-full px-5 py-2 text-sm text-white ${templateModal.is_template ? "bg-zinc-900 dark:bg-white dark:text-black" : "bg-violet-600 hover:bg-violet-700"}`}>{templateModal.is_template ? "해제" : "등록"}</button>
            </div>
          </div>
        </div>
      )}

      {/* 도움말 */}
      <div className="mt-8 space-y-4">
        <details className="border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 bg-white dark:bg-zinc-900" open>
          <summary className="font-semibold text-zinc-900 dark:text-white cursor-pointer">실제 설문 등록 순서 (구글 → 관리자)</summary>
          <ol className="mt-4 list-decimal list-inside space-y-2 text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">
            <li><b>구글폼 생성:</b> drive.google.com → 새로 만들기 → Google Forms → 제목/문항 작성 (단답·장문·객관식·체크박스·척도·섹션). 개인정보 동의 문항은 선택지에 “동의함” 포함.</li>
            <li><b>뷰어 공유:</b> 폼 우측 상단 공유 → <code className="bg-zinc-100 dark:bg-zinc-800 px-1 rounded">survey-form@velvety-maker-506214-u5.iam.gserviceaccount.com</code> 뷰어 추가.</li>
            <li><b>Form ID 복사:</b> URL <code className="bg-zinc-100 dark:bg-zinc-800 px-1 rounded">https://docs.google.com/forms/d/1FAIpQLSd…/edit</code>에서 <b>1FAIpQLSd…</b> 복사.</li>
            <li><b>시트 연결:</b> 폼 응답 탭 → 스프레드시트 연결(새 시트) → 시트에서 확장 프로그램 → Apps Script → <code className="bg-zinc-100 dark:bg-zinc-800 px-1 rounded">gas/Code.gs</code> 붙여넣기 → Script Properties <code className="bg-zinc-100 dark:bg-zinc-800 px-1 rounded">SHARED_SECRET=2afea94…</code> → 배포(웹앱, Anyone) → URL 복사.</li>
            <li><b>관리자 설정 탭:</b> 제목·Form ID·기간·GAS URL·관리자 이메일·분류 필드(필요 시) 입력.</li>
            <li><b>설문 편집 탭:</b> “문항 불러오기” → 각 문항에 필수/검증(전화·이메일·날짜·URL 등)·조건부 이동 체크 (개인정보는 필수+허용값 ‘동의함’).</li>
            <li><b>저장:</b> “설문 저장” → 등록 목록 탭에서 링크 확인.</li>
            <li><b>배포:</b> <code className="bg-zinc-100 dark:bg-zinc-800 px-1 rounded">/s/{"{id}"}</code> 링크 배포, 분류 숨김이면 <code className="bg-zinc-100 dark:bg-zinc-800 px-1 rounded">/s/{"{id}"}?prof_name=홍길동</code> 형태로 배포.</li>
            <li><b>수정:</b> 목록에서 “편집 불러오기” → 설정/편집 탭에서 수정 → 저장(새 버전으로 생성, 기존 링크는 유지).</li>
          </ol>
        </details>
        <details className="border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 bg-white dark:bg-zinc-900">
          <summary className="font-semibold text-zinc-900 dark:text-white cursor-pointer">2️⃣ 설문 템플릿 만드는 방법</summary>
          <div className="mt-4 space-y-2 text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">
            <p>랜딩 6카드는 예시입니다. 구글폼에서 “사본 만들기”로 복제 → 문항 수정 → 새 Form ID로 관리자에 등록하세요.</p>
          </div>
        </details>
        <details className="border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 bg-white dark:bg-zinc-900">
          <summary className="font-semibold text-zinc-900 dark:text-white cursor-pointer">3️⃣ 중복 방지 상세</summary>
          <div className="mt-4 space-y-3 text-sm leading-relaxed">
            {[
              { k: "none", title: "제한 없음", how: "검사 없음.", todo: "그냥 응답하면 됩니다." },
              { k: "cookie", title: "쿠키 / LocalStorage", how: "동일 브라우저 재접속 차단.", todo: "그냥 응답하면 됩니다." },
              { k: "email", title: "이메일 기반 (권장)", how: "정규화 후 중복 차단.", todo: "이메일 입력 후 응답하면 됩니다." },
              { k: "email_verified", title: "이메일 인증 (추후)", how: "미구현, 일반 이메일과 동일.", todo: "그냥 이메일 입력하면 됩니다." },
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
            <li>항상 동일: <b>관리자 이메일(krids.org@gmail.com), Supabase, Resend, krids 서비스계정, GitHub, Vercel Cron</b></li>
          </ul>
        </div>
      </div>
    </div>
  );
}
