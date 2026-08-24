import { NextRequest, NextResponse } from "next/server";
import { verifyToken, COOKIE_NAME } from "@/lib/auth";
import { getSupervisors, createSupervisor, updateSupervisorPassword, deleteSupervisor } from "@/lib/adminUsers";

function requireAdmin(req: NextRequest): "administrator" | null {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  const role = token ? verifyToken(token) : null;
  if (role === "administrator") return role;
  return null;
}

export async function GET(req: NextRequest) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "Administrator 권한이 필요합니다." }, { status: 403 });
  const users = await getSupervisors();
  // 비밀번호는 노출하지 않고 마스킹
  const safe = users.map(u => ({ id: u.id, role: u.role, created_at: u.created_at }));
  return NextResponse.json({ users: safe, limit: Number(process.env.SUPERVISOR_LIMIT || "5") });
}

export async function POST(req: NextRequest) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "Administrator 권한이 필요합니다." }, { status: 403 });
  const body = await req.json().catch(() => null);
  const id = String(body?.id || "").trim();
  const password = String(body?.password || "");
  const res = await createSupervisor(id, password);
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}

export async function PUT(req: NextRequest) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "Administrator 권한이 필요합니다." }, { status: 403 });
  const body = await req.json().catch(() => null);
  const id = String(body?.id || "").trim();
  const password = String(body?.password || "");
  const res = await updateSupervisorPassword(id, password);
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "Administrator 권한이 필요합니다." }, { status: 403 });
  const { searchParams } = new URL(req.url);
  const id = String(searchParams.get("id") || "").trim();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const res = await deleteSupervisor(id);
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}
