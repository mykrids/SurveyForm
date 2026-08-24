"use client";
import Link from "next/link";
import { LANDING_DATA } from "@/lib/constants";

export default function Landing() {
  const { hero, features, templates, pricing } = LANDING_DATA;
  return (
    <div className="min-h-screen bg-white text-zinc-900">
      <header className="sticky top-0 z-20 bg-white/80 backdrop-blur border-b">
        <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
          <span className="font-bold text-lg tracking-tight">SurveyForm</span>
          <nav className="hidden md:flex gap-6 text-sm text-zinc-600">
            <a href="#features">기능</a><a href="#templates">템플릿</a><a href="#pricing">요금제</a><a href="#contact">문의</a>
          </nav>
          <Link href="/admin" className="rounded-full bg-black text-white px-5 py-2 text-sm">관리자 패널</Link>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="max-w-3xl">
          <span className="inline-block text-xs font-semibold tracking-widest bg-zinc-900 text-white px-3 py-1 rounded-full mb-4">{hero.badge}</span>
          <h1 className="text-4xl md:text-5xl font-bold leading-tight" dangerouslySetInnerHTML={{ __html: hero.title }} />
          <p className="mt-4 text-zinc-600 leading-relaxed">{hero.subtitle}</p>
          <div className="mt-8 flex gap-3">
            <Link href="/admin" className="rounded-full bg-black text-white px-6 py-3 text-sm font-medium">{hero.ctaPrimary}</Link>
            <Link href="/s/demo" className="rounded-full border px-6 py-3 text-sm font-medium">데모 설문 보기</Link>
          </div>
          <p className="mt-3 text-xs text-zinc-500">Google Forms / GAS / Sheets 연동 · Resend 메일 · Supabase 메타 저장</p>
        </div>
      </section>

      <section id="features" className="mx-auto max-w-6xl px-6 py-12">
        <h2 className="text-2xl font-bold">주요 기능</h2>
        <div className="mt-6 grid md:grid-cols-3 gap-4">
          {features.map(f=>(
            <div key={f.title} className="border rounded-2xl p-5 bg-white">
              <div className="text-2xl">{f.icon}</div>
              <h3 className="font-semibold mt-2">{f.title}</h3>
              <p className="text-sm text-zinc-600 mt-1 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="templates" className="mx-auto max-w-6xl px-6 py-12">
        <h2 className="text-2xl font-bold">설문 템플릿</h2>
        <p className="text-sm text-zinc-600 mt-1">선택 시 커스텀 응답 페이지로 이동 (/s/demo)</p>
        <div className="mt-6 grid md:grid-cols-3 gap-4">
          {templates.map(t=>(
            <Link key={t.id} href="/s/demo" className="border rounded-2xl p-5 hover:shadow transition">
              <div className={`h-2 w-10 rounded-full ${t.color} mb-3`} />
              <span className="text-xs bg-zinc-100 px-2 py-1 rounded-full">{t.category}</span>
              <h3 className="font-semibold mt-2">{t.title}</h3>
              <p className="text-xs text-zinc-500 mt-1">krids 스타일</p>
            </Link>
          ))}
        </div>
      </section>

      <section id="pricing" className="mx-auto max-w-6xl px-6 py-12">
        <h2 className="text-2xl font-bold">요금제</h2>
        <div className="mt-6 grid md:grid-cols-3 gap-4">
          {pricing.map(p=>(
            <div key={p.name} className={`border rounded-2xl p-6 ${p.popular ? "border-black shadow-lg" : "bg-white"}`}>
              {p.popular && <span className="text-xs bg-black text-white px-2 py-1 rounded-full">인기</span>}
              <h3 className="font-bold mt-2">{p.name}</h3>
              <p className="text-2xl font-bold mt-2">{p.price}<span className="text-sm font-normal text-zinc-500">{p.period}</span></p>
              <ul className="mt-4 text-sm space-y-1 text-zinc-600">{p.features.map(f=><li key={f}>• {f}</li>)}</ul>
              <button className={`mt-6 w-full rounded-full py-2 text-sm font-medium ${p.popular ? "bg-black text-white" : "border"}`}>{p.cta}</button>
            </div>
          ))}
        </div>
      </section>

      <section id="contact" className="mx-auto max-w-6xl px-6 py-12">
        <div className="border rounded-2xl p-6 md:p-8 bg-zinc-50">
          <h2 className="text-2xl font-bold">문의</h2>
          <ul className="mt-4 space-y-2 text-sm text-zinc-700 list-disc list-inside leading-relaxed">
            <li>KRIDS는 (사)한국지역산업진흥학회입니다.</li>
            <li>원하시는 설문 내용을 워드프로세서로 만들고, 설문 기간을 정해 메일로 보내주시면 됩니다.</li>
            <li>그 이후는 아무것도 하지 않고 설문 기간이 종료될 때까지 기다리면 됩니다.</li>
            <li>설문이 종료되면 시각적인 그래프와 시트를 자동으로 담당자 메일로 발송해 드립니다.</li>
          </ul>
          <div className="mt-6 flex items-center justify-center md:justify-start gap-2 text-sm">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-600"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
            <a href="mailto:krids.org@gmail.com" className="font-medium text-zinc-900 hover:underline">krids.org@gmail.com</a>
          </div>
        </div>
      </section>

      <footer className="border-t mt-12 py-8 text-center text-xs text-zinc-500">
        <p>개인정보 처리: 설문 응답은 Google Sheets에, 운영 정보는 Supabase에 저장되며 이메일 발송은 Resend를 통해 이루어집니다.</p>
        <p className="mt-3 flex items-center justify-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
          <a href="mailto:krids.org@gmail.com" className="hover:text-zinc-700 hover:underline">krids.org@gmail.com</a>
          <span className="text-zinc-300">|</span>
          <span>© 2026 SurveyForm — krids 스타일 커스텀 설문 SaaS</span>
        </p>
      </footer>
    </div>
  );
}
