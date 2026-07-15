-- 書類全体の値引き（固定金額）
-- 既存環境向けパッチ。RLS ポリシー変更は不要（列追加のみ）。

alter table public.projects
  add column if not exists discount_label text not null default '',
  add column if not exists discount_amount numeric not null default 0;

alter table public.quotes
  add column if not exists discount_label text not null default '',
  add column if not exists discount_amount numeric not null default 0;

alter table public.invoices
  add column if not exists discount_label text not null default '',
  add column if not exists discount_amount numeric not null default 0;

alter table public.orders
  add column if not exists discount_label text not null default '',
  add column if not exists discount_amount numeric not null default 0;

alter table public.delivery_notes
  add column if not exists discount_label text not null default '',
  add column if not exists discount_amount numeric not null default 0;

alter table public.receipts
  add column if not exists discount_label text not null default '',
  add column if not exists discount_amount numeric not null default 0;
