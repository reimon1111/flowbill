-- 会社設定の追加列（まとめて適用）
-- 既に個別 SQL を実行済みでも問題ありません（IF NOT EXISTS）

alter table public.companies
  add column if not exists quote_validity_days smallint not null default 14;

alter table public.companies
  add column if not exists quote_memo_template text not null default '';

alter table public.companies
  add column if not exists invoice_memo_template text not null default '';

alter table public.companies
  add column if not exists fax text not null default '';

alter table public.companies
  add column if not exists contact_name text not null default '';

alter table public.companies
  add column if not exists quote_default_expiry_type text not null default '1_month';

-- STEP14: 支払い条件・書類備考テンプレ
alter table public.companies
  add column if not exists payment_terms text not null default '請求書発行後14日以内';

alter table public.companies
  add column if not exists order_memo_template text not null default '';

alter table public.companies
  add column if not exists delivery_note_memo_template text not null default '';

alter table public.companies
  add column if not exists receipt_memo_template text not null default '';
