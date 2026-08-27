-- Supabase schema for customSaaS.md
create table if not exists surveys (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  form_id text,
  start_at timestamptz,
  end_at timestamptz,
  report_delay_hours int not null default 1 check (report_delay_hours between 1 and 24),
  duplicate_check_type text not null default 'none' check (duplicate_check_type in ('none','cookie','email','email_verified')),
  end_message_preset text not null default '1' check (end_message_preset in ('1','2','3','4','5','6','7','8','9','10')),
  gas_webapp_url text,
  admin_email text,
  report_sent boolean not null default false,
  report_sent_at timestamptz,
  taxonomy_fields jsonb not null default '[]'::jsonb,
  question_overrides jsonb not null default '{}'::jsonb,
  is_template boolean not null default false,
  template_category text,
  template_color text,
  template_order int,
  created_at timestamptz not null default now()
);

create table if not exists survey_responses_log (
  id uuid primary key default gen_random_uuid(),
  survey_id uuid not null references surveys(id) on delete cascade,
  respondent_identifier text not null,
  submitted_at timestamptz not null default now(),
  unique(survey_id, respondent_identifier)
);
create index if not exists idx_responses_survey on survey_responses_log(survey_id);

-- 관리자 계정 (Administrator가 Supervisor를 관리)
create table if not exists admin_users (
  id text primary key,
  password text not null,
  role text not null check (role in ('supervisor')),
  created_at timestamptz not null default now()
);
