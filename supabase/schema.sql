-- FlowBill / ordering_system — Supabase schema（レガシー・段階適用用）
-- 新規環境: supabase/schema-full.sql を1回実行してください（推奨）
-- 既存環境: このファイル適用済みなら add-*.sql / patch-*.sql のみ追加適用

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- 会社（会社設定・帳票ヘッダー）
-- ---------------------------------------------------------------------------
create table if not exists public.companies (
  id text primary key,
  company_name text not null default '',
  postal_code text not null default '',
  address text not null default '',
  phone text not null default '',
  fax text not null default '',
  contact_name text not null default '',
  email text not null default '',
  invoice_number text not null default '',
  bank_name text not null default '',
  bank_branch text not null default '',
  bank_account_type text not null default '',
  bank_account_number text not null default '',
  bank_account_holder text not null default '',
  logo_url text,
  stamp_url text,
  signature_url text,
  quote_validity_days smallint not null default 14,
  quote_memo_template text not null default '',
  invoice_memo_template text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 顧客
-- ---------------------------------------------------------------------------
create table if not exists public.customers (
  id text primary key,
  company_id text not null references public.companies (id) on delete cascade,
  customer_name text not null,
  contact_name text not null default '',
  email text not null default '',
  phone text not null default '',
  postal_code text not null default '',
  address text not null default '',
  invoice_destination text not null default '',
  memo text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists customers_company_id_idx on public.customers (company_id);

-- ---------------------------------------------------------------------------
-- 請求項目テンプレ
-- ---------------------------------------------------------------------------
create table if not exists public.item_templates (
  id text primary key,
  company_id text not null references public.companies (id) on delete cascade,
  name text not null,
  category text not null default 'その他',
  description text not null default '',
  unit_price numeric not null default 0,
  tax_rate smallint not null default 10,
  is_favorite boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists item_templates_company_id_idx on public.item_templates (company_id);

-- ---------------------------------------------------------------------------
-- 案件
-- ---------------------------------------------------------------------------
create table if not exists public.projects (
  id text primary key,
  company_id text not null references public.companies (id) on delete cascade,
  customer_id text not null references public.customers (id) on delete restrict,
  project_name text not null,
  status text not null,
  amount numeric not null default 0,
  due_date date,
  start_date date,
  end_date date,
  assignee_name text not null default '',
  memo text not null default '',
  invoice_status text not null default 'not_created',
  payment_status text not null default 'unpaid',
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists projects_company_id_idx on public.projects (company_id);
create index if not exists projects_customer_id_idx on public.projects (customer_id);

-- ---------------------------------------------------------------------------
-- 案件履歴
-- ---------------------------------------------------------------------------
create table if not exists public.project_histories (
  id text primary key,
  company_id text not null references public.companies (id) on delete cascade,
  project_id text not null references public.projects (id) on delete cascade,
  type text not null,
  title text not null,
  description text,
  created_at timestamptz not null default now()
);

create index if not exists project_histories_project_id_idx on public.project_histories (project_id);

-- ---------------------------------------------------------------------------
-- 案件明細
-- ---------------------------------------------------------------------------
create table if not exists public.project_items (
  id text primary key,
  company_id text not null references public.companies (id) on delete cascade,
  project_id text not null references public.projects (id) on delete cascade,
  item_template_id text,
  name text not null,
  description text not null default '',
  quantity numeric not null default 1,
  unit text not null default '式',
  unit_price numeric not null default 0,
  tax_rate numeric not null default 0.1,
  amount numeric not null default 0,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists project_items_project_id_idx on public.project_items (project_id);
create index if not exists project_items_company_id_idx on public.project_items (company_id);

-- ---------------------------------------------------------------------------
-- 見積
-- ---------------------------------------------------------------------------
create table if not exists public.quotes (
  id text primary key,
  company_id text not null references public.companies (id) on delete cascade,
  project_id text not null references public.projects (id) on delete cascade,
  customer_id text not null references public.customers (id) on delete restrict,
  quote_number text not null,
  issue_date date not null,
  expiry_date date not null,
  status text not null default 'draft',
  subtotal numeric not null default 0,
  tax_amount numeric not null default 0,
  total_amount numeric not null default 0,
  memo text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists quotes_company_id_idx on public.quotes (company_id);
create index if not exists quotes_project_id_idx on public.quotes (project_id);

-- ---------------------------------------------------------------------------
-- 見積明細
-- ---------------------------------------------------------------------------
create table if not exists public.quote_items (
  id text primary key,
  company_id text not null references public.companies (id) on delete cascade,
  quote_id text not null references public.quotes (id) on delete cascade,
  item_template_id text,
  name text not null,
  description text not null default '',
  quantity numeric not null default 1,
  unit text not null default '式',
  unit_price numeric not null default 0,
  tax_rate numeric not null default 0.1,
  amount numeric not null default 0,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists quote_items_quote_id_idx on public.quote_items (quote_id);

-- ---------------------------------------------------------------------------
-- 請求書
-- ---------------------------------------------------------------------------
create table if not exists public.invoices (
  id text primary key,
  company_id text not null references public.companies (id) on delete cascade,
  project_id text not null references public.projects (id) on delete cascade,
  customer_id text not null references public.customers (id) on delete restrict,
  quote_id text not null default '',
  invoice_number text not null,
  issue_date date not null,
  due_date date not null,
  status text not null default 'draft',
  subtotal numeric not null default 0,
  tax_amount numeric not null default 0,
  total_amount numeric not null default 0,
  pdf_url text,
  memo text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists invoices_company_id_idx on public.invoices (company_id);
create index if not exists invoices_project_id_idx on public.invoices (project_id);

-- ---------------------------------------------------------------------------
-- 請求明細
-- ---------------------------------------------------------------------------
create table if not exists public.invoice_items (
  id text primary key,
  company_id text not null references public.companies (id) on delete cascade,
  invoice_id text not null references public.invoices (id) on delete cascade,
  quote_item_id text,
  name text not null,
  description text not null default '',
  quantity numeric not null default 1,
  unit text not null default '式',
  unit_price numeric not null default 0,
  tax_rate numeric not null default 0.1,
  amount numeric not null default 0,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists invoice_items_invoice_id_idx on public.invoice_items (invoice_id);

-- ---------------------------------------------------------------------------
-- 定期請求
-- ---------------------------------------------------------------------------
create table if not exists public.recurring_billings (
  id text primary key,
  company_id text not null references public.companies (id) on delete cascade,
  customer_id text not null references public.customers (id) on delete restrict,
  title text not null,
  billing_day smallint not null default 25,
  next_billing_date date not null,
  status text not null default 'active',
  subtotal numeric not null default 0,
  tax_amount numeric not null default 0,
  total_amount numeric not null default 0,
  memo text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists recurring_billings_company_id_idx on public.recurring_billings (company_id);

-- ---------------------------------------------------------------------------
-- 定期請求明細
-- ---------------------------------------------------------------------------
create table if not exists public.recurring_billing_items (
  id text primary key,
  company_id text not null references public.companies (id) on delete cascade,
  recurring_billing_id text not null references public.recurring_billings (id) on delete cascade,
  item_template_id text,
  name text not null,
  description text not null default '',
  quantity numeric not null default 1,
  unit_price numeric not null default 0,
  tax_rate numeric not null default 0.1,
  amount numeric not null default 0,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists recurring_billing_items_recurring_id_idx
  on public.recurring_billing_items (recurring_billing_id);

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

-- ---------------------------------------------------------------------------
-- RLS（ログインユーザーの company_id のみ）
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.companies enable row level security;
alter table public.customers enable row level security;
alter table public.item_templates enable row level security;
alter table public.projects enable row level security;
alter table public.project_histories enable row level security;
alter table public.project_items enable row level security;
alter table public.quotes enable row level security;
alter table public.quote_items enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_items enable row level security;
alter table public.recurring_billings enable row level security;
alter table public.recurring_billing_items enable row level security;

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

create policy companies_select_own on public.companies
  for select using (id = public.current_company_id());

create policy companies_update_own on public.companies
  for update using (id = public.current_company_id());

create policy companies_insert_onboarding on public.companies
  for insert to authenticated
  with check (
    not exists (select 1 from public.profiles p where p.user_id = auth.uid())
  );

do $$
declare
  t text;
begin
  foreach t in array array[
    'customers', 'item_templates', 'projects', 'project_histories', 'project_items',
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

-- 初回ログイン: company + profile 作成（RLS bypass）
create or replace function public.ensure_user_profile(p_email text default '')
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company_id text;
  v_profile_id text;
  v_company_name text;
  v_suffix text;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  select company_id
  into v_company_id
  from public.profiles
  where user_id = auth.uid()
  limit 1;

  if found then
    return v_company_id;
  end if;

  v_suffix := substr(md5(random()::text), 1, 4);
  v_company_id := 'co_' || to_char(floor(extract(epoch from clock_timestamp()) * 1000), 'FM9999999999990') || v_suffix;
  v_profile_id := 'prof_' || to_char(floor(extract(epoch from clock_timestamp()) * 1000), 'FM9999999999990') || v_suffix;

  if coalesce(p_email, '') <> '' then
    v_company_name := split_part(p_email, '@', 1) || 'の会社';
  else
    v_company_name := 'マイ会社';
  end if;

  insert into public.companies (
    id,
    company_name,
    email,
    postal_code,
    address,
    phone,
    invoice_number,
    bank_name,
    bank_branch,
    bank_account_type,
    bank_account_number,
    bank_account_holder
  ) values (
    v_company_id,
    v_company_name,
    coalesce(p_email, ''),
    '', '', '', '',
    '', '', '', '', ''
  );

  insert into public.profiles (id, user_id, company_id, email)
  values (v_profile_id, auth.uid(), v_company_id, coalesce(p_email, ''));

  return v_company_id;
end;
$$;

revoke all on function public.ensure_user_profile(text) from public;
grant execute on function public.ensure_user_profile(text) to authenticated;
