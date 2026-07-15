-- 先方担当者（案件・各書類のスナップショット）
-- 既存環境向けパッチ。NULL 許可。RLS 変更なし。

alter table public.projects
  add column if not exists customer_contact_name text,
  add column if not exists customer_department text,
  add column if not exists customer_position text;

alter table public.quotes
  add column if not exists customer_contact_name text,
  add column if not exists customer_department text,
  add column if not exists customer_position text;

alter table public.invoices
  add column if not exists customer_contact_name text,
  add column if not exists customer_department text,
  add column if not exists customer_position text;

alter table public.orders
  add column if not exists customer_contact_name text,
  add column if not exists customer_department text,
  add column if not exists customer_position text;

alter table public.delivery_notes
  add column if not exists customer_contact_name text,
  add column if not exists customer_department text,
  add column if not exists customer_position text;

alter table public.receipts
  add column if not exists customer_contact_name text,
  add column if not exists customer_department text,
  add column if not exists customer_position text;
