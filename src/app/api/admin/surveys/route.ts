import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { verifyToken, COOKIE_NAME } from "@/lib/auth";
import { validateTaxonomyFields, type TaxonomyField } from "@/lib/taxonomy";
import { validateOverrides, type QuestionOverrides } from "@/lib/questionConfig";

export const dynamic = "force-dynamic";

// in-memory fallback when Supabase not configured
const mem: Record<string, unknown>[] = (globalThis as unknown as { __memSurveys?: Record<string, unknown>[] }).__memSurveys || [];
(globalThis as unknown as { __memSurveys: Record<string, unknown>[] }).__memSurveys = mem;

function requireAdmin(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyToken(token);
}

export async function GET(req: NextRequest) {
  const role = requireAdmin(req);
  if (!role) return NextResponse.json({ error: "관리자 로그인이 필요합니다." }, { status: 401 });
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ surveys: mem, warning: "Supabase 미설정 — 메모리 목업 반환" });
  }
  const { data, error } = await supabase.from("surveys").select("*").order("created_at", { ascending: false }).limit(50);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ surveys: data });
}

export async function POST(req: NextRequest) {
  const role = requireAdmin(req);
  if (!role) return NextResponse.json({ error: "관리자 로그인이 필요합니다." }, { status: 401 });
  const body = await req.json();
  const { title, form_id, start_at, end_at, report_delay_hours, duplicate_check_type, end_message_preset, gas_webapp_url, admin_email, taxonomy_fields, question_overrides } = body;
  if (!title) return NextResponse.json({ error: "title required" }, { status: 400 });
  const taxFields = (taxonomy_fields as TaxonomyField[] | undefined) || [];
  if (taxFields.length > 0) {
    const err = validateTaxonomyFields(taxFields);
    if (err) return NextResponse.json({ error: `taxonomy_fields 오류: ${err}` }, { status: 400 });
  }
  const qOverrides = (question_overrides as QuestionOverrides | undefined) || {};
  {
    const err = validateOverrides(qOverrides);
    if (err) return NextResponse.json({ error: `question_overrides 오류: ${err}` }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    const row = {
      id: `mem_${Date.now()}`,
      title, form_id: form_id || null,
      start_at: start_at || null, end_at: end_at || null,
      report_delay_hours: Number(report_delay_hours) || 1,
      duplicate_check_type: duplicate_check_type || "none",
      end_message_preset: end_message_preset || "1",
      gas_webapp_url: gas_webapp_url || null,
      admin_email: admin_email || null,
      report_sent: false, report_sent_at: null, created_at: new Date().toISOString(),
      taxonomy_fields: taxFields,
      question_overrides: qOverrides,
    };
    mem.unshift(row);
    return NextResponse.json({ survey: row, warning: "Supabase 미설정 — 메모리에 저장됨 (재시작 시 유실)" });
  }

  const payload: Record<string, unknown> = {
    title, form_id: form_id || null,
    start_at: start_at ? new Date(start_at).toISOString() : null,
    end_at: end_at ? new Date(end_at).toISOString() : null,
    report_delay_hours: Number(report_delay_hours) || 1,
    duplicate_check_type: duplicate_check_type || "none",
    end_message_preset: end_message_preset || "1",
    gas_webapp_url: gas_webapp_url || null,
    admin_email: admin_email || null,
    report_sent: false,
    taxonomy_fields: taxFields,
    question_overrides: qOverrides,
  };
  let { data, error } = await supabase.from("surveys").insert(payload).select().single();
  // Fallback: 프로덕션 DB에 taxonomy_fields/question_overrides 컬럼이 아직 없을 때 (schema cache 오류) — 컬럼 없이 재시도
  if (error && (error.message.includes("taxonomy_fields") || error.message.includes("question_overrides"))) {
    const { taxonomy_fields: _omit, question_overrides: _omit2, ...fallbackPayload } = payload;
    const retry = await supabase.from("surveys").insert(fallbackPayload).select().single();
    if (retry.error) return NextResponse.json({ error: retry.error.message }, { status: 500 });
    return NextResponse.json({ survey: retry.data, warning: "taxonomy/overrides 컬럼 없음 — fallback 저장됨. Supabase에서 마이그레이션 필요." });
  }
  if (error && error.message.includes("question_overrides")) {
    const { question_overrides: _omit, ...fallbackPayload } = payload;
    const r2 = await supabase.from("surveys").insert(fallbackPayload).select().single();
    if (r2.error) return NextResponse.json({ error: r2.error.message }, { status: 500 });
    return NextResponse.json({ survey: r2.data, warning: "question_overrides 컬럼 없음 — fallback 저장됨." });
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ survey: data });
}
