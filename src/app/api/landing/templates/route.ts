import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// 고정 6종은 하드코딩 유지, 동적은 is_template=true 중 고정 6 제외 + 9개 제한 (총 15)
const FIXED_IDS = new Set([
  "790f4713-0894-49a4-8e93-297f8f68a614",
  "6440c1c4-ab8c-42f0-a8c3-1ad731565d6f",
  "983d0315-4c2c-48cc-81b6-c7da291ed20a",
  "afb5c989-95c4-4a8b-9846-e63be0d27b09",
  "e6524f44-b0c7-4897-83c0-d934c5ed5e2a",
  "18bcc7b5-e1b7-4915-a9a8-ca3711af895f",
]);

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    if (!supabase) {
      const mem = (globalThis as unknown as { __memSurveys?: Record<string, unknown>[] }).__memSurveys || [];
      const dynamic = mem
        .filter((r) => (r as Record<string, unknown>).is_template && !FIXED_IDS.has(r.id as string))
        .slice(0, 9)
        .map((r) => ({
          id: (r as Record<string, unknown>).id as string,
          title: (r as Record<string, unknown>).title as string,
          category: ((r as Record<string, unknown>).template_category as string) || "Education",
          color: ((r as Record<string, unknown>).template_color as string) || "bg-violet-500",
        }));
      return NextResponse.json({ templates: dynamic, total: dynamic.length });
    }
    // 마이그레이션 여부 확인 — is_template 컬럼 없으면 빈 배열 반환으로 500 방지
    const probe = await supabase.from("surveys").select("is_template").limit(1);
    if (probe.error) {
      return NextResponse.json({ templates: [], total: 0, warning: "is_template 마이그레이션 전 — Supabase SQL Editor에서 supabase/schema.sql 적용 필요: " + probe.error.message });
    }
    const { data, error } = await supabase
      .from("surveys")
      .select("id,title,template_category,template_color,template_order,created_at")
      .eq("is_template", true)
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) return NextResponse.json({ templates: [], total: 0, warning: "조회 오류: " + error.message });
    const filtered = ((data as unknown as { id: string; title: string; template_category: string | null; template_color: string | null }[]) || []).filter((r) => !FIXED_IDS.has(r.id)).slice(0, 9);
    const templates = filtered.map((r) => ({
      id: r.id,
      title: r.title,
      category: r.template_category || "Education",
      color: r.template_color || "bg-violet-500",
    }));
    return NextResponse.json({ templates, total: templates.length });
  } catch (e: unknown) {
    return NextResponse.json({ templates: [], total: 0, warning: "오류: " + String(e) });
  }
}
