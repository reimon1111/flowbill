-- 請求書の論理削除用 deleted_at 列
-- 注意: deleted_by は現行アプリ未使用（store から除外し、deleted_at のみで判定）

alter table public.invoices
  add column if not exists deleted_at timestamptz;

create index if not exists invoices_deleted_at_idx
  on public.invoices (deleted_at)
  where deleted_at is null;
