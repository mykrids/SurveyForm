import { Resend } from "resend";

export function getResend() {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  return new Resend(key);
}

export async function sendConfirmationEmail(to: string, presetLabel: string, presetBody: string, surveyTitle: string) {
  const resend = getResend();
  if (!resend) {
    console.warn("[email] RESEND_API_KEY missing, skip send to", to);
    return { skipped: true };
  }
  const from = process.env.RESEND_FROM || "SurveyForm <onboarding@resend.dev>";
  const { error } = await resend.emails.send({
    from,
    to,
    subject: `[${surveyTitle}] ${presetLabel}`,
    html: `<div style="font-family:sans-serif;max-width:600px;margin:auto;padding:24px">
      <h2>${presetLabel}</h2>
      <p>${presetBody}</p>
      <p style="color:#666;font-size:12px;margin-top:24px">이 메일은 설문 응답 확인용으로 자동 발송되었습니다. 저장소: Supabase(운영정보) / Google Sheets(응답내용) · 발송: Resend</p>
    </div>`,
  });
  if (error) throw error;
  return { skipped: false };
}

export async function sendReportEmail(to: string, surveyTitle: string, pdfBuffer: Buffer) {
  const resend = getResend();
  if (!resend) {
    console.warn("[email] RESEND_API_KEY missing, skip report to", to);
    return { skipped: true };
  }
  const from = process.env.RESEND_FROM || "SurveyForm <onboarding@resend.dev>";
  const { error } = await resend.emails.send({
    from,
    to,
    subject: `[리포트] ${surveyTitle} — 응답 집계 PDF`,
    html: `<p>${surveyTitle} 설문의 응답 집계 리포트입니다. 첨부 PDF를 확인해 주세요.</p>`,
    attachments: [{ filename: `${surveyTitle}-report.pdf`, content: pdfBuffer }],
  });
  if (error) throw error;
  return { skipped: false };
}
