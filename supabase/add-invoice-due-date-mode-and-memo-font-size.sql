-- 請求書支払期限モード + 全帳票の備考文字サイズ
-- Dashboard → SQL Editor で実行してください。
--
-- 1) invoices.due_date_mode（null=既存 / discussion / date）
-- 2) invoices.due_date を NULL 許可（discussion 時）
-- 3) quotes / invoices / orders / delivery_notes / receipts に memo_font_size
--
-- 既存行の due_date_mode は NULL のまま（一括で discussion にしない）
-- memo_font_size は default 'normal'（見た目は現行維持）

-- ---------------------------------------------------------------------------
-- 支払期限モード
-- ---------------------------------------------------------------------------
alter table public.invoices
  alter column due_date drop not null;

alter table public.invoices
  add column if not exists due_date_mode text;

comment on column public.invoices.due_date_mode is
  '支払期限方式: discussion=別途打ち合わせ / date=日付指定 / NULL=既存データ';

alter table public.invoices
  drop constraint if exists invoices_due_date_mode_check;

alter table public.invoices
  add constraint invoices_due_date_mode_check
  check (
    due_date_mode is null
    or due_date_mode in ('discussion', 'date')
  );

-- ---------------------------------------------------------------------------
-- 備考文字サイズ
-- ---------------------------------------------------------------------------
alter table public.quotes
  add column if not exists memo_font_size text not null default 'normal';

alter table public.invoices
  add column if not exists memo_font_size text not null default 'normal';

alter table public.orders
  add column if not exists memo_font_size text not null default 'normal';

alter table public.delivery_notes
  add column if not exists memo_font_size text not null default 'normal';

alter table public.receipts
  add column if not exists memo_font_size text not null default 'normal';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'quotes_memo_font_size_check'
  ) then
    alter table public.quotes
      add constraint quotes_memo_font_size_check
      check (memo_font_size in ('small', 'normal', 'large'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'invoices_memo_font_size_check'
  ) then
    alter table public.invoices
      add constraint invoices_memo_font_size_check
      check (memo_font_size in ('small', 'normal', 'large'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'orders_memo_font_size_check'
  ) then
    alter table public.orders
      add constraint orders_memo_font_size_check
      check (memo_font_size in ('small', 'normal', 'large'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'delivery_notes_memo_font_size_check'
  ) then
    alter table public.delivery_notes
      add constraint delivery_notes_memo_font_size_check
      check (memo_font_size in ('small', 'normal', 'large'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'receipts_memo_font_size_check'
  ) then
    alter table public.receipts
      add constraint receipts_memo_font_size_check
      check (memo_font_size in ('small', 'normal', 'large'));
  end if;
end $$;
