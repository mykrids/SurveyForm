"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { LANDING_DATA } from "@/lib/constants";

const TEMPLATE_SURVEY_MAP: Record<string, string> = {
  t1: "790f4713-0894-49a4-8e93-297f8f68a614",
  t2: "6440c1c4-ab8c-42f0-a8c3-1ad731565d6f",
  t3: "983d0315-4c2c-48cc-81b6-c7da291ed20a",
  t4: "afb5c989-95c4-4a8b-9846-e63be0d27b09",
  t5: "e6524f44-b0c7-4897-83c0-d934c5ed5e2a",
  t6: "18bcc7b5-e1b7-4915-a9a8-ca3711af895f",
};

export default function Landing() {
  const { hero, features, templates, pricing } = LANDING_DATA;
  const [demoGuide, setDemoGuide] = useState(false);
  const [startGuide, setStartGuide] = useState(false);
  const [dynamicTemplates, setDynamicTemplates] = useState<{ id: string; title: string; category: string; color: string }[]>([]);
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    fetch("/api/landing/templates").then(r=>r.json()).then(j=>{
      if (j.templates) setDynamicTemplates(j.templates);
    }).catch(()=>{});
  }, []);

  function handleDemoClick(e: React.MouseEvent) {
    e.preventDefault();
    setDemoGuide(true);
  }
  function handleStartClick(e: React.MouseEvent) {
    e.preventDefault();
    setStartGuide(true);
  }
  function goTemplates() {
    setDemoGuide(false);
    document.getElementById("templates")?.scrollIntoView({ behavior: "smooth" });
  }
  function goContact() {
    setStartGuide(false);
    document.getElementById("contact")?.scrollIntoView({ behavior: "smooth" });
  }

  return (
    <div className="min-h-screen bg-background text-zinc-900 dark:text-zinc-100">
      <header className="sticky top-0 z-20 bg-white/80 dark:bg-zinc-950/80 backdrop-blur border-b dark:border-zinc-800">
        <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
          <span className="font-bold text-lg tracking-tight dark:text-white">SurveyForm</span>
          <nav className="hidden md:flex gap-6 text-sm text-zinc-600 dark:text-zinc-400">
            <a href="#features" className="hover:text-zinc-900 dark:hover:text-white">기능</a><a href="#templates" className="hover:text-zinc-900 dark:hover:text-white">템플릿</a><a href="#pricing" className="hover:text-zinc-900 dark:hover:text-white">요금제</a><a href="#contact" className="hover:text-zinc-900 dark:hover:text-white">문의</a>
          </nav>
          <Link href="/admin" className="rounded-full bg-black dark:bg-white dark:text-black text-white px-5 py-2 text-sm">관리자 패널</Link>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="max-w-3xl">
          <span className="inline-block text-xs font-semibold tracking-widest bg-zinc-900 dark:bg-white dark:text-black text-white px-3 py-1 rounded-full mb-4">{hero.badge}</span>
          <h1 className="text-4xl md:text-5xl font-bold leading-tight dark:text-white" dangerouslySetInnerHTML={{ __html: hero.title }} />
          <p className="mt-4 text-zinc-600 dark:text-zinc-400 leading-relaxed">{hero.subtitle}</p>
          <div className="mt-8 flex gap-3">
            <button onClick={handleStartClick} className="rounded-full bg-black dark:bg-white dark:text-black text-white px-6 py-3 text-sm font-medium">{hero.ctaPrimary}</button>
            <button onClick={handleDemoClick} className="rounded-full border border-zinc-300 dark:border-zinc-700 dark:text-white px-6 py-3 text-sm font-medium">데모 설문 보기</button>
          </div>
          <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">Google Forms / GAS / Sheets 연동 · Resend 메일 · Supabase 메타 저장</p>
        </div>
      </section>

      <section id="features" className="mx-auto max-w-6xl px-6 py-12">
        <h2 className="text-2xl font-bold dark:text-white">주요 기능</h2>
        <div className="mt-6 grid md:grid-cols-3 gap-4">
          {features.map(f=>(
            <div key={f.title} className="border dark:border-zinc-800 rounded-2xl p-5 bg-white dark:bg-zinc-900">
              <div className="text-2xl">{f.icon}</div>
              <h3 className="font-semibold mt-2 dark:text-white">{f.title}</h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="templates" className="mx-auto max-w-6xl px-6 py-12">
        <h2 className="text-2xl font-bold dark:text-white">설문 템플릿</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">카드를 선택하면 해당 데모 설문으로 이동합니다 · 기본 6종 + 추가 최대 9종(총 15종)</p>
        <div className="mt-6 grid md:grid-cols-3 gap-4">
          {templates.map(t=>(
            <Link key={t.id} href={`/s/${TEMPLATE_SURVEY_MAP[t.id] || "demo"}`} className="border dark:border-zinc-800 rounded-2xl p-5 hover:shadow dark:hover:shadow-zinc-900 transition bg-white dark:bg-zinc-900">
              <div className={`h-2 w-10 rounded-full ${t.color} mb-3`} />
              <span className="text-xs bg-zinc-100 dark:bg-zinc-800 dark:text-zinc-300 px-2 py-1 rounded-full">{t.category}</span>
              <h3 className="font-semibold mt-2 dark:text-white">{t.title}</h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">데모 진행 가능</p>
            </Link>
          ))}
        </div>
        {dynamicTemplates.length > 0 && (
          <div className="mt-4">
            <button onClick={()=>setExpanded(!expanded)} className="w-full rounded-2xl border-2 border-dashed border-violet-200 dark:border-violet-800 bg-violet-50/50 dark:bg-violet-950/20 hover:bg-violet-50 dark:hover:bg-violet-950/40 px-6 py-4 text-sm font-medium text-violet-700 dark:text-violet-300 transition flex items-center justify-center gap-2">
              <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full bg-violet-600 text-white text-xs transition-transform ${expanded ? "rotate-45" : ""}`}>+</span>
              {expanded ? "접기" : `추가 템플릿 보기 (${dynamicTemplates.length}/9)`} <span className="text-xs font-normal text-violet-500 dark:text-violet-400">총 {6 + dynamicTemplates.length}종</span>
            </button>
            {expanded && (
              <div className="mt-4 grid md:grid-cols-3 gap-4 animate-in">
                {dynamicTemplates.map(t=>(
                  <Link key={t.id} href={`/s/${t.id}`} className="border border-violet-200 dark:border-violet-800 rounded-2xl p-5 hover:shadow transition bg-white dark:bg-zinc-900">
                    <div className={`h-2 w-10 rounded-full ${t.color} mb-3`} />
                    <span className="text-xs bg-violet-100 dark:bg-violet-900 text-violet-700 dark:text-violet-300 px-2 py-1 rounded-full">{t.category}</span>
                    <h3 className="font-semibold mt-2 dark:text-white">{t.title}</h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">실사용 사례 기반 · 데모 진행 가능</p>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      <section id="pricing" className="mx-auto max-w-6xl px-6 py-12">
        <h2 className="text-2xl font-bold dark:text-white">요금제</h2>
        <div className="mt-6 grid md:grid-cols-3 gap-4">
          {pricing.map(p=>(
            <div key={p.name} className={`border dark:border-zinc-800 rounded-2xl p-6 ${p.popular ? "border-black dark:border-white shadow-lg bg-white dark:bg-zinc-900" : "bg-white dark:bg-zinc-900"}`}>
              {p.popular && <span className="text-xs bg-black dark:bg-white dark:text-black text-white px-2 py-1 rounded-full">인기</span>}
              <h3 className="font-bold mt-2 dark:text-white">{p.name}</h3>
              <p className="text-2xl font-bold mt-2 dark:text-white">{p.price}<span className="text-sm font-normal text-zinc-500 dark:text-zinc-400">{p.period}</span></p>
              <ul className="mt-4 text-sm space-y-1 text-zinc-600 dark:text-zinc-400">{p.features.map(f=><li key={f}>• {f}</li>)}</ul>
              <button className={`mt-6 w-full rounded-full py-2 text-sm font-medium ${p.popular ? "bg-black dark:bg-white dark:text-black text-white" : "border dark:border-zinc-700 dark:text-white"}`}>{p.cta}</button>
            </div>
          ))}
        </div>
      </section>

      <section id="contact" className="mx-auto max-w-6xl px-6 py-12">
        <div className="border dark:border-zinc-800 rounded-2xl p-6 md:p-8 bg-zinc-50 dark:bg-zinc-900">
          <h2 className="text-2xl font-bold dark:text-white">문의</h2>
          <ul className="mt-4 space-y-2 text-sm text-zinc-700 dark:text-zinc-300 list-disc list-inside leading-relaxed">
            <li>KRIDS는 (사)한국지역산업진흥학회입니다.</li>
            <li>원하시는 설문 내용을 워드프로세서로 만들고, 설문 기간을 정해 메일로 보내주시면 됩니다.</li>
            <li>그 이후는 아무것도 하지 않고 설문 기간이 종료될 때까지 기다리면 됩니다.</li>
            <li>설문이 종료되면 시각적인 그래프와 시트를 자동으로 담당자 메일로 발송해 드립니다.</li>
          </ul>
          <div className="mt-6 flex items-center justify-center md:justify-start gap-2 text-sm">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-600 dark:text-zinc-400"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
            <a href="mailto:krids.org@gmail.com" className="font-medium text-zinc-900 dark:text-white hover:underline">krids.org@gmail.com</a>
          </div>
        </div>
      </section>

      <footer className="border-t dark:border-zinc-800 mt-12 py-8 text-center text-xs text-zinc-500 dark:text-zinc-400">
        <p>개인정보 처리: 설문 응답은 Google Sheets에, 운영 정보는 Supabase에 저장되며 이메일 발송은 Resend를 통해 이루어집니다.</p>
        <p className="mt-3 flex items-center justify-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
          <a href="mailto:krids.org@gmail.com" className="hover:text-zinc-700 dark:hover:text-white hover:underline">krids.org@gmail.com</a>
          <span className="text-zinc-300 dark:text-zinc-600">|</span>
          <span>© 2026 SurveyForm — krids 스타일 커스텀 설문 SaaS</span>
        </p>
      </footer>

      {demoGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="max-w-md w-full bg-white dark:bg-zinc-900 rounded-2xl p-6 border dark:border-zinc-800">
            <h3 className="font-bold dark:text-white">데모 안내</h3>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed">아래 설문 템플릿으로 이동하고 그 중 하나를 선택해서 데모를 진행해 보세요. 데모는 결과에 대한 회신을 하지 않습니다.</p>
            <div className="mt-5 flex gap-2 justify-end">
              <button onClick={()=>setDemoGuide(false)} className="rounded-full border dark:border-zinc-700 px-5 py-2 text-sm dark:text-white">닫기</button>
              <button onClick={goTemplates} className="rounded-full bg-black dark:bg-white dark:text-black text-white px-5 py-2 text-sm">템플릿으로 이동</button>
            </div>
          </div>
        </div>
      )}
      {startGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="max-w-md w-full bg-white dark:bg-zinc-900 rounded-2xl p-6 border dark:border-zinc-800">
            <h3 className="font-bold dark:text-white">시작 안내</h3>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed">하단 문의로 이동하여 읽어보세요. 설문지와 설문 기간을 정해 이메일로 신청하세요. 설문 시작 30일 전에 신청합니다.</p>
            <div className="mt-5 flex gap-2 justify-end">
              <button onClick={()=>setStartGuide(false)} className="rounded-full border dark:border-zinc-700 px-5 py-2 text-sm dark:text-white">닫기</button>
              <button onClick={goContact} className="rounded-full bg-black dark:bg-white dark:text-black text-white px-5 py-2 text-sm">문의로 이동</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
