import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// GET /go/{surveyId}?{taxonomy_keys}=...
// 예: /go/{id}?prof_name=홍길동&dept=컴퓨터공학
// → survey.taxonomy_fields를 조회해 검증 후 /s/{id}?… 로 리다이렉트
// Google Form 네이티브 pre-filled가 필요하면: /go 경로에서 entry 매핑을 추가해 Google Form으로 리다이렉트하도록 확장 가능
// 현재는 커스텀 렌더러(/s) 기반으로 동작 — taxonomy 값을 쿼리로 전달해 SurveyRenderer에서 주입
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = getSupabaseAdmin();
  let taxonomy: { key: string }[] = [];
  if (id !== "demo") {
    if (supabase) {
      const { data } = await supabase.from("surveys").select("taxonomy_fields").eq("id", id).single();
      if (data?.taxonomy_fields) taxonomy = data.taxonomy_fields as { key: string }[];
    } else {
      const mem = (globalThis as unknown as { __memSurveys?: Record<string, unknown>[] }).__memSurveys || [];
      const found = mem.find(s => (s as Record<string, string>).id === id) as Record<string, unknown> | undefined;
      if (found?.taxonomy_fields) taxonomy = found.taxonomy_fields as { key: string }[];
    }
  }
  // 허용된 키만 전달 (오염 방지) — taxonomy가 비어있으면 모든 쿼리 그대로 전달
  const url = new URL(req.url);
  const pass = new URLSearchParams();
  if (taxonomy.length > 0) {
    for (const f of taxonomy) {
      const v = url.searchParams.get(f.key);
      if (v) pass.set(f.key, v);
    }
    // 이메일/기타 패스스루
    const email = url.searchParams.get("email");
    if (email) pass.set("email", email);
  } else {
    url.searchParams.forEach((v, k) => pass.set(k, v));
  }
  const qs = pass.toString();
  const dest = qs ? `/s/${id}?${qs}` : `/s/${id}`;
  return NextResponse.redirect(new URL(dest, req.url), 302);
}
