import { NextRequest, NextResponse } from "next/server";
import { verifyCredentials, signRole, COOKIE_NAME } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const id = String(body?.id || "").trim();
  const password = String(body?.password || "");
  if (!id || !password) return NextResponse.json({ error: "ID와 비밀번호를 입력해 주세요." }, { status: 400 });
  const role = verifyCredentials(id, password);
  if (!role) return NextResponse.json({ error: "ID 또는 비밀번호가 올바르지 않습니다." }, { status: 401 });
  const token = signRole(role);
  const res = NextResponse.json({ ok: true, role });
  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
    secure: process.env.NODE_ENV === "production",
  });
  return res;
}
