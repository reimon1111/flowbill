-- 帳票番号の安全な採番 + 会社単位 UNIQUE
-- Dashboard → SQL Editor で実行してください。
--
-- 1) 既存重複があれば UNIQUE 追加前に明示エラー（自動リナンバーなし）
-- 2) document_number_counters で原子的に採番
-- 3) allocate_document_number(doc_kind, year) RPC
-- 4) (company_id, *_number) UNIQUE（soft delete 含む・番号再利用なし）
--
-- 依存: current_company_id() / can_write_company_data()
-- BUG-004（invoices.recurring_*）とは独立。壊さない。

-- ---------------------------------------------------------------------------
-- 0. 既存重複検査（見つかったら中断。番号の自動書き換えはしない）
-- ---------------------------------------------------------------------------
do $$
declare
  v_msg text := '';
  v_part text;
begin
  select string_agg(
    format('%s / %s ×%s', company_id, quote_number, cnt),
    ', '
  )
  into v_part
  from (
    select company_id, quote_number, count(*)::int as cnt
    from public.quotes
    group by company_id, quote_number
    having count(*) > 1
  ) d;
  if v_part is not null then
    v_msg := v_msg || 'quotes: ' || v_part || E'\n';
  end if;

  select string_agg(
    format('%s / %s ×%s', company_id, order_number, cnt),
    ', '
  )
  into v_part
  from (
    select company_id, order_number, count(*)::int as cnt
    from public.orders
    group by company_id, order_number
    having count(*) > 1
  ) d;
  if v_part is not null then
    v_msg := v_msg || 'orders: ' || v_part || E'\n';
  end if;

  select string_agg(
    format('%s / %s ×%s', company_id, delivery_note_number, cnt),
    ', '
  )
  into v_part
  from (
    select company_id, delivery_note_number, count(*)::int as cnt
    from public.delivery_notes
    group by company_id, delivery_note_number
    having count(*) > 1
  ) d;
  if v_part is not null then
    v_msg := v_msg || 'delivery_notes: ' || v_part || E'\n';
  end if;

  select string_agg(
    format('%s / %s ×%s', company_id, invoice_number, cnt),
    ', '
  )
  into v_part
  from (
    select company_id, invoice_number, count(*)::int as cnt
    from public.invoices
    group by company_id, invoice_number
    having count(*) > 1
  ) d;
  if v_part is not null then
    v_msg := v_msg || 'invoices: ' || v_part || E'\n';
  end if;

  select string_agg(
    format('%s / %s ×%s', company_id, receipt_number, cnt),
    ', '
  )
  into v_part
  from (
    select company_id, receipt_number, count(*)::int as cnt
    from public.receipts
    group by company_id, receipt_number
    having count(*) > 1
  ) d;
  if v_part is not null then
    v_msg := v_msg || 'receipts: ' || v_part || E'\n';
  end if;

  if length(v_msg) > 0 then
    raise exception
      '帳票番号の重複があるため UNIQUE を追加できません。手動で解消してから再実行してください。%',
      E'\n' || v_msg;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 1. 採番カウンタ
-- ---------------------------------------------------------------------------
create table if not exists public.document_number_counters (
  company_id text not null references public.companies (id) on delete cascade,
  doc_kind text not null
    check (doc_kind in ('quote', 'order', 'delivery_note', 'invoice', 'receipt')),
  year integer not null
    check (year >= 2000 and year <= 2100),
  last_value integer not null default 0
    check (last_value >= 0),
  primary key (company_id, doc_kind, year)
);

alter table public.document_number_counters enable row level security;

drop policy if exists document_number_counters_select on public.document_number_counters;
create policy document_number_counters_select
  on public.document_number_counters
  for select
  using (company_id = public.current_company_id());

-- 書き込みは SECURITY DEFINER RPC のみ（直接 insert/update は拒否）
drop policy if exists document_number_counters_write on public.document_number_counters;
-- ポリシーなし = authenticated の直接書込不可（RLS 有効時）

-- ---------------------------------------------------------------------------
-- 2. 既存番号からカウンタを初期化（最大連番。削除済みも含む）
-- ---------------------------------------------------------------------------
insert into public.document_number_counters (company_id, doc_kind, year, last_value)
select
  company_id,
  'quote',
  substring(quote_number from '^QT-(\d{4})-')::integer,
  max(substring(quote_number from '^QT-\d{4}-(\d+)$')::integer)
from public.quotes
where quote_number ~ '^QT-\d{4}-\d+$'
group by company_id, substring(quote_number from '^QT-(\d{4})-')::integer
on conflict (company_id, doc_kind, year) do update
set last_value = greatest(
  public.document_number_counters.last_value,
  excluded.last_value
);

insert into public.document_number_counters (company_id, doc_kind, year, last_value)
select
  company_id,
  'order',
  substring(order_number from '^OR-(\d{4})-')::integer,
  max(substring(order_number from '^OR-\d{4}-(\d+)$')::integer)
