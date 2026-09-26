-- 帳票用担当者名（profiles + 各帳票スナップショット）
-- Dashboard → SQL Editor で実行してください。
-- 既存行は default ''。表示時は会社の contact_name へフォールバック。

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists document_contact_name text not null default '';

comment on column public.profiles.document_contact_name is
  '帳票用担当者名。未入力時は会社設定の contact_name を帳票初期値に使用する。';

-- ---------------------------------------------------------------------------
-- 帳票スナップショット
-- ---------------------------------------------------------------------------
alter table public.quotes
  add column if not exists document_contact_name text not null default '';

alter table public.invoices
  add column if not exists document_contact_name text not null default '';

alter table public.orders
  add column if not exists document_contact_name text not null default '';

alter table public.delivery_notes
  add column if not exists document_contact_name text not null default '';

alter table public.receipts
  add column if not exists document_contact_name text not null default '';

comment on column public.quotes.document_contact_name is '帳票表示用担当者名（作成時スナップショット）';
comment on column public.invoices.document_contact_name is '帳票表示用担当者名（作成時スナップショット）';
comment on column public.orders.document_contact_name is '帳票表示用担当者名（作成時スナップショット）';
comment on column public.delivery_notes.document_contact_name is '帳票表示用担当者名（作成時スナップショット）';
comment on column public.receipts.document_contact_name is '帳票表示用担当者名（作成時スナップショット）';
