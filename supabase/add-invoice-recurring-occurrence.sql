-- 定期請求の「請求回」冪等性
-- Dashboard → SQL Editor で実行してください。
--
-- invoices に
--   recurring_billing_id
--   recurring_occurrence_date
-- を追加し、同一会社・同一定期請求・同一請求回の
-- 有効請求書（deleted_at IS NULL）を1件に制限する。
--
-- next_billing_date の二重更新防止は
-- advance_recurring_billing_if_occurrence RPC
-- （FOR UPDATE + 条件付き更新）で担保する。

-- ---------------------------------------------------------------------------
-- 1. 列追加
-- ---------------------------------------------------------------------------
alter table public.invoices
  add column if not exists recurring_billing_id text
    references public.recurring_billings (id) on delete set null;

alter table public.invoices
  add column if not exists recurring_occurrence_date date;

comment on column public.invoices.recurring_billing_id is
  '定期請求から生成した場合の元 recurring_billings.id。通常請求は NULL。';

comment on column public.invoices.recurring_occurrence_date is
  '定期請求の請求回（生成時点の next_billing_date）。通常請求は NULL。';

create index if not exists invoices_recurring_billing_id_idx
  on public.invoices (recurring_billing_id)
  where recurring_billing_id is not null;

-- 有効な定期請求回は会社内で一意（soft delete 後は再生成可）
create unique index if not exists invoices_recurring_occurrence_uidx
  on public.invoices (
    company_id,
    recurring_billing_id,
    recurring_occurrence_date
  )
  where recurring_billing_id is not null
    and recurring_occurrence_date is not null
    and deleted_at is null;

-- ---------------------------------------------------------------------------
-- 2. next_billing_date を請求回一致時のみ1回進める RPC
-- ---------------------------------------------------------------------------
create or replace function public.advance_recurring_billing_if_occurrence(
  p_recurring_billing_id text,
  p_occurrence_date date
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_company_id text;
  v_row public.recurring_billings%rowtype;
  v_day integer;
  v_next date;
  v_updated boolean := false;
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
    raise exception 'permission denied to advance recurring billing'
      using errcode = '42501';
  end if;

  if p_recurring_billing_id is null or length(trim(p_recurring_billing_id)) = 0 then
    raise exception 'recurring billing id required';
  end if;

  if p_occurrence_date is null then
    raise exception 'occurrence date required';
  end if;

  select *
    into v_row
  from public.recurring_billings r
  where r.id = p_recurring_billing_id
    and r.company_id = v_company_id
  for update;

  if not found then
    raise exception 'recurring billing not found'
      using errcode = 'P0002';
  end if;

  if v_row.status <> 'active' then
    return jsonb_build_object(
      'advanced', false,
      'reason', 'not_active',
      'recurring_billing', to_jsonb(v_row)
    );
  end if;

  -- すでに別リクエストが進めていれば二重 advance しない
  if v_row.next_billing_date is distinct from p_occurrence_date then
    return jsonb_build_object(
      'advanced', false,
      'reason', 'already_advanced',
      'recurring_billing', to_jsonb(v_row)
    );
  end if;

  -- JS advanceNextBillingDate と同等: 翌月の billing_day（1〜28）
  v_day := least(28, greatest(1, coalesce(v_row.billing_day, 25)::integer));
  v_next := (
    date_trunc('month', p_occurrence_date::timestamp)
    + interval '1 month'
    + ((v_day - 1) * interval '1 day')
  )::date;

  update public.recurring_billings
  set
    next_billing_date = v_next,
    updated_at = now()
  where id = p_recurring_billing_id
    and company_id = v_company_id
    and next_billing_date = p_occurrence_date
  returning * into v_row;

  v_updated := found;

  return jsonb_build_object(
    'advanced', v_updated,
    'reason', case when v_updated then 'updated' else 'race_lost' end,
    'recurring_billing', to_jsonb(v_row)
  );
end;
$$;

revoke all on function public.advance_recurring_billing_if_occurrence(text, date) from public;
grant execute on function public.advance_recurring_billing_if_occurrence(text, date) to authenticated;

comment on function public.advance_recurring_billing_if_occurrence(text, date) is
  '定期請求の next_billing_date を、指定した請求回と一致するときだけ1回進める（FOR UPDATE + 条件付き更新）。';
