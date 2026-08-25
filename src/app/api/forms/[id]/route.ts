import { NextRequest, NextResponse } from "next/server";
import { parseGoogleFormResponse, mockForm } from "@/lib/forms";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
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
    const url = `https://forms.googleapis.com/v1/forms/${id}`;
    const token = await (client as unknown as { getAccessToken: () => Promise<{ token?: string }> }).getAccessToken();
    const accessToken = (token as unknown as string) || (token as { token?: string })?.token;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!res.ok) {
      const t = await res.text();
      // fallback to mock with error detail
      const form = mockForm(id);
      return NextResponse.json({ form, warning: `Forms API 오류 ${res.status}: ${t} — 목업으로 대체. krids 서비스계정 이메일을 Form에 뷰어로 공유했는지 확인하세요.`, error: t });
    }
    const json = await res.json();
    const parsed = parseGoogleFormResponse(id, json);
    const warning = parsed.unsupported.length > 0 ? `지원되지 않는 문항 유형이 포함되어 있습니다: ${parsed.unsupported.map(u=>`${u.title}(${u.rawType})`).join(", ")}` : undefined;
    return NextResponse.json({ form: parsed, raw: json, warning });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    const form = mockForm(id);
    return NextResponse.json({ form, warning: `파싱 오류: ${msg} — 목업 반환`, error: msg });
  }
}
