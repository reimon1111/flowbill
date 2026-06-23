-- 案件アーカイブフラグ
alter table public.projects
  add column if not exists archived boolean not null default false;

create index if not exists projects_archived_idx on public.projects (archived);
