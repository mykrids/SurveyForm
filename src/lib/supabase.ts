import { createClient } from "@supabase/supabase-js";

export function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

export function getSupabaseAnon() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return null;
  return createClient(url, anon);
}

export type SurveyRow = {
  id: string;
  title: string;
  start_at: string | null;
  end_at: string | null;
  report_delay_hours: number;
  duplicate_check_type: string;
  end_message_preset: string;
  gas_webapp_url: string | null;
  admin_email: string | null;
  report_sent: boolean;
  report_sent_at: string | null;
  form_id: string | null;
  is_template?: boolean;
  template_category?: string | null;
  template_color?: string | null;
  template_order?: number | null;
  taxonomy_fields?: unknown;
  question_overrides?: unknown;
  created_at?: string;
};
