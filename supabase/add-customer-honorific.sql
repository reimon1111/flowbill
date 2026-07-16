-- 顧客宛名の敬称（案件・見積・納品・請求・領収）
-- 既存環境向けパッチ。注文書（orders）は対象外。RLS 変更なし。

alter table public.projects
  add column if not exists customer_honorific text not null default '御中';

alter table public.quotes
  add column if not exists customer_honorific text not null default '御中';

alter table public.invoices
  add column if not exists customer_honorific text not null default '御中';

alter table public.delivery_notes
  add column if not exists customer_honorific text not null default '御中';

alter table public.receipts
  add column if not exists customer_honorific text not null default '御中';
