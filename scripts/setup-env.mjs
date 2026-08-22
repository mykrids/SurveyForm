#!/usr/bin/env node
// .env 단계별 채우기 도우미 — 보관 값을 붙여넣으면 .env에 안전하게 기록
// 사용: node scripts/setup-env.mjs
import fs from 'fs', readline from 'readline';
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const q = (msg) => new Promise(r => rl.question(msg, r));

function loadEnv() {
  const env = {};
  if (fs.existsSync('.env')) for (const line of fs.readFileSync('.env','utf8').split('\n')) {
    const m=line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/); if(m) env[m[1]]=m[2];
  }
  return env;
}
function saveEnv(env) {
  const order = ['NEXT_PUBLIC_SUPABASE_URL','NEXT_PUBLIC_SUPABASE_ANON_KEY','SUPABASE_SERVICE_ROLE_KEY','GOOGLE_SERVICE_ACCOUNT_JSON_PATH','RESEND_API_KEY','RESEND_FROM','GAS_SHARED_SECRET','GAS_WEBAPP_URL','CRON_SECRET'];
  const out = order.map(k=>`${k}=${env[k]||''}`).join('\n')+'\n';
  fs.writeFileSync('.env', out); console.log('\n✅ .env 저장됨');
}

console.log('=== .env 단계별 설정 도우미 ===');
console.log('빈 값은 Enter로 건너뜀, 기존 값은 그대로 유지\n');
const env = loadEnv();
console.log(`현재 GOOGLE_SERVICE_ACCOUNT_JSON_PATH=${env.GOOGLE_SERVICE_ACCOUNT_JSON_PATH||'(빈 값)'}`);

const steps = [
  { key:'GAS_WEBAPP_URL', msg:'2단계 GAS_WEBAPP_URL (https://script.google.com/macros/s/.../exec): ' },
  { key:'GAS_SHARED_SECRET', msg:'2단계 GAS_SHARED_SECRET (Script Properties SHARED_SECRET): ' },
  { key:'NEXT_PUBLIC_SUPABASE_URL', msg:'3단계 NEXT_PUBLIC_SUPABASE_URL (https://...supabase.co): ' },
  { key:'NEXT_PUBLIC_SUPABASE_ANON_KEY', msg:'3단계 NEXT_PUBLIC_SUPABASE_ANON_KEY: ' },
  { key:'SUPABASE_SERVICE_ROLE_KEY', msg:'3단계 SUPABASE_SERVICE_ROLE_KEY (service_role): ' },
  { key:'RESEND_API_KEY', msg:'4단계 RESEND_API_KEY (re_...): ' },
  { key:'CRON_SECRET', msg:'5단계 CRON_SECRET (랜덤 16자 이상, 비우면 자동생성): ' },
];
for (const s of steps) {
  const cur = env[s.key] || '';
  const v = await q(`${s.msg}${cur ? `[현재: ${cur.slice(0,18)}...] ` : ''}`);
  if (v.trim()) env[s.key] = v.trim();
  else if (s.key==='CRON_SECRET' && !cur) { const gen=Math.random().toString(36).slice(2,12)+Math.random().toString(36).slice(2,12); env[s.key]=gen; console.log(`  → 자동생성: ${gen}`); }
}
saveEnv(env);
console.log('\n다음: node scripts/verify-auth.mjs 로 검증');
rl.close();
