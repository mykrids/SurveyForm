import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// 공개 조회: 설문 메타 (taxonomy_fields 포함) — 응답 페이지에서 사용
// 인증 없이 조회 가능해야 학생이 분류 필드를 렌더할 수 있음
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (id === "demo") {
    return NextResponse.json({ survey: { id: "demo", title: "데모 설문", taxonomy_fields: [] } });
  }
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    const mem = (globalThis as unknown as { __memSurveys?: Record<string, unknown>[] }).__memSurveys || [];
    const found = mem.find(s => (s as Record<string, string>).id === id);
    if (!found) return NextResponse.json({ error: "설문을 찾을 수 없습니다" }, { status: 404 });
    return NextResponse.json({ survey: found });
  }
  let { data, error } = await supabase.from("surveys").select("id,title,form_id,taxonomy_fields,question_overrides,start_at,end_at,duplicate_check_type").eq("id", id).single();
  if (error && (error.message.includes("taxonomy_fields") || error.message.includes("question_overrides"))) {
    const retry = await supabase.from("surveys").select("id,title,form_id,start_at,end_at,duplicate_check_type").eq("id", id).single();
    if (retry.error || !retry.data) return NextResponse.json({ error: `설문을 찾을 수 없습니다: ${retry.error?.message}` }, { status: 404 });
    return NextResponse.json({ survey: { ...retry.data, taxonomy_fields: [], question_overrides: {} } });
  }
  if (error || !data) return NextResponse.json({ error: `설문을 찾을 수 없습니다: ${error?.message}` }, { status: 404 });
  return NextResponse.json({ survey: data });
}
