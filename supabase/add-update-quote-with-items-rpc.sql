-- 見積書 + 明細の原子的更新 RPC
-- Dashboard → SQL Editor で実行してください。
--
-- 目的:
--   親 quotes UPDATE → quote_items DELETE → INSERT を1トランザクションで実行し、
--   INSERT 失敗時に既存明細が消える不整合を防ぐ。
--
-- 依存:
--   current_company_id(), can_write_company_data() が適用済みであること
--   （add-multi-tenant.sql / add-signup-access-control.sql 等）

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

  -- 自社の見積のみ（他社 quote_id は not found）
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

  -- 親見積更新（company_id / quote_number / status / created_* は維持）
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
    payment_terms = coalesce(p_quote->>'payment_terms', payment_terms),
    updated_at = coalesce((p_quote->>'updated_at')::timestamptz, v_now),
    updated_by = v_uid
  where id = p_quote_id
    and company_id = v_company_id;

  if not found then
    raise exception 'quote update failed';
  end if;

  -- 明細置換（同一トランザクション内）
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
  'Atomically update a quote and replace its line items within the caller company scope.';

-- ---------------------------------------------------------------------------
-- 確認用 SQL（SELECT のみ・データ変更なし）
-- ---------------------------------------------------------------------------
-- RPC の有無
-- select
--   p.proname,
--   pg_get_function_identity_arguments(p.oid) as args,
--   case when p.prosecdef then 'SECURITY DEFINER' else 'SECURITY INVOKER' end as security,
--   p.proconfig as config
-- from pg_proc p
-- join pg_namespace n on n.oid = p.pronamespace
-- where n.nspname = 'public'
--   and p.proname = 'update_quote_with_items';
--
-- 明細0件の見積（不整合チェック）
-- select q.id, q.quote_number, q.total_amount, count(qi.id) as item_count
-- from public.quotes q
-- left join public.quote_items qi on qi.quote_id = q.id
-- group by q.id, q.quote_number, q.total_amount
-- having count(qi.id) = 0;
