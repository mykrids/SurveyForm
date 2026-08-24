"use client";
import { useEffect, useState } from "react";
import AdminPanel from "./AdminPanel";
import AdminUserManager from "./AdminUserManager";

type Role = "administrator" | "supervisor";

export default function AdminGate() {
  const [role, setRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);
  const [id, setId] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function check() {
    try {
      const r = await fetch("/api/admin/me");
      const j = await r.json();
      if (j.authenticated) setRole(j.role);
      else setRole(null);
    } catch {
      setRole(null);
    }
    setLoading(false);
  }
  useEffect(() => { check(); }, []);

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setSubmitting(true);
    const r = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, password: pw }),
    });
    const j = await r.json();
    if (!r.ok) setErr(j.error || "로그인 실패");
    else {
      setRole(j.role);
      setId("");
      setPw("");
    }
    setSubmitting(false);
  }

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    setRole(null);
  }

  if (loading) return <div className="mx-auto max-w-5xl px-6 py-16 text-center text-zinc-500">인증 확인 중…</div>;

  if (!role) {
    return (
      <div className="mx-auto max-w-md px-6 py-16">
        <div className="border dark:border-zinc-800 rounded-2xl p-6 bg-white dark:bg-zinc-900 shadow">
          <h1 className="text-xl font-bold text-zinc-900 dark:text-white">관리자 로그인</h1>
          <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">대시보드 접근 시 ID/비밀번호가 필요합니다. 다른 사람의 작동을 방지합니다.</p>
          <form onSubmit={login} className="mt-6 space-y-3">
            <label className="block text-sm font-medium text-zinc-900 dark:text-white">ID
              <input value={id} onChange={e=>setId(e.target.value)} required placeholder="administrator 또는 supervisor" className="mt-1 w-full border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-2 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder:text-zinc-400" />
            </label>
            <label className="block text-sm font-medium text-zinc-900 dark:text-white">비밀번호
              <input type="password" value={pw} onChange={e=>setPw(e.target.value)} required placeholder="••••••••" className="mt-1 w-full border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-2 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white" />
            </label>
            {err && <p className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">{err}</p>}
            <button type="submit" disabled={submitting} className="w-full rounded-full bg-black dark:bg-white dark:text-black text-white py-2.5 text-sm font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-50">
              {submitting ? "로그인 중…" : "로그인"}
            </button>
          </form>
          <div className="mt-6 border-t dark:border-zinc-800 pt-4 space-y-2 text-xs leading-relaxed">
            <p className="font-semibold text-zinc-900 dark:text-white">역할 안내</p>
            <p className="text-zinc-700 dark:text-zinc-300"><b className="text-zinc-900 dark:text-white">Administrator</b> — 모든 설정 변경 가능 (Supabase/Resend 키 등 시스템 설정 포함). 초기 ID <code className="bg-zinc-100 dark:bg-zinc-800 px-1 rounded">administrator</code> / PW <code className="bg-zinc-100 dark:bg-zinc-800 px-1 rounded">krids2026!</code> (반드시 .env에서 변경).</p>
            <p className="text-zinc-700 dark:text-zinc-300"><b className="text-zinc-900 dark:text-white">Supervisor</b> — 실무 작업용 (설문 생성·조회·보고서 확인). 초기 ID <code className="bg-zinc-100 dark:bg-zinc-800 px-1 rounded">supervisor</code> / PW <code className="bg-zinc-100 dark:bg-zinc-800 px-1 rounded">krids2026@supervisor</code> — 관리자는 Supervisor 계정으로 일상 작업을 하면 더 안전합니다.</p>
            <p className="text-zinc-500 dark:text-zinc-400 mt-2">구글 설문지 폼의 직접 수정(문항 편집)은 관리자 기능과 분리되어 있습니다 — 구글폼은 drive.google.com에서 편집하고, 관리자 대시보드에서는 Form ID만 연결합니다.</p>
          </div>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-500 mt-4">환경변수 <code className="bg-zinc-100 dark:bg-zinc-800 px-1 rounded">ADMIN_ID / ADMIN_PASSWORD / SUPERVISOR_ID / SUPERVISOR_PASSWORD</code> 로 변경 가능. 비어 있으면 위 기본값이 사용됩니다.</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mx-auto max-w-5xl px-6 pt-4 flex justify-between items-center text-xs">
        <span className={`px-2.5 py-1 rounded-full font-medium ${role === "administrator" ? "bg-zinc-900 dark:bg-white dark:text-black text-white" : "bg-blue-600 text-white"}`}>
          {role === "administrator" ? "Administrator 로그인됨" : "Supervisor 로그인됨"}
        </span>
        <button onClick={logout} className="border dark:border-zinc-700 rounded-full px-3 py-1 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800">로그아웃</button>
      </div>
      {role === "administrator" && (
        <div className="mx-auto max-w-5xl px-6">
          <AdminUserManager />
        </div>
      )}
      <AdminPanel role={role} />
    </div>
  );
}