from public.orders
where order_number ~ '^OR-\d{4}-\d+$'
group by company_id, substring(order_number from '^OR-(\d{4})-')::integer
on conflict (company_id, doc_kind, year) do update
set last_value = greatest(
  public.document_number_counters.last_value,
  excluded.last_value
);

insert into public.document_number_counters (company_id, doc_kind, year, last_value)
select
  company_id,
  'delivery_note',
  substring(delivery_note_number from '^DN-(\d{4})-')::integer,
  max(substring(delivery_note_number from '^DN-\d{4}-(\d+)$')::integer)
from public.delivery_notes
where delivery_note_number ~ '^DN-\d{4}-\d+$'
group by company_id, substring(delivery_note_number from '^DN-(\d{4})-')::integer
on conflict (company_id, doc_kind, year) do update
set last_value = greatest(
  public.document_number_counters.last_value,
  excluded.last_value
);

insert into public.document_number_counters (company_id, doc_kind, year, last_value)
select
  company_id,
  'invoice',
  substring(invoice_number from '^INV-(\d{4})-')::integer,
  max(substring(invoice_number from '^INV-\d{4}-(\d+)$')::integer)
from public.invoices
where invoice_number ~ '^INV-\d{4}-\d+$'
group by company_id, substring(invoice_number from '^INV-(\d{4})-')::integer
on conflict (company_id, doc_kind, year) do update
set last_value = greatest(
  public.document_number_counters.last_value,
  excluded.last_value
);

insert into public.document_number_counters (company_id, doc_kind, year, last_value)
select
  company_id,
  'receipt',
  substring(receipt_number from '^RC-(\d{4})-')::integer,
  max(substring(receipt_number from '^RC-\d{4}-(\d+)$')::integer)
from public.receipts
where receipt_number ~ '^RC-\d{4}-\d+$'
group by company_id, substring(receipt_number from '^RC-(\d{4})-')::integer
on conflict (company_id, doc_kind, year) do update
set last_value = greatest(
  public.document_number_counters.last_value,
  excluded.last_value
);

-- ---------------------------------------------------------------------------
-- 3. 採番 RPC（原子的インクリメント）
-- ---------------------------------------------------------------------------
create or replace function public.allocate_document_number(
  p_doc_kind text,
  p_year integer
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_company_id text;
  v_prefix text;
  v_next integer;
begin
  if v_uid is null then
    raise exception 'not authenticated'
      using errcode = '28000';
  end if;

  v_company_id := public.current_company_id();
  if v_company_id is null or length(trim(v_company_id)) = 0 then
    raise exception 'company context missing'
      using errcode = '42501';
  end if;

  if not public.can_write_company_data(v_company_id) then
    raise exception 'permission denied to allocate document number'
      using errcode = '42501';
  end if;

  if p_doc_kind is null
     or p_doc_kind not in ('quote', 'order', 'delivery_note', 'invoice', 'receipt') then
    raise exception 'invalid document kind: %', p_doc_kind;
  end if;

  if p_year is null or p_year < 2000 or p_year > 2100 then
    raise exception 'invalid year: %', p_year;
  end if;

  v_prefix := case p_doc_kind
    when 'quote' then 'QT'
    when 'order' then 'OR'
    when 'delivery_note' then 'DN'
    when 'invoice' then 'INV'
    when 'receipt' then 'RC'
  end;

  insert into public.document_number_counters as c (
    company_id, doc_kind, year, last_value
  ) values (
    v_company_id, p_doc_kind, p_year, 0
  )
  on conflict (company_id, doc_kind, year) do nothing;

  update public.document_number_counters
  set last_value = last_value + 1
  where company_id = v_company_id
    and doc_kind = p_doc_kind
    and year = p_year
  returning last_value into v_next;

  if v_next is null then
    raise exception 'failed to allocate document number';
  end if;

  return format(
    '%s-%s-%s',
    v_prefix,
    p_year::text,
    lpad(v_next::text, 4, '0')
  );
end;
$$;

revoke all on function public.allocate_document_number(text, integer) from public;
grant execute on function public.allocate_document_number(text, integer) to authenticated;

comment on function public.allocate_document_number(text, integer) is
  '会社×帳票種別×年の次番号を原子的に払い出す（QT/OR/DN/INV/RC-YYYY-####）。';

-- ---------------------------------------------------------------------------
-- 4. UNIQUE（削除済みも含め番号を永久一意・再利用しない）
-- ---------------------------------------------------------------------------
create unique index if not exists quotes_company_quote_number_uidx
  on public.quotes (company_id, quote_number);

create unique index if not exists orders_company_order_number_uidx
  on public.orders (company_id, order_number);

create unique index if not exists delivery_notes_company_delivery_note_number_uidx
  on public.delivery_notes (company_id, delivery_note_number);

create unique index if not exists invoices_company_invoice_number_uidx
  on public.invoices (company_id, invoice_number);

create unique index if not exists receipts_company_receipt_number_uidx
  on public.receipts (company_id, receipt_number);
