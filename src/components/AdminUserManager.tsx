"use client";
import { useEffect, useState } from "react";

type User = { id: string; role: string; created_at: string };

export default function AdminUserManager() {
  const [users, setUsers] = useState<User[]>([]);
  const [limit, setLimit] = useState(5);
  const [loading, setLoading] = useState(true);
  const [newId, setNewId] = useState("");
  const [newPw, setNewPw] = useState("");
  const [msg, setMsg] = useState("");
  const [editPw, setEditPw] = useState<Record<string, string>>({});

  async function load() {
    setLoading(true);
    const r = await fetch("/api/admin/users");
    const j = await r.json();
    if (r.ok) {
      setUsers(j.users || []);
      setLimit(j.limit || 5);
    } else setMsg(j.error || "조회 실패");
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function create() {
    setMsg("");
    const r = await fetch("/api/admin/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: newId, password: newPw }) });
    const j = await r.json();
    if (!r.ok) setMsg(`오류: ${j.error}`);
    else { setMsg(`Supervisor ‘${newId}’ 생성됨`); setNewId(""); setNewPw(""); load(); }
  }
  async function reset(id: string) {
    const pw = editPw[id];
    if (!pw) { setMsg("새 비밀번호를 입력해 주세요."); return; }
    const r = await fetch("/api/admin/users", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, password: pw }) });
    const j = await r.json();
    if (!r.ok) setMsg(`오류: ${j.error}`);
    else { setMsg(`‘${id}’ 비밀번호 변경됨`); setEditPw({ ...editPw, [id]: "" }); load(); }
  }
  async function remove(id: string) {
    if (!confirm(`Supervisor ‘${id}’를 삭제할까요?`)) return;
    const r = await fetch(`/api/admin/users?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    const j = await r.json();
    if (!r.ok) setMsg(`오류: ${j.error}`);
    else { setMsg(`‘${id}’ 삭제됨`); load(); }
  }

  return (
    <div className="mt-6 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 bg-white dark:bg-zinc-900">
      <h3 className="font-semibold text-zinc-900 dark:text-white">👥 Supervisor 계정 관리 <span className="text-xs font-normal text-zinc-500">(Administrator 전용)</span></h3>
      <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">Supervisor는 1명만 고정이 아니라 <b>최대 {limit}명까지</b> 생성할 수 있습니다 (env <code className="bg-zinc-100 dark:bg-zinc-800 px-1 rounded">SUPERVISOR_LIMIT</code>로 제한 변경). Administrator가 비밀번호를 바꾸거나 리셋할 수 있습니다.</p>

      {loading ? <p className="text-sm text-zinc-500 mt-3">로딩 중…</p> : (
        <div className="mt-4 space-y-3">
          {users.map(u => (
            <div key={u.id} className="border dark:border-zinc-800 rounded-xl p-3 flex flex-wrap gap-3 items-center bg-zinc-50 dark:bg-zinc-800">
              <div className="min-w-[140px]">
                <p className="text-sm font-medium text-zinc-900 dark:text-white">{u.id} <span className="text-xs text-zinc-500">({u.role})</span></p>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">{new Date(u.created_at).toLocaleString("ko-KR")}</p>
              </div>
              <input value={editPw[u.id] || ""} onChange={e=>setEditPw({ ...editPw, [u.id]: e.target.value })} placeholder="새 비밀번호" type="password" className="flex-1 min-w-[140px] border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white" />
              <button onClick={()=>reset(u.id)} className="text-xs border dark:border-zinc-700 rounded-full px-3 py-1.5 bg-white dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200">비밀번호 변경/리셋</button>
              <button onClick={()=>remove(u.id)} className="text-xs border border-red-200 dark:border-red-800 rounded-full px-3 py-1.5 bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 hover:bg-red-100">삭제</button>
            </div>
          ))}
          {users.length === 0 && <p className="text-sm text-zinc-500">등록된 Supervisor가 없습니다.</p>}
        </div>
      )}

      <div className="mt-5 border-t dark:border-zinc-800 pt-4">
        <p className="text-sm font-medium text-zinc-900 dark:text-white">새 Supervisor 추가</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <input value={newId} onChange={e=>setNewId(e.target.value)} placeholder="ID (예: supervisor2)" className="flex-1 min-w-[120px] border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder:text-zinc-400" />
          <input value={newPw} onChange={e=>setNewPw(e.target.value)} placeholder="비밀번호 (4자 이상)" type="password" className="flex-1 min-w-[120px] border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white" />
          <button onClick={create} disabled={users.length >= limit} className="rounded-full bg-black dark:bg-white dark:text-black text-white px-5 py-2 text-sm font-medium disabled:opacity-40">추가 ({users.length}/{limit})</button>
        </div>
        {users.length >= limit && <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">인원 제한({limit}명)에 도달했습니다. .env의 SUPERVISOR_LIMIT를 늘리면 더 추가할 수 있습니다.</p>}
      </div>
      {msg && <p className="mt-3 text-xs text-zinc-700 dark:text-zinc-300 bg-zinc-50 dark:bg-zinc-800 border dark:border-zinc-700 rounded-lg px-3 py-2">{msg}</p>}
    </div>
  );
}
