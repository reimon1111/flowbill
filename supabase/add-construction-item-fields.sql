-- 建築・工事業向け: 明細 W/H/単位、案件 工事場所、顧客 FAX
-- Supabase SQL Editor で実行してください（既存データを壊さない additive 変更）

alter table public.project_items
  add column if not exists width text,
  add column if not exists height text;

alter table public.project_items
  alter column unit set default '一式';

update public.project_items
set unit = '一式'
where unit is null or trim(unit) = '';

alter table public.quote_items
  add column if not exists width text,
  add column if not exists height text;

alter table public.quote_items
  alter column unit set default '一式';

update public.quote_items
set unit = '一式'
where unit is null or trim(unit) = '';

alter table public.invoice_items
  add column if not exists width text,
  add column if not exists height text;

alter table public.invoice_items
  alter column unit set default '一式';

update public.invoice_items
set unit = '一式'
where unit is null or trim(unit) = '';

alter table public.customers
  add column if not exists fax text not null default '';

alter table public.projects
  add column if not exists construction_site text not null default '';
