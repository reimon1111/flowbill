-- 各帳票テーブルへメールアドレス（スナップショット）列を追加
-- Dashboard → SQL Editor で実行してください。
-- 既存行は default '' のため、表示時は会社設定メールへフォールバックする。

alter table public.quotes
  add column if not exists document_email text not null default '';

alter table public.invoices
  add column if not exists document_email text not null default '';

alter table public.orders
  add column if not exists document_email text not null default '';

alter table public.delivery_notes
  add column if not exists document_email text not null default '';

alter table public.receipts
  add column if not exists document_email text not null default '';

comment on column public.quotes.document_email is '帳票表示用メール（作成時スナップショット）';
comment on column public.invoices.document_email is '帳票表示用メール（作成時スナップショット）';
comment on column public.orders.document_email is '帳票表示用メール（作成時スナップショット）';
comment on column public.delivery_notes.document_email is '帳票表示用メール（作成時スナップショット）';
comment on column public.receipts.document_email is '帳票表示用メール（作成時スナップショット）';
