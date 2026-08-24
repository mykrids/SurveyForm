import { createHmac } from "crypto";

export type AdminRole = "administrator" | "supervisor";

export function getCredentials(): Record<string, { pw: string; role: AdminRole }> {
  // 환경변수에서 읽기, 없으면 기본값 (반드시 .env에서 변경 권장)
  const adminId = process.env.ADMIN_ID || "administrator";
  const adminPw = process.env.ADMIN_PASSWORD || "krids2026!";
  const supId = process.env.SUPERVISOR_ID || "supervisor";
  const supPw = process.env.SUPERVISOR_PASSWORD || "krids2026@supervisor";
  return {
    [adminId]: { pw: adminPw, role: "administrator" },
    [supId]: { pw: supPw, role: "supervisor" },
    // 하위 호환: 기존 단일 ADMIN_* 만 있을 경우도 허용 (레거시)
    ...(process.env.ADMIN_ID ? {} : { admin: { pw: adminPw, role: "administrator" as AdminRole } }),
  };
}

export function verifyCredentials(id: string, pw: string): AdminRole | null {
  const creds = getCredentials();
  const entry = creds[id];
  if (entry && entry.pw === pw) return entry.role;
  return null;
}

function getSecret(): string {
  return process.env.AUTH_SECRET || process.env.CRON_SECRET || process.env.GAS_SHARED_SECRET || "krids-auth-secret-change-me";
}

export function signRole(role: AdminRole): string {
  const ts = Date.now().toString();
  const payload = `${role}.${ts}`;
  const sig = createHmac("sha256", getSecret()).update(payload).digest("hex").slice(0, 16);
  // base64로 감싸기 (간단)
  return Buffer.from(`${payload}.${sig}`).toString("base64url");
}

export function verifyToken(token: string): AdminRole | null {
  try {
    const decoded = Buffer.from(token, "base64url").toString();
    const parts = decoded.split(".");
    if (parts.length !== 3) return null;
    const [role, ts, sig] = parts;
    if (role !== "administrator" && role !== "supervisor") return null;
    const payload = `${role}.${ts}`;
    const expected = createHmac("sha256", getSecret()).update(payload).digest("hex").slice(0, 16);
    if (sig !== expected) return null;
    // 만료 7일
    const age = Date.now() - Number(ts);
    if (isNaN(age) || age > 7 * 24 * 60 * 60 * 1000) return null;
    if (age < -60000) return null; // 미래 타임스탬프 방지
    return role as AdminRole;
  } catch {
    return null;
  }
}

export const COOKIE_NAME = "krids_admin_token";
