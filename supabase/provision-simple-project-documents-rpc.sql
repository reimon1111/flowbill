-- simple案件の帳票一式を1トランザクションで生成
-- Dashboard → SQL Editor で実行してください。
-- 依存: add-project-workflow-mode.sql / current_company_id() / can_write_company_data()
--
-- クライアントが既存番号発番・明細計算で組み立てた JSON を受け取り、
-- 見積・注文・納品・請求・領収を all-or-nothing で INSERT する。
-- 既に simple_documents_initialized_at がある場合は冪等に no-op。

create or replace function public.provision_simple_project_documents(
  p_project_id text,
  p_payload jsonb
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
  v_quote jsonb;
  v_order jsonb;
  v_delivery jsonb;
  v_invoice jsonb;
  v_receipt jsonb;
  v_item jsonb;
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
    raise exception 'permission denied to provision simple documents'
      using errcode = '42501';
  end if;

  if p_project_id is null or length(trim(p_project_id)) = 0 then
    raise exception 'project id required';
  end if;

  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'payload required';
  end if;

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

  if coalesce(v_project.workflow_mode, 'standard') <> 'simple' then
    raise exception 'project is not simple workflow'
      using errcode = '22023';
  end if;

  -- 冪等: 初期化済みなら既存を返す（二重生成しない）
  if v_project.simple_documents_initialized_at is not null then
    return jsonb_build_object(
      'already_initialized', true,
      'project_id', p_project_id,
      'initialized_at', v_project.simple_documents_initialized_at
    );
  end if;

  v_quote := p_payload->'quote';
  v_order := p_payload->'order';
  v_delivery := p_payload->'delivery_note';
  v_invoice := p_payload->'invoice';
  v_receipt := p_payload->'receipt';

  if v_quote is null or v_order is null or v_delivery is null
     or v_invoice is null or v_receipt is null then
    raise exception 'all five documents are required in payload';
  end if;

  -- 見積
  insert into public.quotes (
    id, company_id, project_id, customer_id, quote_number, issue_date,
    expiry_type, expiry_date, status, subtotal, tax_amount, total_amount,
    discount_label, discount_amount, customer_honorific,
    customer_contact_name, customer_department, customer_position,
    memo, memo_font_size, document_email, document_contact_name, payment_terms,
    created_by, updated_by, created_at, updated_at
  ) values (
    v_quote->>'id',
    v_company_id,
    p_project_id,
    v_quote->>'customer_id',
    v_quote->>'quote_number',
    (v_quote->>'issue_date')::date,
    nullif(v_quote->>'expiry_type', ''),
    nullif(v_quote->>'expiry_date', '')::date,
    coalesce(nullif(v_quote->>'status', ''), 'draft'),
    coalesce((v_quote->>'subtotal')::numeric, 0),
    coalesce((v_quote->>'tax_amount')::numeric, 0),
    coalesce((v_quote->>'total_amount')::numeric, 0),
    coalesce(v_quote->>'discount_label', ''),
    coalesce((v_quote->>'discount_amount')::numeric, 0),
    coalesce(nullif(v_quote->>'customer_honorific', ''), '御中'),
    nullif(v_quote->>'customer_contact_name', ''),
    nullif(v_quote->>'customer_department', ''),
    nullif(v_quote->>'customer_position', ''),
    coalesce(v_quote->>'memo', ''),
    coalesce(nullif(v_quote->>'memo_font_size', ''), 'normal'),
    coalesce(v_quote->>'document_email', ''),
    coalesce(v_quote->>'document_contact_name', ''),
    coalesce(v_quote->>'payment_terms', ''),
    v_uid,
    v_uid,
    coalesce((v_quote->>'created_at')::timestamptz, v_now),
    coalesce((v_quote->>'updated_at')::timestamptz, v_now)
  );

  for v_item in
    select * from jsonb_array_elements(coalesce(p_payload->'quote_items', '[]'::jsonb))
  loop
    insert into public.quote_items (
      id, company_id, quote_id, item_template_id, name, description,
      width, height, quantity, unit, unit_price, tax_rate, amount, sort_order,
      created_at, updated_at
    ) values (
      v_item->>'id',
      v_company_id,
      v_quote->>'id',
      nullif(v_item->>'item_template_id', ''),
      v_item->>'name',
      coalesce(v_item->>'description', ''),
      coalesce(v_item->>'width', ''),
      coalesce(v_item->>'height', ''),
      coalesce((v_item->>'quantity')::numeric, 1),
      coalesce(nullif(v_item->>'unit', ''), '式'),
      coalesce((v_item->>'unit_price')::numeric, 0),
      coalesce((v_item->>'tax_rate')::numeric, 0.1),
      coalesce((v_item->>'amount')::numeric, 0),
      coalesce((v_item->>'sort_order')::integer, 0),
      coalesce((v_item->>'created_at')::timestamptz, v_now),
      coalesce((v_item->>'updated_at')::timestamptz, v_now)
    );
  end loop;

  -- 注文書
  insert into public.orders (
    id, company_id, project_id, customer_id, quote_id, order_number, issue_date,
    payment_terms, status, subtotal, tax_amount, total_amount,
    discount_label, discount_amount,
    customer_contact_name, customer_department, customer_position,
    memo, memo_font_size, document_email, document_contact_name, recipient_name,
    deleted_at, created_by, updated_by, created_at, updated_at
  ) values (
    v_order->>'id',
    v_company_id,
    p_project_id,
    v_order->>'customer_id',
    coalesce(v_order->>'quote_id', ''),
    v_order->>'order_number',
    (v_order->>'issue_date')::date,
    coalesce(v_order->>'payment_terms', ''),
    coalesce(nullif(v_order->>'status', ''), 'draft'),
    coalesce((v_order->>'subtotal')::numeric, 0),
    coalesce((v_order->>'tax_amount')::numeric, 0),
    coalesce((v_order->>'total_amount')::numeric, 0),
    coalesce(v_order->>'discount_label', ''),
    coalesce((v_order->>'discount_amount')::numeric, 0),
    nullif(v_order->>'customer_contact_name', ''),
    nullif(v_order->>'customer_department', ''),
    nullif(v_order->>'customer_position', ''),
    coalesce(v_order->>'memo', ''),
    coalesce(nullif(v_order->>'memo_font_size', ''), 'normal'),
    coalesce(v_order->>'document_email', ''),
    coalesce(v_order->>'document_contact_name', ''),
    coalesce(v_order->>'recipient_name', ''),
    null,
    v_uid,
    v_uid,
    coalesce((v_order->>'created_at')::timestamptz, v_now),
    coalesce((v_order->>'updated_at')::timestamptz, v_now)
  );

  for v_item in
    select * from jsonb_array_elements(coalesce(p_payload->'order_items', '[]'::jsonb))
  loop
    insert into public.order_items (
      id, company_id, order_id, item_template_id, name, description,
      width, height, quantity, unit, unit_price, tax_rate, amount, sort_order,
      created_at, updated_at
    ) values (
      v_item->>'id',
      v_company_id,
      v_order->>'id',
      nullif(v_item->>'item_template_id', ''),
      v_item->>'name',
      coalesce(v_item->>'description', ''),
      coalesce(v_item->>'width', ''),
      coalesce(v_item->>'height', ''),
      coalesce((v_item->>'quantity')::numeric, 1),
      coalesce(nullif(v_item->>'unit', ''), '式'),
      coalesce((v_item->>'unit_price')::numeric, 0),
      coalesce((v_item->>'tax_rate')::numeric, 0.1),
      coalesce((v_item->>'amount')::numeric, 0),
      coalesce((v_item->>'sort_order')::integer, 0),
      coalesce((v_item->>'created_at')::timestamptz, v_now),
      coalesce((v_item->>'updated_at')::timestamptz, v_now)
    );
  end loop;

  -- 納品書（simple初期は draft）
  insert into public.delivery_notes (
    id, company_id, project_id, customer_id, order_id, delivery_note_number, issue_date,
    payment_terms, status, subtotal, tax_amount, total_amount,
    discount_label, discount_amount, customer_honorific,
    customer_contact_name, customer_department, customer_position,
    memo, memo_font_size, document_email, document_contact_name,
    deleted_at, created_by, updated_by, created_at, updated_at
  ) values (
    v_delivery->>'id',
    v_company_id,
    p_project_id,
    v_delivery->>'customer_id',
    coalesce(v_delivery->>'order_id', ''),
    v_delivery->>'delivery_note_number',
    (v_delivery->>'issue_date')::date,
    coalesce(v_delivery->>'payment_terms', ''),
    coalesce(nullif(v_delivery->>'status', ''), 'draft'),
    coalesce((v_delivery->>'subtotal')::numeric, 0),
    coalesce((v_delivery->>'tax_amount')::numeric, 0),
    coalesce((v_delivery->>'total_amount')::numeric, 0),
    coalesce(v_delivery->>'discount_label', ''),
    coalesce((v_delivery->>'discount_amount')::numeric, 0),
    coalesce(nullif(v_delivery->>'customer_honorific', ''), '御中'),
    nullif(v_delivery->>'customer_contact_name', ''),
    nullif(v_delivery->>'customer_department', ''),
    nullif(v_delivery->>'customer_position', ''),
    coalesce(v_delivery->>'memo', ''),
    coalesce(nullif(v_delivery->>'memo_font_size', ''), 'normal'),
    coalesce(v_delivery->>'document_email', ''),
    coalesce(v_delivery->>'document_contact_name', ''),
    null,
    v_uid,
    v_uid,
    coalesce((v_delivery->>'created_at')::timestamptz, v_now),
    coalesce((v_delivery->>'updated_at')::timestamptz, v_now)
  );

  for v_item in
    select * from jsonb_array_elements(coalesce(p_payload->'delivery_note_items', '[]'::jsonb))
  loop
    insert into public.delivery_note_items (
      id, company_id, delivery_note_id, item_template_id, name, description,
      width, height, quantity, unit, unit_price, tax_rate, amount, sort_order,
      created_at, updated_at
    ) values (
      v_item->>'id',
      v_company_id,
      v_delivery->>'id',
      nullif(v_item->>'item_template_id', ''),
      v_item->>'name',
      coalesce(v_item->>'description', ''),
      coalesce(v_item->>'width', ''),
      coalesce(v_item->>'height', ''),
      coalesce((v_item->>'quantity')::numeric, 1),
      coalesce(nullif(v_item->>'unit', ''), '式'),
      coalesce((v_item->>'unit_price')::numeric, 0),
      coalesce((v_item->>'tax_rate')::numeric, 0.1),
      coalesce((v_item->>'amount')::numeric, 0),
      coalesce((v_item->>'sort_order')::integer, 0),
      coalesce((v_item->>'created_at')::timestamptz, v_now),
      coalesce((v_item->>'updated_at')::timestamptz, v_now)
    );
  end loop;

  -- 請求書
  insert into public.invoices (
    id, company_id, project_id, customer_id, quote_id, invoice_number, issue_date,
    due_date, due_date_mode, status, subtotal, tax_amount, total_amount,
    discount_label, discount_amount, customer_honorific,
    customer_contact_name, customer_department, customer_position,
    pdf_url, payment_terms, bank_account_id, memo, memo_font_size,
    document_email, document_contact_name,
    deleted_at, created_by, updated_by, created_at, updated_at
  ) values (
    v_invoice->>'id',
    v_company_id,
    p_project_id,
    v_invoice->>'customer_id',
    coalesce(v_invoice->>'quote_id', ''),
    v_invoice->>'invoice_number',
    (v_invoice->>'issue_date')::date,
    nullif(v_invoice->>'due_date', '')::date,
    nullif(v_invoice->>'due_date_mode', ''),
    coalesce(nullif(v_invoice->>'status', ''), 'draft'),
    coalesce((v_invoice->>'subtotal')::numeric, 0),
    coalesce((v_invoice->>'tax_amount')::numeric, 0),
    coalesce((v_invoice->>'total_amount')::numeric, 0),
    coalesce(v_invoice->>'discount_label', ''),
    coalesce((v_invoice->>'discount_amount')::numeric, 0),
    coalesce(nullif(v_invoice->>'customer_honorific', ''), '御中'),
    nullif(v_invoice->>'customer_contact_name', ''),
    nullif(v_invoice->>'customer_department', ''),
    nullif(v_invoice->>'customer_position', ''),
    null,
    coalesce(v_invoice->>'payment_terms', ''),
    nullif(v_invoice->>'bank_account_id', ''),
    coalesce(v_invoice->>'memo', ''),
    coalesce(nullif(v_invoice->>'memo_font_size', ''), 'normal'),
    coalesce(v_invoice->>'document_email', ''),
    coalesce(v_invoice->>'document_contact_name', ''),
    null,
    v_uid,
    v_uid,
    coalesce((v_invoice->>'created_at')::timestamptz, v_now),
    coalesce((v_invoice->>'updated_at')::timestamptz, v_now)
  );

  for v_item in
    select * from jsonb_array_elements(coalesce(p_payload->'invoice_items', '[]'::jsonb))
  loop
    insert into public.invoice_items (
      id, company_id, invoice_id, quote_item_id, name, description,
      width, height, quantity, unit, unit_price, tax_rate, amount, sort_order,
      created_at, updated_at
    ) values (
      v_item->>'id',
      v_company_id,
      v_invoice->>'id',
      nullif(v_item->>'quote_item_id', ''),
      v_item->>'name',
      coalesce(v_item->>'description', ''),
      coalesce(v_item->>'width', ''),
      coalesce(v_item->>'height', ''),
      coalesce((v_item->>'quantity')::numeric, 1),
      coalesce(nullif(v_item->>'unit', ''), '式'),
      coalesce((v_item->>'unit_price')::numeric, 0),
      coalesce((v_item->>'tax_rate')::numeric, 0.1),
      coalesce((v_item->>'amount')::numeric, 0),
      coalesce((v_item->>'sort_order')::integer, 0),
      coalesce((v_item->>'created_at')::timestamptz, v_now),
      coalesce((v_item->>'updated_at')::timestamptz, v_now)
    );
  end loop;

  -- 領収書（simple初期は draft・請求に紐付け）
  insert into public.receipts (
    id, company_id, project_id, customer_id, invoice_id, receipt_number, issue_date,
    payment_terms, status, subtotal, tax_amount, total_amount,
    discount_label, discount_amount, customer_honorific,
    customer_contact_name, customer_department, customer_position,
    memo, memo_font_size, document_email, document_contact_name,
    deleted_at, created_by, updated_by, created_at, updated_at
  ) values (
    v_receipt->>'id',
    v_company_id,
    p_project_id,
    v_receipt->>'customer_id',
    coalesce(v_receipt->>'invoice_id', ''),
    v_receipt->>'receipt_number',
    (v_receipt->>'issue_date')::date,
    coalesce(v_receipt->>'payment_terms', ''),
    coalesce(nullif(v_receipt->>'status', ''), 'draft'),
    coalesce((v_receipt->>'subtotal')::numeric, 0),
    coalesce((v_receipt->>'tax_amount')::numeric, 0),
    coalesce((v_receipt->>'total_amount')::numeric, 0),
    coalesce(v_receipt->>'discount_label', ''),
    coalesce((v_receipt->>'discount_amount')::numeric, 0),
    coalesce(nullif(v_receipt->>'customer_honorific', ''), '御中'),
    nullif(v_receipt->>'customer_contact_name', ''),
    nullif(v_receipt->>'customer_department', ''),
    nullif(v_receipt->>'customer_position', ''),
    coalesce(v_receipt->>'memo', ''),
    coalesce(nullif(v_receipt->>'memo_font_size', ''), 'normal'),
    coalesce(v_receipt->>'document_email', ''),
    coalesce(v_receipt->>'document_contact_name', ''),
    null,
    v_uid,
    v_uid,
    coalesce((v_receipt->>'created_at')::timestamptz, v_now),
    coalesce((v_receipt->>'updated_at')::timestamptz, v_now)
  );

  for v_item in
    select * from jsonb_array_elements(coalesce(p_payload->'receipt_items', '[]'::jsonb))
  loop
    insert into public.receipt_items (
      id, company_id, receipt_id, item_template_id, name, description,
      width, height, quantity, unit, unit_price, tax_rate, amount, sort_order,
      created_at, updated_at
    ) values (
      v_item->>'id',
      v_company_id,
      v_receipt->>'id',
      nullif(v_item->>'item_template_id', ''),
      v_item->>'name',
      coalesce(v_item->>'description', ''),
      coalesce(v_item->>'width', ''),
      coalesce(v_item->>'height', ''),
      coalesce((v_item->>'quantity')::numeric, 1),
      coalesce(nullif(v_item->>'unit', ''), '式'),
      coalesce((v_item->>'unit_price')::numeric, 0),
      coalesce((v_item->>'tax_rate')::numeric, 0.1),
      coalesce((v_item->>'amount')::numeric, 0),
      coalesce((v_item->>'sort_order')::integer, 0),
      coalesce((v_item->>'created_at')::timestamptz, v_now),
      coalesce((v_item->>'updated_at')::timestamptz, v_now)
    );
  end loop;

  update public.projects
  set
    simple_documents_initialized_at = v_now,
    updated_at = v_now,
    updated_by = v_uid
  where id = p_project_id
    and company_id = v_company_id;

  return jsonb_build_object(
    'already_initialized', false,
    'project_id', p_project_id,
    'initialized_at', v_now,
    'quote_id', v_quote->>'id',
    'order_id', v_order->>'id',
    'delivery_note_id', v_delivery->>'id',
    'invoice_id', v_invoice->>'id',
    'receipt_id', v_receipt->>'id'
  );
end;
$$;

revoke all on function public.provision_simple_project_documents(text, jsonb) from public;
grant execute on function public.provision_simple_project_documents(text, jsonb) to authenticated;

comment on function public.provision_simple_project_documents(text, jsonb) is
  'simple案件の見積・注文・納品・請求・領収を1トランザクションで生成。冪等。';
