-- STEP11: Supabase Auth + 会社別データ分離
-- 既存DBに適用する場合は schema.sql 実行後にこのファイルを実行してください

-- ---------------------------------------------------------------------------
-- profiles（auth.users ↔ companies）
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  company_id text not null references public.companies (id) on delete cascade,
  email text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_user_id_unique unique (user_id)
);

create index if not exists profiles_user_id_idx on public.profiles (user_id);
create index if not exists profiles_company_id_idx on public.profiles (company_id);

alter table public.profiles enable row level security;

-- ---------------------------------------------------------------------------
-- ログインユーザーの company_id を返す（RLS用）
-- ---------------------------------------------------------------------------
create or replace function public.current_company_id()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select company_id
  from public.profiles
  where user_id = auth.uid()
  limit 1;
$$;

-- ---------------------------------------------------------------------------
-- 開発用ポリシー削除
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'companies', 'customers', 'item_templates', 'projects', 'project_histories',
    'quotes', 'quote_items', 'invoices', 'invoice_items',
    'recurring_billings', 'recurring_billing_items', 'profiles'
  ]
  loop
    execute format('drop policy if exists dev_all on public.%I', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create policy profiles_select_own on public.profiles
  for select using (user_id = auth.uid());

create policy profiles_insert_own on public.profiles
  for insert with check (
    user_id = auth.uid()
    and not exists (
      select 1 from public.profiles p where p.user_id = auth.uid()
    )
  );

create policy profiles_update_own on public.profiles
  for update using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- companies
-- ---------------------------------------------------------------------------
create policy companies_select_own on public.companies
  for select using (id = public.current_company_id());

create policy companies_update_own on public.companies
  for update using (id = public.current_company_id());

-- 初回登録時のみ会社を作成可能
create policy companies_insert_onboarding on public.companies
  for insert to authenticated
  with check (
    not exists (select 1 from public.profiles p where p.user_id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- テナントテーブル共通（company_id で分離）
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'customers', 'item_templates', 'projects', 'project_histories',
    'quotes', 'quote_items', 'invoices', 'invoice_items',
    'recurring_billings', 'recurring_billing_items'
  ]
  loop
    execute format(
      'create policy %I_select on public.%I for select using (company_id = public.current_company_id())',
      t, t
    );
    execute format(
      'create policy %I_insert on public.%I for insert with check (company_id = public.current_company_id())',
      t, t
    );
    execute format(
      'create policy %I_update on public.%I for update using (company_id = public.current_company_id())',
      t, t
    );
    execute format(
      'create policy %I_delete on public.%I for delete using (company_id = public.current_company_id())',
      t, t
    );
  end loop;
end $$;
