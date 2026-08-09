-- 見積更新 + 条件付き顧客再割当を同一トランザクションで実行
-- Dashboard → SQL Editor で実行してください。
--
-- 変更内容:
--   1. reassign_estimate_project_customer に履歴ガードを追加
--   2. update_quote_with_items を拡張（customer_id 変更時は再割当後に見積・明細更新）
--
-- 顧客変更可能条件:
--   projects.status = 'estimate'
--   かつ当該案件の全 quotes が draft
--   かつ非削除の orders / delivery_notes / invoices / receipts に draft 以外が無い
--
-- 顧客変更なしの通常保存は従来どおり（reassign をスキップ）

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

comment on function public.reassign_estimate_project_customer(text, text) is
  '未確定かつ全見積draft・商業帳票に非draftが無い案件の顧客を原子的に変更する。';

-- ---------------------------------------------------------------------------
-- update_quote_with_items（顧客変更時は同一TXで再割当）
-- ---------------------------------------------------------------------------
create or replace function public.update_quote_with_items(
  p_quote_id text,
  p_quote jsonb,
  p_items jsonb
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
  v_quote public.quotes%rowtype;
  v_item jsonb;
  v_item_id text;
  v_name text;
  v_qty numeric;
  v_unit_price numeric;
  v_sort integer;
  v_quote_json jsonb;
  v_items_json jsonb;
  v_new_customer_id text;
  v_project_id text;
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
    raise exception 'permission denied to update quote'
      using errcode = '42501';
  end if;

  if p_quote_id is null or length(trim(p_quote_id)) = 0 then
    raise exception 'quote id required';
  end if;

  if p_quote is null or jsonb_typeof(p_quote) <> 'object' then
    raise exception 'quote payload required';
  end if;

  if p_items is null
     or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) < 1 then
    raise exception 'at least one quote item is required';
  end if;

  select *
    into v_quote
  from public.quotes q
  where q.id = p_quote_id
    and q.company_id = v_company_id
  for update;

  if not found then
    raise exception 'quote not found'
      using errcode = 'P0002';
  end if;

  v_project_id := v_quote.project_id;
  v_new_customer_id := nullif(trim(p_quote->>'customer_id'), '');

  -- 顧客変更がある場合: 同一トランザクション内で再割当（失敗時は全文ロールバック）
  if v_new_customer_id is not null
     and v_new_customer_id is distinct from v_quote.customer_id then
    -- assert を先に（reassign 内部でも行うが明示）
    perform public.assert_project_customer_reassignable(v_company_id, v_project_id);
    perform public.reassign_estimate_project_customer(
      v_project_id,
      v_new_customer_id
    );
    -- reassign 後に quote 行を再読込（customer_id 他）
    select *
      into v_quote
    from public.quotes q
    where q.id = p_quote_id
      and q.company_id = v_company_id
    for update;
  end if;

  update public.quotes set
    project_id = coalesce(nullif(trim(p_quote->>'project_id'), ''), project_id),
    customer_id = coalesce(nullif(trim(p_quote->>'customer_id'), ''), customer_id),
    issue_date = coalesce((p_quote->>'issue_date')::date, issue_date),
    expiry_type = coalesce(nullif(trim(p_quote->>'expiry_type'), ''), expiry_type),
    expiry_date = coalesce((p_quote->>'expiry_date')::date, expiry_date),
    subtotal = coalesce((p_quote->>'subtotal')::numeric, subtotal),
    tax_amount = coalesce((p_quote->>'tax_amount')::numeric, tax_amount),
    total_amount = coalesce((p_quote->>'total_amount')::numeric, total_amount),
    discount_label = coalesce(p_quote->>'discount_label', discount_label),
    discount_amount = coalesce((p_quote->>'discount_amount')::numeric, discount_amount),
    customer_honorific = coalesce(
      nullif(trim(p_quote->>'customer_honorific'), ''),
      customer_honorific
    ),
    customer_contact_name = case
      when p_quote ? 'customer_contact_name' then nullif(p_quote->>'customer_contact_name', '')
      else customer_contact_name
    end,
    customer_department = case
      when p_quote ? 'customer_department' then nullif(p_quote->>'customer_department', '')
      else customer_department
    end,
    customer_position = case
      when p_quote ? 'customer_position' then nullif(p_quote->>'customer_position', '')
      else customer_position
    end,
    memo = coalesce(p_quote->>'memo', memo),
    document_email = case
      when p_quote ? 'document_email' then coalesce(p_quote->>'document_email', '')
      else document_email
    end,
    payment_terms = coalesce(p_quote->>'payment_terms', payment_terms),
    updated_at = coalesce((p_quote->>'updated_at')::timestamptz, v_now),
    updated_by = v_uid
  where id = p_quote_id
    and company_id = v_company_id;

  if not found then
    raise exception 'quote update failed';
  end if;

  delete from public.quote_items
  where quote_id = p_quote_id
    and company_id = v_company_id;

  for v_item in
    select value from jsonb_array_elements(p_items)
  loop
    v_item_id := nullif(trim(v_item->>'id'), '');
    v_name := nullif(trim(v_item->>'name'), '');
    v_qty := coalesce((v_item->>'quantity')::numeric, 0);
    v_unit_price := coalesce((v_item->>'unit_price')::numeric, 0);
    v_sort := coalesce((v_item->>'sort_order')::integer, 0);

    if v_item_id is null then
      raise exception 'quote item id required';
    end if;
    if v_name is null then
      raise exception 'quote item name required';
    end if;
    if v_qty < 1 then
      raise exception 'quote item quantity must be >= 1';
    end if;

    insert into public.quote_items (
      id,
      company_id,
      quote_id,
      item_template_id,
      name,
      description,
      width,
      height,
      quantity,
      unit,
      unit_price,
      tax_rate,
      amount,
      sort_order,
      created_at,
      updated_at
    ) values (
      v_item_id,
      v_company_id,
      p_quote_id,
      nullif(trim(v_item->>'item_template_id'), ''),
      v_name,
      coalesce(v_item->>'description', ''),
      coalesce(v_item->>'width', ''),
      coalesce(v_item->>'height', ''),
      v_qty,
      coalesce(nullif(trim(v_item->>'unit'), ''), '一式'),
      v_unit_price,
      coalesce((v_item->>'tax_rate')::numeric, 0.1),
      coalesce((v_item->>'amount')::numeric, v_qty * v_unit_price),
      v_sort,
      coalesce((v_item->>'created_at')::timestamptz, v_now),
      coalesce((v_item->>'updated_at')::timestamptz, v_now)
    );
  end loop;

  select to_jsonb(q.*)
    into v_quote_json
  from public.quotes q
  where q.id = p_quote_id
    and q.company_id = v_company_id;

  select coalesce(
    jsonb_agg(to_jsonb(i.*) order by i.sort_order, i.id),
    '[]'::jsonb
  )
    into v_items_json
  from public.quote_items i
  where i.quote_id = p_quote_id
    and i.company_id = v_company_id;

  return jsonb_build_object(
    'quote', v_quote_json,
    'items', v_items_json
  );
end;
$$;

revoke all on function public.update_quote_with_items(text, jsonb, jsonb) from public;
grant execute on function public.update_quote_with_items(text, jsonb, jsonb) to authenticated;

comment on function public.update_quote_with_items(text, jsonb, jsonb) is
  'Atomically update a quote and replace line items. When customer_id changes, reassigns project customer and related draft documents in the same transaction.';
