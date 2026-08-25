import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { END_MESSAGE_PRESETS } from "@/lib/constants";
import { normalizeEmail } from "@/lib/duplicate";
import { gasWrite } from "@/lib/gas";
import { sendConfirmationEmail } from "@/lib/email";
import { rateLimit, getClientIp } from "@/lib/rateLimit";
import { checkEmailTypo } from "@/lib/emailTypo";
import { validateTaxonomyValues, type TaxonomyField } from "@/lib/taxonomy";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rl = rateLimit(`submit:${ip}`, 20, 60_000);
  if (!rl.ok) return NextResponse.json({ error: "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요." }, { status: 429 });

  const body = await req.json();
  const { surveyId, email, answers, taxonomy } = body as { surveyId: string; email?: string; answers: Record<string, string | string[]>; taxonomy?: Record<string, string> };
  if (!surveyId || !answers) return NextResponse.json({ error: "surveyId, answers required" }, { status: 400 });
  const taxonomyValues = taxonomy || {};

  // 이메일 오타 사전 차단 ( @ 누락, never.com→naver.com 등 )
  if (email) {
    const typo = checkEmailTypo(email);
    if (!typo.ok) return NextResponse.json({ error: typo.reason, suggestion: typo.suggestion }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  let survey: Record<string, unknown> | null = null;

  if (supabase) {
    const { data, error } = await supabase.from("surveys").select("*").eq("id", surveyId).single();
    if (error || !data) {
      // try mem fallback
      const mem = (globalThis as unknown as { __memSurveys?: Record<string, unknown>[] }).__memSurveys || [];
      survey = mem.find(s => (s as Record<string, string>).id === surveyId) as Record<string, unknown> | undefined || null;
      if (!survey) return NextResponse.json({ error: `설문을 찾을 수 없습니다: ${error?.message}` }, { status: 404 });
    } else survey = data as Record<string, unknown>;
  } else {
    const mem = (globalThis as unknown as { __memSurveys?: Record<string, unknown>[] }).__memSurveys || [];
    survey = mem.find(s => (s as Record<string, string>).id === surveyId) as Record<string, unknown> | undefined || null;
    // demo fallback if no mem
    if (!survey) {
      survey = {
        id: surveyId, title: `데모 설문 ${surveyId}`, start_at: null, end_at: null,
        duplicate_check_type: "none", end_message_preset: "1", gas_webapp_url: process.env.GAS_WEBAPP_URL || null, admin_email: null
      };
    }
  }

  // 1) 기간 검증
  const now = new Date();
  const startAt = survey.start_at ? new Date(survey.start_at as string) : null;
  const endAt = survey.end_at ? new Date(survey.end_at as string) : null;
  if (startAt && now < startAt) return NextResponse.json({ error: `설문 시작 전입니다. 시작: ${startAt.toISOString()}` }, { status: 403 });
  if (endAt && now > endAt) return NextResponse.json({ error: `설문이 종료되었습니다. 종료: ${endAt.toISOString()}` }, { status: 403 });

  // 1-2) 분류 필드 검증 (유연)
  const taxonomyFields = (survey.taxonomy_fields as TaxonomyField[] | undefined) || [];
  const taxErr = validateTaxonomyValues(taxonomyFields, taxonomyValues);
  if (taxErr) return NextResponse.json({ error: taxErr }, { status: 400 });

  // 2) 중복 검증
  const dupType = (survey.duplicate_check_type as string) || "none";
  let identifier: string | null = null;
  if (dupType === "email" || dupType === "email_verified") {
    if (!email) return NextResponse.json({ error: "이메일 기반 중복방지 설정 — 이메일이 필요합니다." }, { status: 400 });
    identifier = normalizeEmail(email);
    if (supabase) {
      const { data } = await supabase.from("survey_responses_log").select("id").eq("survey_id", surveyId).eq("respondent_identifier", identifier).limit(1);
      if (data && data.length > 0) return NextResponse.json({ error: "이미 응답한 이메일입니다." }, { status: 409 });
    }
  } else if (dupType === "cookie") {
    const cookieHeader = req.headers.get("cookie") || "";
    // client also sets localStorage, but server checks cookie
    if (cookieHeader.includes(`survey_${surveyId}_submitted=1`)) {
      return NextResponse.json({ error: "이미 제출한 것으로 기록되어 있습니다. (쿠키 기반)" }, { status: 409 });
    }
    identifier = `cookie:${ip}`;
  }

  // 3) GAS write (Next.js → GAS, Secret 헤더) — demo는 시트 저장 없음 (UI 미리보기 전용)
  // taxonomy는 시트에 taxonomy_{key} 컬럼으로 flatten
  const isDemo = surveyId === "demo";
  const gasUrl = isDemo ? "" : ((survey.gas_webapp_url as string) || process.env.GAS_WEBAPP_URL || "");
  const taxonomyRow: Record<string, string> = {};
  for (const [k, v] of Object.entries(taxonomyValues)) taxonomyRow[`taxonomy_${k}`] = v;
  const payload = {
    surveyId, email: identifier || email || null,
    answers, taxonomy: taxonomyValues, submittedAt: now.toISOString(),
    row: { _surveyId: surveyId, _email: identifier || email || "", _submittedAt: now.toISOString(), ...taxonomyRow, ...answers },
  };

  if (isDemo) {
    console.log("[submit] demo 모드 — GAS 시트 저장 스킵 (구글시트와 무관)");
  } else if (gasUrl) {
    try {
      await gasWrite(gasUrl, payload);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      // if GAS not configured correctly, still allow to proceed in demo mode but warn
      if (process.env.NODE_ENV === "production" && process.env.GAS_SHARED_SECRET) {
        return NextResponse.json({ error: `시트 저장 실패: ${msg}` }, { status: 502 });
      }
      console.warn("[submit] GAS write failed (demo mode allow):", msg);
    }
  } else {
    console.warn("[submit] GAS_WEBAPP_URL 미설정 — 시트 저장 스킵 (데모 모드)");
  }

  // 4) 중복 로그 기록 (Supabase) — demo는 기록 안 함
  if (!isDemo && supabase && identifier) {
    await supabase.from("survey_responses_log").insert({
      survey_id: surveyId, respondent_identifier: identifier, submitted_at: now.toISOString(),
    });
  }

  // 5) 즉시 확인 메일 (payload + preset 그대로 사용, 시트 재조회 없음) — demo는 메일도 스킵
  const presetId = (survey.end_message_preset as string) || "1";
  const preset = END_MESSAGE_PRESETS[presetId as keyof typeof END_MESSAGE_PRESETS] || END_MESSAGE_PRESETS["1"];
  if (!isDemo && email) {
    try {
      await sendConfirmationEmail(email, preset.label, preset.body, survey.title as string);
    } catch (e) {
      console.error("[submit] email failed", e);
      // don't fail submission on email error
    }
  } else if (isDemo) {
    console.log("[submit] demo 모드 — 확인 메일 스킵");
  }

  // 6) 완료 페이지용 preset 반환 + cookie set
  const res = NextResponse.json({ ok: true, presetLabel: preset.label, presetBody: preset.body });
  if (dupType === "cookie") {
    res.cookies.set(`survey_${surveyId}_submitted`, "1", { maxAge: 60 * 60 * 24 * 365, path: "/" });
  }
  return res;
}
