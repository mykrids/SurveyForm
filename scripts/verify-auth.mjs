#!/usr/bin/env node
// 단계별 인증 검증 스크립트 — .env 한 줄씩 채울 때마다 실행
// 사용: node scripts/verify-auth.mjs
import fs from 'fs';

function loadEnv() {
  const env = {};
  if (fs.existsSync('.env')) {
    for (const line of fs.readFileSync('.env','utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
      if (m) env[m[1]] = m[2].replace(/^["']|["']$/g,'');
    }
  }
  return env;
}

const env = loadEnv();
console.log('=== .env 현황 ===');
for (const k of ['NEXT_PUBLIC_SUPABASE_URL','NEXT_PUBLIC_SUPABASE_ANON_KEY','SUPABASE_SERVICE_ROLE_KEY','GOOGLE_SERVICE_ACCOUNT_JSON_PATH','RESEND_API_KEY','RESEND_FROM','GAS_SHARED_SECRET','GAS_WEBAPP_URL','CRON_SECRET']) {
  const v = env[k] || process.env[k] || '';
  console.log(`${k}: ${v ? `✅ 설정됨 (길이 ${v.length}, 앞 12자 ${v.slice(0,12)}...)` : '❌ 빈 값'}`);
}
console.log('');

let okCount = 0, failCount = 0;
async function test(name, fn) {
  process.stdout.write(`▶ ${name} ... `);
  try { const r = await fn(); console.log(r); okCount++; } catch(e) { console.log(`❌ ${e.message}`); failCount++; }
}

// 1) Google
await test('1단계 Google 서비스계정 토큰', async () => {
  const p = env.GOOGLE_SERVICE_ACCOUNT_JSON_PATH || env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!p) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON_PATH 미설정');
  let creds;
  if (p.trim().startsWith('{')) creds = JSON.parse(p);
  else creds = JSON.parse(fs.readFileSync(p,'utf8'));
  const { google } = await import('googleapis');
  const auth = new google.auth.GoogleAuth({ credentials: creds, scopes: ['https://www.googleapis.com/auth/forms.body.readonly'] });
  const client = await auth.getClient();
  const tok = await client.getAccessToken();
  const t = typeof tok === 'string' ? tok : tok?.token;
  if (!t) throw new Error('토큰 발급 실패');
  return `✅ 토큰 발급 성공 (길이 ${t.length})`;
});

// 2) GAS
await test('2단계 GAS WebApp', async () => {
  const url = env.GAS_WEBAPP_URL, secret = env.GAS_SHARED_SECRET;
  if (!url) throw new Error('GAS_WEBAPP_URL 빈 값 — Sheets 배포 후 .env에 넣으세요');
  if (!secret) throw new Error('GAS_SHARED_SECRET 빈 값');
  const res = await fetch(`${url}?action=read&secret=${encodeURIComponent(secret)}`, { method:'GET', headers:{ Authorization:`Bearer ${secret}` } });
  const text = await res.text();
  if (res.status === 401) throw new Error(`401 SECRET 불일치 — Script Properties와 .env가 다름: ${text.slice(0,200)}`);
  if (res.status === 403) throw new Error(`403 웹앱 권한 — 배포 시 "모든 사용자"로 설정했는지 확인: ${text.slice(0,200)}`);
  if (!res.ok) throw new Error(`${res.status} ${text.slice(0,300)}`);
  return `✅ ${res.status} 응답 (앞 100자: ${text.slice(0,100)}...)`;
});

// 3) Supabase
await test('3단계 Supabase 연결', async () => {
  const url = env.NEXT_PUBLIC_SUPABASE_URL, anon = env.NEXT_PUBLIC_SUPABASE_ANON_KEY, service = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anon || !service) throw new Error('Supabase 3키 중 빈 값 있음');
  const { createClient } = await import('@supabase/supabase-js');
  const admin = createClient(url, service, { auth:{ persistSession:false }});
  const { data, error } = await admin.from('surveys').select('id').limit(1);
  if (error) {
    if (error.message.includes('does not exist') || error.message.includes('relation')) throw new Error(`연결 성공, 테이블 없음 — supabase/schema.sql 실행 필요: ${error.message}`);
    throw new Error(error.message);
  }
  return `✅ 연결 성공 (surveys 조회 OK, ${data?.length ?? 0}행)`;
});

// 4) Resend
await test('4단계 Resend', async () => {
  const key = env.RESEND_API_KEY;
  if (!key) throw new Error('RESEND_API_KEY 빈 값');
  // 키 형식만 검증, 실제 발송은 하지 않음 (비용 방지)
  if (!key.startsWith('re_')) throw new Error(`키 형식 이상 — re_ 로 시작해야 함, 현재 ${key.slice(0,5)}...`);
  return `✅ 키 형식 정상 (길이 ${key.length}) — 실제 발송은 /api/submit 경유 테스트 필요`;
});

// 5) Vercel Cron
await test('5단계 CRON_SECRET', async () => {
  const c = env.CRON_SECRET;
  if (!c) throw new Error('CRON_SECRET 빈 값 — 랜덤 문자열 16자 이상 권장');
  if (c.length < 8) throw new Error(`너무 짧음 (${c.length}자) — 16자 이상 권장`);
  return `✅ 설정됨 (길이 ${c.length}) — /api/cron/generate-reports 에서 Bearer 검증`;
});

console.log(`\n=== 결과: 성공 ${okCount}/5, 실패 ${failCount}/5 ===`);
if (failCount) console.log('빈 값인 단계는 .env에 보관 값을 채운 뒤 다시 실행하세요: node scripts/verify-auth.mjs');
else console.log('모든 인증 연결됨! 다음: npm run build && npm run dev 로 실연동 테스트');
