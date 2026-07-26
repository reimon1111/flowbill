-- 請求書・注文書・納品書・領収書・定期請求の親+明細 原子的更新 RPC
-- Dashboard → SQL Editor で実行してください。
--
-- 目的:
--   親 UPDATE → 明細 DELETE → INSERT を1トランザクションで実行し、
--   INSERT 失敗時に既存明細が消える不整合を防ぐ（見積 update_quote_with_items と同設計）。
--
-- 依存:
--   current_company_id(), can_write_company_data() が適用済みであること
--   （add-multi-tenant.sql / add-signup-access-control.sql 等）
--   対象テーブル（schema-full / add-document-management 等）が存在すること

-- ============================================================================
-- 1. 請求書
-- ============================================================================
create or replace function public.update_invoice_with_items(
  p_invoice_id text,
  p_invoice jsonb,
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
  v_parent public.invoices%rowtype;
  v_item jsonb;
  v_item_id text;
  v_name text;
  v_qty numeric;
  v_unit_price numeric;
  v_sort integer;
  v_parent_json jsonb;
  v_items_json jsonb;
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
    raise exception 'permission denied to update invoice'
      using errcode = '42501';
  end if;

  if p_invoice_id is null or length(trim(p_invoice_id)) = 0 then
    raise exception 'invoice id required';
  end if;

  if p_invoice is null or jsonb_typeof(p_invoice) <> 'object' then
    raise exception 'invoice payload required';
  end if;

  if p_items is null
     or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) < 1 then
    raise exception 'at least one invoice item is required';
  end if;

  select *
    into v_parent
  from public.invoices i
  where i.id = p_invoice_id
    and i.company_id = v_company_id
  for update;

  if not found then
    raise exception 'invoice not found'
      using errcode = 'P0002';
  end if;

  update public.invoices set
    project_id = coalesce(nullif(trim(p_invoice->>'project_id'), ''), project_id),
    customer_id = coalesce(nullif(trim(p_invoice->>'customer_id'), ''), customer_id),
    quote_id = coalesce(p_invoice->>'quote_id', quote_id),
    issue_date = coalesce((p_invoice->>'issue_date')::date, issue_date),
    due_date = coalesce((p_invoice->>'due_date')::date, due_date),
    status = coalesce(nullif(trim(p_invoice->>'status'), ''), status),
    subtotal = coalesce((p_invoice->>'subtotal')::numeric, subtotal),
    tax_amount = coalesce((p_invoice->>'tax_amount')::numeric, tax_amount),
    total_amount = coalesce((p_invoice->>'total_amount')::numeric, total_amount),
    discount_label = coalesce(p_invoice->>'discount_label', discount_label),
    discount_amount = coalesce((p_invoice->>'discount_amount')::numeric, discount_amount),
    customer_honorific = coalesce(
      nullif(trim(p_invoice->>'customer_honorific'), ''),
      customer_honorific
    ),
    customer_contact_name = case
      when p_invoice ? 'customer_contact_name' then nullif(p_invoice->>'customer_contact_name', '')
      else customer_contact_name
    end,
    customer_department = case
      when p_invoice ? 'customer_department' then nullif(p_invoice->>'customer_department', '')
      else customer_department
    end,
    customer_position = case
      when p_invoice ? 'customer_position' then nullif(p_invoice->>'customer_position', '')
      else customer_position
    end,
    memo = coalesce(p_invoice->>'memo', memo),
    payment_terms = coalesce(p_invoice->>'payment_terms', payment_terms),
    bank_account_id = case
      when p_invoice ? 'bank_account_id' then nullif(trim(p_invoice->>'bank_account_id'), '')
      else bank_account_id
    end,
    updated_at = coalesce((p_invoice->>'updated_at')::timestamptz, v_now),
    updated_by = v_uid
  where id = p_invoice_id
    and company_id = v_company_id;

  if not found then
    raise exception 'invoice update failed';
  end if;

  delete from public.invoice_items
  where invoice_id = p_invoice_id
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
      raise exception 'invoice item id required';
    end if;
    if v_name is null then
      raise exception 'invoice item name required';
    end if;
    if v_qty < 1 then
      raise exception 'invoice item quantity must be >= 1';
    end if;

    insert into public.invoice_items (
      id,
      company_id,
      invoice_id,
      quote_item_id,
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
      p_invoice_id,
      nullif(trim(v_item->>'quote_item_id'), ''),
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

  select to_jsonb(i.*)
    into v_parent_json
  from public.invoices i
  where i.id = p_invoice_id
    and i.company_id = v_company_id;

  select coalesce(
    jsonb_agg(to_jsonb(it.*) order by it.sort_order, it.id),
    '[]'::jsonb
  )
    into v_items_json
  from public.invoice_items it
  where it.invoice_id = p_invoice_id
    and it.company_id = v_company_id;

  return jsonb_build_object(
    'invoice', v_parent_json,
    'items', v_items_json
  );
end;
$$;

revoke all on function public.update_invoice_with_items(text, jsonb, jsonb) from public;
grant execute on function public.update_invoice_with_items(text, jsonb, jsonb) to authenticated;

comment on function public.update_invoice_with_items(text, jsonb, jsonb) is
  'Atomically update an invoice and replace its line items within the caller company scope.';


-- ============================================================================
-- order
-- ============================================================================
create or replace function public.update_order_with_items(
  p_order_id text,
  p_order jsonb,
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
  v_parent public.orders%rowtype;
  v_item jsonb;
  v_item_id text;
  v_name text;
  v_qty numeric;
  v_unit_price numeric;
  v_sort integer;
  v_parent_json jsonb;
  v_items_json jsonb;
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
    raise exception 'permission denied to update order'
      using errcode = '42501';
  end if;

  if p_order_id is null or length(trim(p_order_id)) = 0 then
    raise exception 'order id required';
  end if;

  if p_order is null or jsonb_typeof(p_order) <> 'object' then
    raise exception 'order payload required';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'order items payload required';
  end if;

  select *
    into v_parent
  from public.orders t
  where t.id = p_order_id
    and t.company_id = v_company_id
  for update;

  if not found then
    raise exception 'order not found'
      using errcode = 'P0002';
  end if;

  update public.orders set
    project_id = coalesce(nullif(trim(p_order->>'project_id'), ''), project_id),
    customer_id = coalesce(nullif(trim(p_order->>'customer_id'), ''), customer_id),
    quote_id = coalesce(p_order->>'quote_id', quote_id),
    recipient_name = coalesce(p_order->>'recipient_name', recipient_name),
    issue_date = coalesce((p_order->>'issue_date')::date, issue_date),
    payment_terms = coalesce(p_order->>'payment_terms', payment_terms),
    status = coalesce(nullif(trim(p_order->>'status'), ''), status),
    subtotal = coalesce((p_order->>'subtotal')::numeric, subtotal),
    tax_amount = coalesce((p_order->>'tax_amount')::numeric, tax_amount),
    total_amount = coalesce((p_order->>'total_amount')::numeric, total_amount),
    discount_label = coalesce(p_order->>'discount_label', discount_label),
    discount_amount = coalesce((p_order->>'discount_amount')::numeric, discount_amount),
    customer_contact_name = case
      when p_order ? 'customer_contact_name' then nullif(p_order->>'customer_contact_name', '')
      else customer_contact_name
    end,
    customer_department = case
      when p_order ? 'customer_department' then nullif(p_order->>'customer_department', '')
      else customer_department
    end,
    customer_position = case
      when p_order ? 'customer_position' then nullif(p_order->>'customer_position', '')
      else customer_position
    end,
    memo = coalesce(p_order->>'memo', memo),
    updated_at = coalesce((p_order->>'updated_at')::timestamptz, v_now),
    updated_by = v_uid
  where id = p_order_id
    and company_id = v_company_id;

  if not found then
    raise exception 'order update failed';
  end if;

  delete from public.order_items
  where order_id = p_order_id
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
      raise exception 'order item id required';
    end if;
    if v_name is null then
      raise exception 'order item name required';
    end if;

    insert into public.order_items (
      id,
      company_id,
      order_id,
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
      p_order_id,
      nullif(trim(v_item->>'item_template_id'), ''),
      v_name,
      coalesce(v_item->>'description', ''),
      coalesce(v_item->>'width', ''),
      coalesce(v_item->>'height', ''),
      v_qty,
      coalesce(nullif(trim(v_item->>'unit'), ''), '式'),
      v_unit_price,
      coalesce((v_item->>'tax_rate')::numeric, 0.1),
      coalesce((v_item->>'amount')::numeric, v_qty * v_unit_price),
      v_sort,
      coalesce((v_item->>'created_at')::timestamptz, v_now),
      coalesce((v_item->>'updated_at')::timestamptz, v_now)
    );
  end loop;

  select to_jsonb(t.*)
    into v_parent_json
  from public.orders t
  where t.id = p_order_id
    and t.company_id = v_company_id;

  select coalesce(
    jsonb_agg(to_jsonb(it.*) order by it.sort_order, it.id),
    '[]'::jsonb
  )
    into v_items_json
  from public.order_items it
  where it.order_id = p_order_id
    and it.company_id = v_company_id;

  return jsonb_build_object(
    'order', v_parent_json,
    'items', v_items_json
  );
end;
$$;

revoke all on function public.update_order_with_items(text, jsonb, jsonb) from public;
grant execute on function public.update_order_with_items(text, jsonb, jsonb) to authenticated;

comment on function public.update_order_with_items(text, jsonb, jsonb) is
  'Atomically update a order and replace its line items within the caller company scope.';

-- ============================================================================
-- delivery_note
-- ============================================================================
create or replace function public.update_delivery_note_with_items(
  p_delivery_note_id text,
  p_delivery_note jsonb,
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
  v_parent public.delivery_notes%rowtype;
  v_item jsonb;
  v_item_id text;
  v_name text;
  v_qty numeric;
  v_unit_price numeric;
  v_sort integer;
  v_parent_json jsonb;
  v_items_json jsonb;
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
    raise exception 'permission denied to update delivery_note'
      using errcode = '42501';
  end if;

  if p_delivery_note_id is null or length(trim(p_delivery_note_id)) = 0 then
    raise exception 'delivery_note id required';
  end if;

  if p_delivery_note is null or jsonb_typeof(p_delivery_note) <> 'object' then
    raise exception 'delivery_note payload required';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'delivery_note items payload required';
  end if;

  select *
    into v_parent
  from public.delivery_notes t
  where t.id = p_delivery_note_id
    and t.company_id = v_company_id
  for update;

  if not found then
    raise exception 'delivery_note not found'
      using errcode = 'P0002';
  end if;

  update public.delivery_notes set
    project_id = coalesce(nullif(trim(p_delivery_note->>'project_id'), ''), project_id),
    customer_id = coalesce(nullif(trim(p_delivery_note->>'customer_id'), ''), customer_id),
    order_id = coalesce(p_delivery_note->>'order_id', order_id),
    issue_date = coalesce((p_delivery_note->>'issue_date')::date, issue_date),
    payment_terms = coalesce(p_delivery_note->>'payment_terms', payment_terms),
    status = coalesce(nullif(trim(p_delivery_note->>'status'), ''), status),
    subtotal = coalesce((p_delivery_note->>'subtotal')::numeric, subtotal),
    tax_amount = coalesce((p_delivery_note->>'tax_amount')::numeric, tax_amount),
    total_amount = coalesce((p_delivery_note->>'total_amount')::numeric, total_amount),
    discount_label = coalesce(p_delivery_note->>'discount_label', discount_label),
    discount_amount = coalesce((p_delivery_note->>'discount_amount')::numeric, discount_amount),
    customer_honorific = coalesce(
      nullif(trim(p_delivery_note->>'customer_honorific'), ''),
      customer_honorific
    ),
    customer_contact_name = case
      when p_delivery_note ? 'customer_contact_name' then nullif(p_delivery_note->>'customer_contact_name', '')
      else customer_contact_name
    end,
    customer_department = case
      when p_delivery_note ? 'customer_department' then nullif(p_delivery_note->>'customer_department', '')
      else customer_department
    end,
    customer_position = case
      when p_delivery_note ? 'customer_position' then nullif(p_delivery_note->>'customer_position', '')
      else customer_position
    end,
    memo = coalesce(p_delivery_note->>'memo', memo),
    updated_at = coalesce((p_delivery_note->>'updated_at')::timestamptz, v_now),
    updated_by = v_uid
  where id = p_delivery_note_id
    and company_id = v_company_id;

  if not found then
    raise exception 'delivery_note update failed';
  end if;

  delete from public.delivery_note_items
  where delivery_note_id = p_delivery_note_id
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
      raise exception 'delivery_note item id required';
    end if;
    if v_name is null then
      raise exception 'delivery_note item name required';
    end if;

    insert into public.delivery_note_items (
      id,
      company_id,
      delivery_note_id,
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
      p_delivery_note_id,
      nullif(trim(v_item->>'item_template_id'), ''),
      v_name,
      coalesce(v_item->>'description', ''),
      coalesce(v_item->>'width', ''),
      coalesce(v_item->>'height', ''),
      v_qty,
      coalesce(nullif(trim(v_item->>'unit'), ''), '式'),
      v_unit_price,
      coalesce((v_item->>'tax_rate')::numeric, 0.1),
      coalesce((v_item->>'amount')::numeric, v_qty * v_unit_price),
      v_sort,
      coalesce((v_item->>'created_at')::timestamptz, v_now),
      coalesce((v_item->>'updated_at')::timestamptz, v_now)
    );
  end loop;

  select to_jsonb(t.*)
    into v_parent_json
  from public.delivery_notes t
  where t.id = p_delivery_note_id
    and t.company_id = v_company_id;

  select coalesce(
    jsonb_agg(to_jsonb(it.*) order by it.sort_order, it.id),
    '[]'::jsonb
  )
    into v_items_json
  from public.delivery_note_items it
  where it.delivery_note_id = p_delivery_note_id
    and it.company_id = v_company_id;

  return jsonb_build_object(
    'delivery_note', v_parent_json,
    'items', v_items_json
  );
end;
$$;

revoke all on function public.update_delivery_note_with_items(text, jsonb, jsonb) from public;
grant execute on function public.update_delivery_note_with_items(text, jsonb, jsonb) to authenticated;

comment on function public.update_delivery_note_with_items(text, jsonb, jsonb) is
  'Atomically update a delivery_note and replace its line items within the caller company scope.';

-- ============================================================================
-- receipt
-- ============================================================================
create or replace function public.update_receipt_with_items(
  p_receipt_id text,
  p_receipt jsonb,
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
  v_parent public.receipts%rowtype;
  v_item jsonb;
  v_item_id text;
  v_name text;
  v_qty numeric;
  v_unit_price numeric;
  v_sort integer;
  v_parent_json jsonb;
  v_items_json jsonb;
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
    raise exception 'permission denied to update receipt'
      using errcode = '42501';
  end if;

  if p_receipt_id is null or length(trim(p_receipt_id)) = 0 then
    raise exception 'receipt id required';
  end if;

  if p_receipt is null or jsonb_typeof(p_receipt) <> 'object' then
    raise exception 'receipt payload required';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'receipt items payload required';
  end if;

  select *
    into v_parent
  from public.receipts t
  where t.id = p_receipt_id
    and t.company_id = v_company_id
  for update;

  if not found then
    raise exception 'receipt not found'
      using errcode = 'P0002';
  end if;

  update public.receipts set
    project_id = coalesce(nullif(trim(p_receipt->>'project_id'), ''), project_id),
    customer_id = coalesce(nullif(trim(p_receipt->>'customer_id'), ''), customer_id),
    invoice_id = coalesce(p_receipt->>'invoice_id', invoice_id),
    issue_date = coalesce((p_receipt->>'issue_date')::date, issue_date),
    payment_terms = coalesce(p_receipt->>'payment_terms', payment_terms),
    status = coalesce(nullif(trim(p_receipt->>'status'), ''), status),
    subtotal = coalesce((p_receipt->>'subtotal')::numeric, subtotal),
    tax_amount = coalesce((p_receipt->>'tax_amount')::numeric, tax_amount),
    total_amount = coalesce((p_receipt->>'total_amount')::numeric, total_amount),
    discount_label = coalesce(p_receipt->>'discount_label', discount_label),
    discount_amount = coalesce((p_receipt->>'discount_amount')::numeric, discount_amount),
    customer_honorific = coalesce(
      nullif(trim(p_receipt->>'customer_honorific'), ''),
      customer_honorific
    ),
    customer_contact_name = case
      when p_receipt ? 'customer_contact_name' then nullif(p_receipt->>'customer_contact_name', '')
      else customer_contact_name
    end,
    customer_department = case
      when p_receipt ? 'customer_department' then nullif(p_receipt->>'customer_department', '')
      else customer_department
    end,
    customer_position = case
      when p_receipt ? 'customer_position' then nullif(p_receipt->>'customer_position', '')
      else customer_position
    end,
    memo = coalesce(p_receipt->>'memo', memo),
    updated_at = coalesce((p_receipt->>'updated_at')::timestamptz, v_now),
    updated_by = v_uid
  where id = p_receipt_id
    and company_id = v_company_id;

  if not found then
    raise exception 'receipt update failed';
  end if;

  delete from public.receipt_items
  where receipt_id = p_receipt_id
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
      raise exception 'receipt item id required';
    end if;
    if v_name is null then
      raise exception 'receipt item name required';
    end if;

    insert into public.receipt_items (
      id,
      company_id,
      receipt_id,
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
      p_receipt_id,
      nullif(trim(v_item->>'item_template_id'), ''),
      v_name,
      coalesce(v_item->>'description', ''),
      coalesce(v_item->>'width', ''),
      coalesce(v_item->>'height', ''),
      v_qty,
      coalesce(nullif(trim(v_item->>'unit'), ''), '式'),
      v_unit_price,
      coalesce((v_item->>'tax_rate')::numeric, 0.1),
      coalesce((v_item->>'amount')::numeric, v_qty * v_unit_price),
      v_sort,
      coalesce((v_item->>'created_at')::timestamptz, v_now),
      coalesce((v_item->>'updated_at')::timestamptz, v_now)
    );
  end loop;

  select to_jsonb(t.*)
    into v_parent_json
  from public.receipts t
  where t.id = p_receipt_id
    and t.company_id = v_company_id;

  select coalesce(
    jsonb_agg(to_jsonb(it.*) order by it.sort_order, it.id),
    '[]'::jsonb
  )
    into v_items_json
  from public.receipt_items it
  where it.receipt_id = p_receipt_id
    and it.company_id = v_company_id;

  return jsonb_build_object(
    'receipt', v_parent_json,
    'items', v_items_json
  );
end;
$$;

revoke all on function public.update_receipt_with_items(text, jsonb, jsonb) from public;
grant execute on function public.update_receipt_with_items(text, jsonb, jsonb) to authenticated;

comment on function public.update_receipt_with_items(text, jsonb, jsonb) is
  'Atomically update a receipt and replace its line items within the caller company scope.';

-- ============================================================================
-- recurring_billing
-- ============================================================================
create or replace function public.update_recurring_billing_with_items(
  p_recurring_billing_id text,
  p_recurring_billing jsonb,
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
  v_parent public.recurring_billings%rowtype;
  v_item jsonb;
  v_item_id text;
  v_name text;
  v_qty numeric;
  v_unit_price numeric;
  v_sort integer;
  v_parent_json jsonb;
  v_items_json jsonb;
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
    raise exception 'permission denied to update recurring billing'
      using errcode = '42501';
  end if;

  if p_recurring_billing_id is null or length(trim(p_recurring_billing_id)) = 0 then
    raise exception 'recurring billing id required';
  end if;

  if p_recurring_billing is null or jsonb_typeof(p_recurring_billing) <> 'object' then
    raise exception 'recurring billing payload required';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'recurring billing items payload required';
  end if;

  select *
    into v_parent
  from public.recurring_billings r
  where r.id = p_recurring_billing_id
    and r.company_id = v_company_id
  for update;

  if not found then
    raise exception 'recurring billing not found'
      using errcode = 'P0002';
  end if;

  if v_parent.status = 'ended' then
    raise exception 'recurring billing is ended'
      using errcode = 'P0001';
  end if;

  update public.recurring_billings set
    customer_id = coalesce(nullif(trim(p_recurring_billing->>'customer_id'), ''), customer_id),
    title = coalesce(nullif(trim(p_recurring_billing->>'title'), ''), title),
    billing_day = coalesce((p_recurring_billing->>'billing_day')::smallint, billing_day),
    next_billing_date = coalesce((p_recurring_billing->>'next_billing_date')::date, next_billing_date),
    status = coalesce(nullif(trim(p_recurring_billing->>'status'), ''), status),
    subtotal = coalesce((p_recurring_billing->>'subtotal')::numeric, subtotal),
    tax_amount = coalesce((p_recurring_billing->>'tax_amount')::numeric, tax_amount),
    total_amount = coalesce((p_recurring_billing->>'total_amount')::numeric, total_amount),
    memo = coalesce(p_recurring_billing->>'memo', memo),
    updated_at = coalesce((p_recurring_billing->>'updated_at')::timestamptz, v_now)
  where id = p_recurring_billing_id
    and company_id = v_company_id;

  if not found then
    raise exception 'recurring billing update failed';
  end if;

  delete from public.recurring_billing_items
  where recurring_billing_id = p_recurring_billing_id
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
      raise exception 'recurring billing item id required';
    end if;
    if v_name is null then
      raise exception 'recurring billing item name required';
    end if;

    insert into public.recurring_billing_items (
      id,
      company_id,
      recurring_billing_id,
      item_template_id,
      name,
      description,
      quantity,
      unit_price,
      tax_rate,
      amount,
      sort_order,
      created_at,
      updated_at
    ) values (
      v_item_id,
      v_company_id,
      p_recurring_billing_id,
      nullif(trim(v_item->>'item_template_id'), ''),
      v_name,
      coalesce(v_item->>'description', ''),
      v_qty,
      v_unit_price,
      coalesce((v_item->>'tax_rate')::numeric, 0.1),
      coalesce((v_item->>'amount')::numeric, v_qty * v_unit_price),
      v_sort,
      coalesce((v_item->>'created_at')::timestamptz, v_now),
      coalesce((v_item->>'updated_at')::timestamptz, v_now)
    );
  end loop;

  select to_jsonb(r.*)
    into v_parent_json
  from public.recurring_billings r
  where r.id = p_recurring_billing_id
    and r.company_id = v_company_id;

  select coalesce(
    jsonb_agg(to_jsonb(it.*) order by it.sort_order, it.id),
    '[]'::jsonb
  )
    into v_items_json
  from public.recurring_billing_items it
  where it.recurring_billing_id = p_recurring_billing_id
    and it.company_id = v_company_id;

  return jsonb_build_object(
    'recurring_billing', v_parent_json,
    'items', v_items_json
  );
end;
$$;

revoke all on function public.update_recurring_billing_with_items(text, jsonb, jsonb) from public;
grant execute on function public.update_recurring_billing_with_items(text, jsonb, jsonb) to authenticated;

comment on function public.update_recurring_billing_with_items(text, jsonb, jsonb) is
  'Atomically update a recurring billing and replace its line items within the caller company scope.';

-- ---------------------------------------------------------------------------
-- 確認用 SQL（SELECT のみ）
-- ---------------------------------------------------------------------------
-- select p.proname, pg_get_function_identity_arguments(p.oid) as args
-- from pg_proc p
-- join pg_namespace n on n.oid = p.pronamespace
-- where n.nspname = 'public'
--   and p.proname in (
--     'update_invoice_with_items',
--     'update_order_with_items',
--     'update_delivery_note_with_items',
--     'update_receipt_with_items',
--     'update_recurring_billing_with_items'
--   )
-- order by 1;
