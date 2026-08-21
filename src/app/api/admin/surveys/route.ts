import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// in-memory fallback when Supabase not configured
const mem: Record<string, unknown>[] = (globalThis as unknown as { __memSurveys?: Record<string, unknown>[] }).__memSurveys || [];
(globalThis as unknown as { __memSurveys: Record<string, unknown>[] }).__memSurveys = mem;

export async function GET() {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ surveys: mem, warning: "Supabase 미설정 — 메모리 목업 반환" });
  }
  const { data, error } = await supabase.from("surveys").select("*").order("created_at", { ascending: false }).limit(50);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ surveys: data });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { title, form_id, start_at, end_at, report_delay_hours, duplicate_check_type, end_message_preset, gas_webapp_url, admin_email } = body;
  if (!title) return NextResponse.json({ error: "title required" }, { status: 400 });

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
    };
    mem.unshift(row);
    return NextResponse.json({ survey: row, warning: "Supabase 미설정 — 메모리에 저장됨 (재시작 시 유실)" });
  }

  const payload = {
    title, form_id: form_id || null,
    start_at: start_at ? new Date(start_at).toISOString() : null,
    end_at: end_at ? new Date(end_at).toISOString() : null,
    report_delay_hours: Number(report_delay_hours) || 1,
    duplicate_check_type: duplicate_check_type || "none",
    end_message_preset: end_message_preset || "1",
    gas_webapp_url: gas_webapp_url || null,
    admin_email: admin_email || null,
    report_sent: false,
  };
  const { data, error } = await supabase.from("surveys").insert(payload).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ survey: data });
}
