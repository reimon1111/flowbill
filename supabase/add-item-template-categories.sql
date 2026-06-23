-- item_template_categories: 請求項目テンプレのカテゴリマスタ

create table if not exists public.item_template_categories (
  id text primary key,
  company_id text not null references public.companies (id) on delete cascade,
  name text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists item_template_categories_company_id_idx
  on public.item_template_categories (company_id);

create index if not exists item_template_categories_sort_order_idx
  on public.item_template_categories (company_id, sort_order);

alter table public.item_template_categories enable row level security;

-- 他テーブルと同じく profiles 経由の current_company_id() を使う
-- ※ auth.jwt() ->> 'company_id' はこのアプリでは未設定のため RLS 拒否になる

drop policy if exists item_template_categories_select on public.item_template_categories;
drop policy if exists item_template_categories_insert on public.item_template_categories;
drop policy if exists item_template_categories_update on public.item_template_categories;
drop policy if exists item_template_categories_delete on public.item_template_categories;

create policy item_template_categories_select
  on public.item_template_categories
  for select
  using (company_id = public.current_company_id());

create policy item_template_categories_insert
  on public.item_template_categories
  for insert
  with check (company_id = public.current_company_id());

create policy item_template_categories_update
  on public.item_template_categories
  for update
  using (company_id = public.current_company_id())
  with check (company_id = public.current_company_id());

create policy item_template_categories_delete
  on public.item_template_categories
  for delete
  using (company_id = public.current_company_id());

-- 初期カテゴリ（既存の固定カテゴリを投入）
insert into public.item_template_categories (id, company_id, name, sort_order)
select
  'itc_' || substr(md5(c.id || ':' || v.name), 1, 12) as id,
  c.id as company_id,
  v.name,
  v.sort_order
from public.companies c
cross join (values
  ('制作', 0),
  ('保守', 1),
  ('工事', 2),
  ('材料', 3),
  ('作業', 4),
  ('交通費', 5),
  ('その他', 999)
) as v(name, sort_order)
on conflict do nothing;

