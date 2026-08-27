import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { rateLimit, getClientIp } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

const RETENTION_DAYS = 30;
const DEMO_IDS = new Set([
  "790f4713-0894-49a4-8e93-297f8f68a614",
  "6440c1c4-ab8c-42f0-a8c3-1ad731565d6f",
  "983d0315-4c2c-48cc-81b6-c7da291ed20a",
  "afb5c989-95c4-4a8b-9846-e63be0d27b09",
  "e6524f44-b0c7-4897-83c0-d934c5ed5e2a",
  "18bcc7b5-e1b7-4915-a9a8-ca3711af895f",
]);

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const got =
      req.headers.get("authorization")?.replace("Bearer ", "") ||
      req.headers.get("x-cron-secret") ||
      new URL(req.url).searchParams.get("cron_secret");
    if (got !== cronSecret) return NextResponse.json({ error: "Unauthorized cron" }, { status: 401 });
  }

  const ip = getClientIp(req);
  const rl = rateLimit(`cron-cleanup:${ip}`, 10, 60_000);
  if (!rl.ok) return NextResponse.json({ error: "rate limited" }, { status: 429 });

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    // memory fallback
    const mem = (globalThis as unknown as { __memSurveys?: Record<string, unknown>[] }).__memSurveys || [];
    const now = new Date();
    const threshold = RETENTION_DAYS * 24 * 60 * 60 * 1000;
    const toDelete = mem.filter((r) => {
      if (DEMO_IDS.has(r.id as string)) return false;
      const endAt = r.end_at ? new Date(r.end_at as string) : null;
      return endAt && now.getTime() - endAt.getTime() > threshold;
    });
    for (const r of toDelete) {
      const idx = mem.findIndex((x) => x.id === r.id);
      if (idx !== -1) mem.splice(idx, 1);
    }
    return NextResponse.json({ ok: true, mode: "memory", deleted: toDelete.length, ids: toDelete.map((r) => r.id) });
  }

  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);

  // 종료 후 30일이 지난 설문 조회
  const { data: candidates, error } = await supabase
    .from("surveys")
    .select("id,title,end_at")
    .not("end_at", "is", null)
    .lt("end_at", cutoff.toISOString());

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // 데모템플릿 제외
  const filtered = (candidates || []).filter((c: { id: string }) => !DEMO_IDS.has(c.id));
  if (filtered.length === 0) {
    return NextResponse.json({ ok: true, deleted: 0, message: "정리 대상 없음 (종료 후 30일 경과 설문 없음, 데모 제외)" });
  }

  const ids = filtered.map((c: { id: string }) => c.id);
  const { error: delErr } = await supabase.from("surveys").delete().in("id", ids);
  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });

  // survey_responses_log는 FK cascade로 자동 삭제
  return NextResponse.json({
    ok: true,
    deleted: ids.length,
    deletedIds: ids,
    details: filtered.map((c: { id: string; title: string; end_at: string }) => ({ id: c.id, title: c.title, end_at: c.end_at })),
  });
}
