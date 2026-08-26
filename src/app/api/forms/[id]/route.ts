import { NextRequest, NextResponse } from "next/server";
import { parseGoogleFormResponse, mockForm } from "@/lib/forms";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // id가 설문 UUID이면 surveys.form_id로 해석
  let formId = id;
  if (id !== "demo") {
    try {
      const supabase = getSupabaseAdmin();
      if (supabase) {
        const { data } = await supabase.from("surveys").select("form_id").eq("id", id).single();
        if (data?.form_id) formId = data.form_id;
        else if (data && !data.form_id) {
          const form = mockForm(id);
          return NextResponse.json({ form, warning: "해당 설문에 연결된 Google Form ID가 없습니다 — 목업으로 표시됩니다." });
        }
      } else {
        const mem = (globalThis as unknown as { __memSurveys?: Record<string, unknown>[] }).__memSurveys || [];
        const found = mem.find(s => (s as Record<string, string>).id === id) as Record<string, string> | undefined;
        if (found?.form_id) formId = found.form_id;
      }
    } catch { /* treat id as direct formId */ }
  }
  const serviceJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON_PATH || process.env.GOOGLE_SERVICE_ACCOUNT_JSON;

  // If no service account, return mock with warning
  if (!serviceJson) {
    const form = mockForm(id);
    return NextResponse.json({ form, warning: "GOOGLE_SERVICE_ACCOUNT_JSON 미설정 — 목업 폼 반환. customSaaS.md PART 2-1) 참고해 krids 서비스계정 발급 후 Form을 뷰어 공유하세요." });
  }

  try {
    let credentials: Record<string, string>;
    if (serviceJson.trim().startsWith("{")) {
      credentials = JSON.parse(serviceJson);
    } else {
      const fs = await import("fs");
      credentials = JSON.parse(fs.readFileSync(serviceJson, "utf-8"));
    }
    const { google } = await import("googleapis");
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/forms.body.readonly"],
    });
    const client = await auth.getClient();
    // Forms API v1
    const url = `https://forms.googleapis.com/v1/forms/${formId}`;
    const tokenRes = await (client as unknown as { getAccessToken: () => Promise<unknown> }).getAccessToken() as unknown;
    const accessToken = typeof tokenRes === "string" ? tokenRes : (tokenRes as { token?: string } | null)?.token || (tokenRes as string | null) as string | null;
    if (!accessToken) throw new Error("AccessToken 획득 실패");
    const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!res.ok) {
      const t = await res.text();
      // fallback to mock with error detail
      const form = mockForm(formId);
      return NextResponse.json({ form, warning: `Forms API 오류 ${res.status}: ${t} — 목업으로 대체. krids 서비스계정 이메일을 Form에 뷰어로 공유했는지 확인하세요.`, error: t });
    }
    const json = await res.json();
    const parsed = parseGoogleFormResponse(formId, json);
    const warning = parsed.unsupported.length > 0 ? `지원되지 않는 문항 유형이 포함되어 있습니다: ${parsed.unsupported.map(u=>`${u.title}(${u.rawType})`).join(", ")}` : undefined;
    // question_overrides는 /api/surveys/[id]에서 가져오므로 여기서는 raw만 반환, merge는 클라이언트에서 수행
    return NextResponse.json({ form: parsed, raw: json, warning });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    const form = mockForm(formId);
    return NextResponse.json({ form, warning: `파싱 오류: ${msg} — 목업 반환`, error: msg });
  }
}
