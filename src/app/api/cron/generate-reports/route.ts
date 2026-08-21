import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { gasRead } from "@/lib/gas";
import { sendReportEmail } from "@/lib/email";
import { rateLimit, getClientIp } from "@/lib/rateLimit";
import { ReportDocument } from "@/lib/pdf";
import { renderToBuffer } from "@react-pdf/renderer";
import React from "react";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  // Cron Secret 보호
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const got = req.headers.get("authorization")?.replace("Bearer ", "") || req.headers.get("x-cron-secret") || new URL(req.url).searchParams.get("cron_secret");
    if (got !== cronSecret) return NextResponse.json({ error: "Unauthorized cron" }, { status: 401 });
  }

  const ip = getClientIp(req);
  const rl = rateLimit(`cron:${ip}`, 10, 60_000);
  if (!rl.ok) return NextResponse.json({ error: "rate limited" }, { status: 429 });

  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: "Supabase 미설정 — Cron 실행 불가. NEXT_PUBLIC_SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY 필요" }, { status: 500 });

  const now = new Date();
  // find surveys where end_at + delay <= now and report_sent = false
  const { data: surveys, error } = await supabase.from("surveys").select("*").eq("report_sent", false).not("end_at", "is", null).not("admin_email", "is", null);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const targets = (surveys || []).filter((s: Record<string, unknown>) => {
    const endAt = s.end_at ? new Date(s.end_at as string) : null;
    if (!endAt) return false;
    const delayH = Number(s.report_delay_hours) || 1;
    return new Date(endAt.getTime() + delayH * 3600 * 1000) <= now;
  });

  if (targets.length === 0) return NextResponse.json({ ok: true, message: "대상 없음", checked: surveys?.length || 0 });

  const results: unknown[] = [];
  for (const s of targets as Record<string, unknown>[]) {
    const gasUrl = (s.gas_webapp_url as string) || process.env.GAS_WEBAPP_URL || "";
    if (!gasUrl) {
      results.push({ id: s.id, error: "GAS_WEBAPP_URL missing" });
      continue;
    }
    try {
      const sheetData = await gasRead(gasUrl) as { rows?: Record<string, string>[]; values?: unknown[][]; data?: Record<string, string>[] } | Record<string, string>[];
      // normalize: GAS may return { rows: [...] } or array
      let rows: Record<string, string>[] = [];
      if (Array.isArray(sheetData)) rows = sheetData as Record<string, string>[];
      else if ((sheetData as { rows?: Record<string, string>[] }).rows) rows = (sheetData as { rows: Record<string, string>[] }).rows;
      else if ((sheetData as { data?: Record<string, string>[] }).data) rows = (sheetData as { data: Record<string, string>[] }).data!;
      else if ((sheetData as { values?: unknown[][] }).values) {
        const vals = (sheetData as { values: unknown[][] }).values;
        if (vals.length > 1) {
          const headers = vals[0] as string[];
          rows = vals.slice(1).map(r => Object.fromEntries(headers.map((h, i) => [h, String((r as unknown[])[i] ?? "")])));
        }
      }

      const pdfBuffer = await (renderToBuffer as unknown as (el: React.ReactElement) => Promise<Buffer>)(React.createElement(ReportDocument, { surveyTitle: s.title as string, rows, generatedAt: now.toISOString() }));

      await sendReportEmail(s.admin_email as string, s.title as string, pdfBuffer as unknown as Buffer);

      await supabase.from("surveys").update({ report_sent: true, report_sent_at: now.toISOString() }).eq("id", s.id);
      results.push({ id: s.id, title: s.title, rows: rows.length, sentTo: s.admin_email, ok: true });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      results.push({ id: s.id, error: msg });
    }
  }

  return NextResponse.json({ ok: true, processed: results.length, results });
}
