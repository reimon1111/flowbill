-- Activity Log（操作履歴）
-- 既存環境に手動適用してください（このファイルは実行しません）

-- ---------------------------------------------------------------------------
-- activity_logs テーブル
-- ---------------------------------------------------------------------------
create table if not exists public.activity_logs (
  id text primary key,
  company_id text not null references public.companies (id) on delete cascade,
  actor_user_id uuid references auth.users (id) on delete set null,
  action text not null,
  target_type text not null,
  target_id text not null default '',
  target_label text not null default '',
  description text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists activity_logs_company_created_idx
  on public.activity_logs (company_id, created_at desc);

create index if not exists activity_logs_target_idx
  on public.activity_logs (company_id, target_type, target_id, created_at desc);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.activity_logs enable row level security;

drop policy if exists activity_logs_select on public.activity_logs;
drop policy if exists activity_logs_insert on public.activity_logs;

create policy activity_logs_select on public.activity_logs
  for select using (
    company_id = public.current_company_id()
    and public.is_company_member(company_id)
  );

create policy activity_logs_insert on public.activity_logs
  for insert with check (
    company_id = public.current_company_id()
    and public.can_write_company_data(company_id)
    and actor_user_id = auth.uid()
  );

-- update / delete はポリシーを定義しない（デフォルト拒否）
