-- 案件明細 + 見積・請求明細の単位（unit）
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

alter table public.project_items enable row level security;

alter table public.quote_items
  add column if not exists unit text not null default '式';

alter table public.invoice_items
  add column if not exists unit text not null default '式';

-- RLS（schema.sql の DO ブロック未実行環境向け）
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'project_items' and policyname = 'project_items_select'
  ) then
    create policy project_items_select on public.project_items
      for select using (company_id = public.current_company_id());
    create policy project_items_insert on public.project_items
      for insert with check (company_id = public.current_company_id());
    create policy project_items_update on public.project_items
      for update using (company_id = public.current_company_id());
    create policy project_items_delete on public.project_items
      for delete using (company_id = public.current_company_id());
  end if;
end $$;
