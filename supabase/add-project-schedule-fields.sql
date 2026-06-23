-- 案件予定表: 開始日・完了予定日・担当者名
alter table public.projects
  add column if not exists start_date date;

alter table public.projects
  add column if not exists end_date date;

alter table public.projects
  add column if not exists assignee_name text not null default '';
