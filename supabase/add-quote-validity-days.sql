-- 既存DB向け: 見積の有効期限（発行日からの日数）を会社設定に追加
alter table public.companies
  add column if not exists quote_validity_days smallint not null default 14;
