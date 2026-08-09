-- 未確定案件の顧客再割当 RPC（ガード付き）
-- Dashboard → SQL Editor で実行してください。
--
-- 顧客変更可能条件:
--   projects.status = 'estimate'
--   かつ当該案件の全 quotes が draft
--   かつ非削除の商業帳票に draft 以外が無い
--
-- 見積編集保存と原子的にまとめる場合は、この後に必ず実行:
--   supabase/update-quote-customer-reassign-atomic.sql
-- （update_quote_with_items を「再割当＋見積更新」へ差し替えます）

-- ---------------------------------------------------------------------------
-- 内部チェック用ヘルパ
-- ---------------------------------------------------------------------------
create or replace function public.assert_project_customer_reassignable(
  p_company_id text,
  p_project_id text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
begin
  select p.status
    into v_status
  from public.projects p
  where p.id = p_project_id
    and p.company_id = p_company_id
  for update;

  if not found then
    raise exception 'project not found'
      using errcode = 'P0002';
  end if;

  if v_status = 'lost' then
    raise exception 'project customer change blocked: lost'
      using errcode = 'P0001';
  end if;

  if v_status is distinct from 'estimate' then
    raise exception 'project customer change is locked after confirmation'
      using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from public.quotes q
    where q.project_id = p_project_id
      and q.company_id = p_company_id
      and q.status is distinct from 'draft'
  ) then
    raise exception 'project customer change blocked: non-draft quotes'
      using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.orders o
    where o.project_id = p_project_id
      and o.company_id = p_company_id
      and o.deleted_at is null
      and o.status is distinct from 'draft'
  )
  or exists (
    select 1 from public.delivery_notes d
    where d.project_id = p_project_id
      and d.company_id = p_company_id
      and d.deleted_at is null
      and d.status is distinct from 'draft'
  )
  or exists (
    select 1 from public.invoices inv
    where inv.project_id = p_project_id
      and inv.company_id = p_company_id
      and inv.deleted_at is null
      and inv.status is distinct from 'draft'
  )
  or exists (
    select 1 from public.receipts r
    where r.project_id = p_project_id
      and r.company_id = p_company_id
      and r.deleted_at is null
      and r.status is distinct from 'draft'
  ) then
    raise exception 'project customer change blocked: non-draft commercial documents'
      using errcode = 'P0001';
  end if;
end;
$$;

revoke all on function public.assert_project_customer_reassignable(text, text) from public;
-- security definer 内部専用。authenticated には execute を公開しない

-- ---------------------------------------------------------------------------
-- 顧客再割当本体（ガード付き）
-- ---------------------------------------------------------------------------
create or replace function public.reassign_estimate_project_customer(
  p_project_id text,
  p_new_customer_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_company_id text;
  v_now timestamptz := now();
  v_project public.projects%rowtype;
  v_new_contact text;
  v_quotes int := 0;
  v_invoices int := 0;
  v_orders int := 0;
  v_delivery_notes int := 0;
  v_receipts int := 0;
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
    raise exception 'permission denied to reassign project customer'
      using errcode = '42501';
  end if;

  if p_project_id is null or length(trim(p_project_id)) = 0 then
    raise exception 'project id required';
  end if;

  if p_new_customer_id is null or length(trim(p_new_customer_id)) = 0 then
    raise exception 'customer id required';
  end if;

  perform public.assert_project_customer_reassignable(v_company_id, p_project_id);

  select *
    into v_project
  from public.projects p
  where p.id = p_project_id
    and p.company_id = v_company_id
  for update;

  if not found then
    raise exception 'project not found'
      using errcode = 'P0002';
  end if;

  if not exists (
    select 1
    from public.customers c
    where c.id = p_new_customer_id
      and c.company_id = v_company_id
  ) then
    raise exception 'customer not found'
      using errcode = 'P0002';
  end if;

  select nullif(trim(c.contact_name), '')
    into v_new_contact
  from public.customers c
  where c.id = p_new_customer_id
    and c.company_id = v_company_id;

  if v_project.customer_id = p_new_customer_id then
    return jsonb_build_object(
      'project_id', p_project_id,
      'customer_id', p_new_customer_id,
      'unchanged', true,
      'quotes', 0,
      'invoices', 0,
      'orders', 0,
      'delivery_notes', 0,
      'receipts', 0
    );
  end if;

  update public.projects
  set
    customer_id = p_new_customer_id,
    customer_contact_name = v_new_contact,
    customer_department = null,
    customer_position = null,
    updated_at = v_now,
    updated_by = v_uid
  where id = p_project_id
    and company_id = v_company_id;

  update public.quotes
  set
    customer_id = p_new_customer_id,
    customer_contact_name = v_new_contact,
    customer_department = null,
    customer_position = null,
    updated_at = v_now,
    updated_by = v_uid
  where project_id = p_project_id
    and company_id = v_company_id;
  get diagnostics v_quotes = row_count;

  update public.invoices
  set
    customer_id = p_new_customer_id,
    customer_contact_name = v_new_contact,
    customer_department = null,
    customer_position = null,
    updated_at = v_now,
    updated_by = v_uid
  where project_id = p_project_id
    and company_id = v_company_id
    and status = 'draft'
    and deleted_at is null;
  get diagnostics v_invoices = row_count;

  update public.orders
  set
    customer_id = p_new_customer_id,
    customer_contact_name = v_new_contact,
    customer_department = null,
    customer_position = null,
    updated_at = v_now,
    updated_by = v_uid
  where project_id = p_project_id
    and company_id = v_company_id
    and status = 'draft'
    and deleted_at is null;
  get diagnostics v_orders = row_count;

  update public.delivery_notes
  set
    customer_id = p_new_customer_id,
    customer_contact_name = v_new_contact,
    customer_department = null,
    customer_position = null,
    updated_at = v_now,
    updated_by = v_uid
  where project_id = p_project_id
    and company_id = v_company_id
    and status = 'draft'
    and deleted_at is null;
  get diagnostics v_delivery_notes = row_count;

  update public.receipts
  set
    customer_id = p_new_customer_id,
    customer_contact_name = v_new_contact,
    customer_department = null,
    customer_position = null,
    updated_at = v_now,
    updated_by = v_uid
  where project_id = p_project_id
    and company_id = v_company_id
    and status = 'draft'
    and deleted_at is null;
  get diagnostics v_receipts = row_count;

  return jsonb_build_object(
    'project_id', p_project_id,
    'customer_id', p_new_customer_id,
    'unchanged', false,
    'quotes', v_quotes,
    'invoices', v_invoices,
    'orders', v_orders,
    'delivery_notes', v_delivery_notes,
    'receipts', v_receipts
  );
end;
$$;

revoke all on function public.reassign_estimate_project_customer(text, text) from public;
grant execute on function public.reassign_estimate_project_customer(text, text) to authenticated;

-- 注意: 見積保存との原子的統合は update-quote-customer-reassign-atomic.sql を実行してください。
