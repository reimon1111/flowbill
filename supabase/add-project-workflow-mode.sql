-- 案件単位の業務フロー（標準 / 簡易）
-- Dashboard → SQL Editor で実行してください。
--
-- companies.workflow_mode は「新規案件のデフォルト」。
-- 既存案件は default 'standard' のまま（会社設定へはバックフィルしない）。

alter table public.projects
  add column if not exists workflow_mode text not null default 'standard';

alter table public.projects
  add column if not exists simple_documents_initialized_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'projects_workflow_mode_check'
      and conrelid = 'public.projects'::regclass
  ) then
    alter table public.projects
      add constraint projects_workflow_mode_check
      check (workflow_mode in ('standard', 'simple'));
  end if;
end $$;

comment on column public.projects.workflow_mode is
  '案件作成時に会社設定からスナップショット。standard=ステータス連動 / simple=帳票一式自動生成。既存案件は変更しない。';

comment on column public.projects.simple_documents_initialized_at is
  'simple案件の帳票一式（見積・注文・納品・請求・領収）生成完了時刻。冪等性・二重生成防止用。';
