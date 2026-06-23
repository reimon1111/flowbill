-- STEP14: 書類管理強化（注文書・納品書・領収書・支払条件・複数口座）

-- 会社: デフォルト支払い条件・書類備考テンプレ
alter table companies
  add column if not exists payment_terms text not null default '請求書発行後14日以内';

alter table companies
  add column if not exists order_memo_template text not null default '';

alter table companies
  add column if not exists delivery_note_memo_template text not null default '';

alter table companies
  add column if not exists receipt_memo_template text not null default '';

-- 振込口座（複数）
create table if not exists public.bank_accounts (
  id text primary key,
  company_id text not null references public.companies (id) on delete cascade,
  label text not null default '',
  bank_name text not null default '',
  bank_branch text not null default '',
  bank_account_type text not null default '',
  bank_account_number text not null default '',
  bank_account_holder text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists bank_accounts_company_id_idx on public.bank_accounts (company_id);

-- 見積・請求: 支払い条件・請求書口座
alter table quotes
  add column if not exists payment_terms text not null default '';

alter table invoices
  add column if not exists payment_terms text not null default '',
  add column if not exists bank_account_id text references public.bank_accounts (id) on delete set null;

-- 注文書
create table if not exists public.orders (
  id text primary key,
  company_id text not null references public.companies (id) on delete cascade,
  project_id text not null references public.projects (id) on delete cascade,
  customer_id text not null references public.customers (id) on delete restrict,
  quote_id text not null default '',
  order_number text not null,
  issue_date date not null,
  payment_terms text not null default '',
  status text not null default 'issued',
  subtotal numeric not null default 0,
  tax_amount numeric not null default 0,
  total_amount numeric not null default 0,
  memo text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists orders_company_id_idx on public.orders (company_id);
create index if not exists orders_project_id_idx on public.orders (project_id);

create table if not exists public.order_items (
  id text primary key,
  company_id text not null references public.companies (id) on delete cascade,
  order_id text not null references public.orders (id) on delete cascade,
  item_template_id text,
  name text not null,
  description text not null default '',
  width text not null default '',
  height text not null default '',
  quantity numeric not null default 1,
  unit text not null default '式',
  unit_price numeric not null default 0,
  tax_rate numeric not null default 0.1,
  amount numeric not null default 0,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists order_items_order_id_idx on public.order_items (order_id);

-- 納品書
create table if not exists public.delivery_notes (
  id text primary key,
  company_id text not null references public.companies (id) on delete cascade,
  project_id text not null references public.projects (id) on delete cascade,
  customer_id text not null references public.customers (id) on delete restrict,
  order_id text not null default '',
  delivery_note_number text not null,
  issue_date date not null,
  payment_terms text not null default '',
  status text not null default 'issued',
  subtotal numeric not null default 0,
  tax_amount numeric not null default 0,
  total_amount numeric not null default 0,
  memo text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists delivery_notes_company_id_idx on public.delivery_notes (company_id);
create index if not exists delivery_notes_project_id_idx on public.delivery_notes (project_id);

create table if not exists public.delivery_note_items (
  id text primary key,
  company_id text not null references public.companies (id) on delete cascade,
  delivery_note_id text not null references public.delivery_notes (id) on delete cascade,
  item_template_id text,
  name text not null,
  description text not null default '',
  width text not null default '',
  height text not null default '',
  quantity numeric not null default 1,
  unit text not null default '式',
  unit_price numeric not null default 0,
  tax_rate numeric not null default 0.1,
  amount numeric not null default 0,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists delivery_note_items_delivery_note_id_idx on public.delivery_note_items (delivery_note_id);

-- 領収書
create table if not exists public.receipts (
  id text primary key,
  company_id text not null references public.companies (id) on delete cascade,
  project_id text not null references public.projects (id) on delete cascade,
  customer_id text not null references public.customers (id) on delete restrict,
  invoice_id text not null default '',
  receipt_number text not null,
  issue_date date not null,
  payment_terms text not null default '',
  status text not null default 'issued',
  subtotal numeric not null default 0,
  tax_amount numeric not null default 0,
  total_amount numeric not null default 0,
  memo text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists receipts_company_id_idx on public.receipts (company_id);
create index if not exists receipts_project_id_idx on public.receipts (project_id);

create table if not exists public.receipt_items (
  id text primary key,
  company_id text not null references public.companies (id) on delete cascade,
  receipt_id text not null references public.receipts (id) on delete cascade,
  item_template_id text,
  name text not null,
  description text not null default '',
  width text not null default '',
  height text not null default '',
  quantity numeric not null default 1,
  unit text not null default '式',
  unit_price numeric not null default 0,
  tax_rate numeric not null default 0.1,
  amount numeric not null default 0,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists receipt_items_receipt_id_idx on public.receipt_items (receipt_id);

-- RLS
alter table public.bank_accounts enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.delivery_notes enable row level security;
alter table public.delivery_note_items enable row level security;
alter table public.receipts enable row level security;
alter table public.receipt_items enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array[
    'bank_accounts', 'orders', 'order_items',
    'delivery_notes', 'delivery_note_items',
    'receipts', 'receipt_items'
  ]
  loop
    execute format('drop policy if exists %I_select on public.%I', t, t);
    execute format('drop policy if exists %I_insert on public.%I', t, t);
    execute format('drop policy if exists %I_update on public.%I', t, t);
    execute format('drop policy if exists %I_delete on public.%I', t, t);

    execute format(
      'create policy %I_select on public.%I for select using (company_id = public.current_company_id())',
      t, t
    );
    execute format(
      'create policy %I_insert on public.%I for insert with check (company_id = public.current_company_id())',
      t, t
    );
    execute format(
      'create policy %I_update on public.%I for update using (company_id = public.current_company_id()) with check (company_id = public.current_company_id())',
      t, t
    );
    execute format(
      'create policy %I_delete on public.%I for delete using (company_id = public.current_company_id())',
      t, t
    );
  end loop;
end $$;
