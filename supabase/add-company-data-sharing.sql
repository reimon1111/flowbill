-- 業務データの会社単位共有: company_id 整合性バックフィル + RLS 再適用
-- 前提: add-multi-tenant.sql を先に適用してください
-- Supabase SQL Editor で実行

-- ---------------------------------------------------------------------------
-- current_company_id: プロフィール + メンバーシップを考慮
-- 招待メンバーが個人用会社(owner)とチーム会社(member)の両方にいる場合、
-- チーム側を優先する
-- ---------------------------------------------------------------------------
create or replace function public.current_company_id()
returns text
language sql
stable
security definer
set search_path = public
as $$
  with memberships as (
    select m.company_id, m.role, m.joined_at
    from public.company_members m
    where m.user_id = auth.uid()
      and m.status = 'active'
  ),
  team as (
    select company_id
    from memberships
    where role <> 'owner'
    order by joined_at asc
    limit 1
  ),
  profile_match as (
    select p.company_id
    from public.profiles p
    where p.user_id = auth.uid()
      and public.is_company_member(p.company_id)
    limit 1
  ),
  fallback as (
    select company_id
    from memberships
    order by joined_at asc
    limit 1
  )
  select coalesce(
    (select company_id from team),
    (select company_id from profile_match),
    (select company_id from fallback)
  );
$$;

-- ---------------------------------------------------------------------------
-- profiles.company_id をチーム会社に同期（個人用 owner 会社より優先）
-- ---------------------------------------------------------------------------
update public.profiles p
set company_id = sub.team_company_id,
    updated_at = now()
from (
  select
    m.user_id,
    (
      select m2.company_id
      from public.company_members m2
      where m2.user_id = m.user_id
        and m2.status = 'active'
        and m2.role <> 'owner'
      order by m2.joined_at asc
      limit 1
    ) as team_company_id
  from public.company_members m
  where m.status = 'active'
  group by m.user_id
) sub
where p.user_id = sub.user_id
  and sub.team_company_id is not null
  and p.company_id is distinct from sub.team_company_id;

-- ---------------------------------------------------------------------------
-- company_id バックフィル（親レコードから整合）
-- ---------------------------------------------------------------------------

-- projects ← customers
update public.projects p
set company_id = c.company_id,
    updated_at = now()
from public.customers c
where p.customer_id = c.id
  and p.company_id is distinct from c.company_id;

-- projects ← quotes / invoices（案件の company_id を書類側に合わせる）
update public.projects p
set company_id = q.company_id,
    updated_at = now()
from public.quotes q
where q.project_id = p.id
  and p.company_id is distinct from q.company_id;

update public.projects p
set company_id = i.company_id,
    updated_at = now()
from public.invoices i
where i.project_id = p.id
  and p.company_id is distinct from i.company_id;

-- 子テーブル ← projects
update public.project_histories h
set company_id = p.company_id
from public.projects p
where h.project_id = p.id
  and h.company_id is distinct from p.company_id;

update public.project_items pi
set company_id = p.company_id,
    updated_at = now()
from public.projects p
where pi.project_id = p.id
  and pi.company_id is distinct from p.company_id;

update public.quotes q
set company_id = p.company_id,
    updated_at = now()
from public.projects p
where q.project_id = p.id
  and q.company_id is distinct from p.company_id;

update public.invoices i
set company_id = p.company_id,
    updated_at = now()
from public.projects p
where i.project_id = p.id
  and i.company_id is distinct from p.company_id;

update public.orders o
set company_id = p.company_id,
    updated_at = now()
from public.projects p
where o.project_id = p.id
  and o.company_id is distinct from p.company_id;

update public.delivery_notes d
set company_id = p.company_id,
    updated_at = now()
from public.projects p
where d.project_id = p.id
  and d.company_id is distinct from p.company_id;

update public.receipts r
set company_id = p.company_id,
    updated_at = now()
from public.projects p
where r.project_id = p.id
  and r.company_id is distinct from p.company_id;

-- 明細 ← 親書類
update public.quote_items qi
set company_id = q.company_id
from public.quotes q
where qi.quote_id = q.id
  and qi.company_id is distinct from q.company_id;

update public.invoice_items ii
set company_id = i.company_id
from public.invoices i
where ii.invoice_id = i.id
  and ii.company_id is distinct from i.company_id;

update public.order_items oi
set company_id = o.company_id
from public.orders o
where oi.order_id = o.id
  and oi.company_id is distinct from o.company_id;

update public.delivery_note_items di
set company_id = d.company_id
from public.delivery_notes d
where di.delivery_note_id = d.id
  and di.company_id is distinct from d.company_id;

update public.receipt_items ri
set company_id = r.company_id
from public.receipts r
where ri.receipt_id = r.id
  and ri.company_id is distinct from r.company_id;

update public.recurring_billing_items rbi
set company_id = rb.company_id
from public.recurring_billings rb
where rbi.recurring_billing_id = rb.id
  and rbi.company_id is distinct from rb.company_id;

-- ---------------------------------------------------------------------------
-- 業務テーブル RLS（会社メンバー全員が select、member 以上が insert/update）
-- viewer は閲覧のみ
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'customers', 'item_templates', 'item_template_categories',
    'projects', 'project_histories', 'project_items',
    'quotes', 'quote_items', 'invoices', 'invoice_items',
    'orders', 'order_items', 'delivery_notes', 'delivery_note_items',
    'receipts', 'receipt_items',
    'recurring_billings', 'recurring_billing_items'
  ]
  loop
    execute format('drop policy if exists %I_select on public.%I', t, t);
    execute format('drop policy if exists %I_insert on public.%I', t, t);
    execute format('drop policy if exists %I_update on public.%I', t, t);
    execute format('drop policy if exists %I_delete on public.%I', t, t);

    execute format(
      'create policy %I_select on public.%I for select using (
        company_id = public.current_company_id()
        and public.is_company_member(company_id)
      )',
      t, t
    );
    execute format(
      'create policy %I_insert on public.%I for insert with check (
        company_id = public.current_company_id()
        and public.can_write_company_data(company_id)
      )',
      t, t
    );
    execute format(
      'create policy %I_update on public.%I for update using (
        company_id = public.current_company_id()
        and public.can_write_company_data(company_id)
      ) with check (
        company_id = public.current_company_id()
        and public.can_write_company_data(company_id)
      )',
      t, t
    );
    execute format(
      'create policy %I_delete on public.%I for delete using (
        company_id = public.current_company_id()
        and public.can_write_company_data(company_id)
      )',
      t, t
    );
  end loop;
end $$;
