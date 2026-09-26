-- 会社設定: 業務フロー（標準 / 簡易）
-- Dashboard → SQL Editor で実行してください。
-- 既存行は default 'standard' のため、適用直後の作成条件は現状どおりです。

alter table public.companies
  add column if not exists workflow_mode text not null default 'standard';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'companies_workflow_mode_check'
      and conrelid = 'public.companies'::regclass
  ) then
    alter table public.companies
      add constraint companies_workflow_mode_check
      check (workflow_mode in ('standard', 'simple'));
  end if;
end $$;

comment on column public.companies.workflow_mode is
  '業務フロー。standard=案件ステータスに応じた帳票作成制限。simple=lost以外で各帳票を作成可能（領収は請求必須）。';
