-- 注文書・納品書・領収書の論理削除用 deleted_at 列

alter table public.orders
  add column if not exists deleted_at timestamptz;

alter table public.delivery_notes
  add column if not exists deleted_at timestamptz;

alter table public.receipts
  add column if not exists deleted_at timestamptz;

create index if not exists orders_deleted_at_idx
  on public.orders (deleted_at)
  where deleted_at is null;

create index if not exists delivery_notes_deleted_at_idx
  on public.delivery_notes (deleted_at)
  where deleted_at is null;

create index if not exists receipts_deleted_at_idx
  on public.receipts (deleted_at)
  where deleted_at is null;
