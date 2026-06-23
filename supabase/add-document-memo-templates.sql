-- 既存DB向け: 見積・請求の備考テンプレート
alter table public.companies
  add column if not exists quote_memo_template text not null default '';

alter table public.companies
  add column if not exists invoice_memo_template text not null default '';
