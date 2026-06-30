-- 更新履歴の見える化: created_by / updated_by 追加 + updated_at 自動更新
-- 既存環境に手動適用してください（このファイルは実行しません）

-- ---------------------------------------------------------------------------
-- customers / item_templates に監査列を追加（他テーブルは add-multi-tenant.sql）
-- ---------------------------------------------------------------------------
alter table public.customers
  add column if not exists created_by uuid references auth.users (id) on delete set null;

alter table public.customers
  add column if not exists updated_by uuid references auth.users (id) on delete set null;

alter table public.item_templates
  add column if not exists created_by uuid references auth.users (id) on delete set null;

alter table public.item_templates
  add column if not exists updated_by uuid references auth.users (id) on delete set null;

-- add-multi-tenant 未適用環境向け: 主要テーブルにも列を追加（存在する場合はスキップ）
do $$
declare
  t text;
begin
  foreach t in array array[
    'projects', 'quotes', 'invoices', 'orders', 'delivery_notes', 'receipts',
    'customers', 'item_templates'
  ]
  loop
    execute format(
      'alter table public.%I add column if not exists created_by uuid references auth.users (id) on delete set null',
      t
    );
    execute format(
      'alter table public.%I add column if not exists updated_by uuid references auth.users (id) on delete set null',
      t
    );
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- updated_at 自動更新トリガー
-- ---------------------------------------------------------------------------
create or replace function public.set_row_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'projects', 'quotes', 'invoices', 'orders', 'delivery_notes', 'receipts',
    'customers', 'item_templates'
  ]
  loop
    execute format('drop trigger if exists set_%I_updated_at on public.%I', t, t);
    execute format(
      'create trigger set_%I_updated_at before update on public.%I for each row execute function public.set_row_updated_at()',
      t,
      t
    );
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 監査表示用: 会社メンバーの表示名（profiles.email → auth.users.email）
-- ---------------------------------------------------------------------------
create or replace function public.resolve_audit_user_labels(p_user_ids uuid[])
returns table (
  user_id uuid,
  label text
)
language sql
stable
security definer
set search_path = public
as $$
  select distinct on (uid.user_id)
    uid.user_id,
    coalesce(nullif(trim(p.email), ''), u.email::text, '不明なユーザー') as label
  from unnest(coalesce(p_user_ids, array[]::uuid[])) as uid(user_id)
  left join public.profiles p on p.user_id = uid.user_id
  left join auth.users u on u.id = uid.user_id
  where uid.user_id is not null
    and (
      public.is_company_member(public.current_company_id())
      and (
        exists (
          select 1
          from public.company_members m
          where m.company_id = public.current_company_id()
            and m.user_id = uid.user_id
        )
        or p.company_id = public.current_company_id()
      )
    )
  order by uid.user_id, p.email nulls last;
$$;

revoke all on function public.resolve_audit_user_labels(uuid[]) from public;
grant execute on function public.resolve_audit_user_labels(uuid[]) to authenticated;
