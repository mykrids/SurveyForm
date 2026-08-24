import { getSupabaseAdmin } from "./supabase";
import fs from "fs";
import path from "path";

export type ManagedUser = { id: string; password: string; role: "supervisor"; created_at: string };

// 환경변수 기본 1명
function envDefault(): ManagedUser[] {
  const supId = process.env.SUPERVISOR_ID || "supervisor";
  const supPw = process.env.SUPERVISOR_PASSWORD || "krids2026@supervisor";
  return [{ id: supId, password: supPw, role: "supervisor", created_at: new Date().toISOString() }];
}

// 파일 기반 fallback (로컬 개발용, Vercel에서는 /tmp 사용)
function filePath() {
  // Vercel은 /tmp만 쓰기 가능, 로컬은 프로젝트 루트/.data
  const tmp = process.env.VERCEL ? "/tmp/admin-users.json" : path.join(process.cwd(), ".data", "admin-users.json");
  return tmp;
}
function ensureDir() {
  try { fs.mkdirSync(path.dirname(filePath()), { recursive: true }); } catch {}
}
function readFileUsers(): ManagedUser[] | null {
  try {
    const p = filePath();
    if (!fs.existsSync(p)) return null;
    const raw = fs.readFileSync(p, "utf-8");
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) return arr as ManagedUser[];
    return null;
  } catch { return null; }
}
function writeFileUsers(users: ManagedUser[]) {
  try {
    ensureDir();
    fs.writeFileSync(filePath(), JSON.stringify(users, null, 2));
  } catch {}
}

// 메모리 fallback
const memKey = "__adminUsers" as const;
function getMem(): ManagedUser[] {
  const g = globalThis as unknown as Record<string, ManagedUser[] | undefined>;
  if (!g[memKey]) {
    const file = readFileUsers();
    g[memKey] = file || envDefault();
  }
  return g[memKey]!;
}
function setMem(users: ManagedUser[]) {
  (globalThis as unknown as Record<string, ManagedUser[]>)[memKey] = users;
  writeFileUsers(users);
}

export async function getSupervisors(): Promise<ManagedUser[]> {
  const supabase = getSupabaseAdmin();
  if (supabase) {
    const { data, error } = await supabase.from("admin_users").select("*").eq("role", "supervisor").order("created_at");
    if (!error && data) {
      // DB에 데이터가 있으면 DB 우선, 없으면 env 기본을 DB에 시드
      if (data.length === 0) {
        const defaults = envDefault();
        for (const u of defaults) {
          await supabase.from("admin_users").upsert({ id: u.id, password: u.password, role: u.role }).select();
        }
        return defaults;
      }
      return data.map(d => ({ id: d.id, password: d.password as string, role: "supervisor", created_at: d.created_at as string }));
    }
    // 테이블 없거나 에러 시 파일/메모리 fallback
  }
  return getMem();
}

export async function verifySupervisor(id: string, pw: string): Promise<boolean> {
  const users = await getSupervisors();
  const found = users.find(u => u.id === id);
  return !!found && found.password === pw;
}

export async function createSupervisor(id: string, pw: string): Promise<{ ok: boolean; error?: string }> {
  const limit = Number(process.env.SUPERVISOR_LIMIT || "5");
  const supabase = getSupabaseAdmin();
  const users = await getSupervisors();
  if (users.find(u => u.id === id)) return { ok: false, error: "이미 존재하는 ID입니다." };
  if (users.length >= limit) return { ok: false, error: `Supervisor는 최대 ${limit}명까지 생성할 수 있습니다.` };
  if (!id || !pw) return { ok: false, error: "ID와 비밀번호를 입력해 주세요." };
  if (pw.length < 4) return { ok: false, error: "비밀번호는 4자 이상이어야 합니다." };

  if (supabase) {
    const { error } = await supabase.from("admin_users").insert({ id, password: pw, role: "supervisor" });
    if (!error) return { ok: true };
    // 테이블 미생성 시 파일 fallback
    if (error.message.includes("Could not find the table") || error.message.includes("schema cache")) {
      const next = [...users, { id, password: pw, role: "supervisor" as const, created_at: new Date().toISOString() }];
      setMem(next);
      return { ok: true };
    }
    return { ok: false, error: error.message };
  } else {
    const next = [...users, { id, password: pw, role: "supervisor" as const, created_at: new Date().toISOString() }];
    setMem(next);
    return { ok: true };
  }
}

export async function updateSupervisorPassword(id: string, newPw: string): Promise<{ ok: boolean; error?: string }> {
  if (!newPw || newPw.length < 4) return { ok: false, error: "비밀번호는 4자 이상이어야 합니다." };
  const supabase = getSupabaseAdmin();
  if (supabase) {
    const { error } = await supabase.from("admin_users").update({ password: newPw }).eq("id", id).eq("role", "supervisor");
    if (!error) return { ok: true };
    if (error.message.includes("Could not find the table") || error.message.includes("schema cache")) {
      const users = getMem();
      const idx = users.findIndex(u => u.id === id);
      if (idx === -1) return { ok: false, error: "존재하지 않는 계정입니다." };
      const next = [...users];
      next[idx] = { ...next[idx], password: newPw };
      setMem(next);
      return { ok: true };
    }
    return { ok: false, error: error.message };
  } else {
    const users = getMem();
    const idx = users.findIndex(u => u.id === id);
    if (idx === -1) return { ok: false, error: "존재하지 않는 계정입니다." };
    const next = [...users];
    next[idx] = { ...next[idx], password: newPw };
    setMem(next);
    return { ok: true };
  }
}

export async function deleteSupervisor(id: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = getSupabaseAdmin();
  if (supabase) {
    const { error } = await supabase.from("admin_users").delete().eq("id", id).eq("role", "supervisor");
    if (!error) return { ok: true };
    if (error.message.includes("Could not find the table") || error.message.includes("schema cache")) {
      const users = getMem();
      const next = users.filter(u => u.id !== id);
      if (next.length === users.length) return { ok: false, error: "존재하지 않는 계정입니다." };
      if (next.length === 0) return { ok: false, error: "최소 1명의 Supervisor는 유지해야 합니다." };
      setMem(next);
      return { ok: true };
    }
    return { ok: false, error: error.message };
  } else {
    const users = getMem();
    const next = users.filter(u => u.id !== id);
    if (next.length === users.length) return { ok: false, error: "존재하지 않는 계정입니다." };
    if (next.length === 0) return { ok: false, error: "최소 1명의 Supervisor는 유지해야 합니다." };
    setMem(next);
    return { ok: true };
  }
}
