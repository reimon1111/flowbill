-- 案件の受注確定日・作業完了日（一覧の並び替え・年フィルター用）
alter table projects
  add column if not exists confirmed_date date,
  add column if not exists completed_date date;
