-- 会社設定: 帳票用 FAX・担当者名
alter table public.companies
  add column if not exists fax text not null default '',
  add column if not exists contact_name text not null default '';
