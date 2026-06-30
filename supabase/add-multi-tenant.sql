-- マルチテナント: company_members / company_invitations / RLS 強化
-- 既存環境: Supabase SQL Editor で実行してください

-- ---------------------------------------------------------------------------
-- company_members
-- ---------------------------------------------------------------------------
create table if not exists public.company_members (
  id text primary key,
  company_id text not null references public.companies (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'member', 'viewer')),
  status text not null default 'active' check (status in ('active', 'inactive')),
  invited_by uuid references auth.users (id) on delete set null,
  joined_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint company_members_company_user_unique unique (company_id, user_id)
);

create index if not exists company_members_company_id_idx on public.company_members (company_id);
create index if not exists company_members_user_id_idx on public.company_members (user_id);

-- ---------------------------------------------------------------------------
-- company_invitations
-- ---------------------------------------------------------------------------
create table if not exists public.company_invitations (
  id text primary key,
  company_id text not null references public.companies (id) on delete cascade,
  email text not null,
  role text not null check (role in ('admin', 'member', 'viewer')),
  token text not null unique,
  invited_by uuid not null references auth.users (id) on delete cascade,
  accepted_at timestamptz,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists company_invitations_company_id_idx on public.company_invitations (company_id);
create index if not exists company_invitations_token_idx on public.company_invitations (token);

create unique index if not exists company_invitations_pending_email_unique
  on public.company_invitations (company_id, lower(email))
  where accepted_at is null;

-- ---------------------------------------------------------------------------
-- 既存ユーザー → owner として company_members にバックフィル
-- ---------------------------------------------------------------------------
insert into public.company_members (
  id,
  company_id,
  user_id,
  role,
  status,
  joined_at,
  created_at,
  updated_at
)
select
  'cm_' || substr(md5(p.user_id::text || ':' || p.company_id), 1, 12),
  p.company_id,
  p.user_id,
  'owner',
  'active',
  coalesce(p.created_at, now()),
  coalesce(p.created_at, now()),
  coalesce(p.updated_at, now())
from public.profiles p
where not exists (
  select 1
  from public.company_members m
  where m.company_id = p.company_id and m.user_id = p.user_id
);

-- ---------------------------------------------------------------------------
-- created_by / updated_by（主要テーブル）
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'projects', 'quotes', 'invoices', 'orders', 'delivery_notes', 'receipts',
    'project_histories', 'recurring_billings'
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
-- RLS helper functions
-- ---------------------------------------------------------------------------
create or replace function public.is_company_member(p_company_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.company_members m
    where m.company_id = p_company_id
      and m.user_id = auth.uid()
      and m.status = 'active'
  );
$$;

create or replace function public.get_user_company_role(p_company_id text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select m.role
  from public.company_members m
  where m.company_id = p_company_id
    and m.user_id = auth.uid()
    and m.status = 'active'
  limit 1;
$$;

create or replace function public.can_manage_company(p_company_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.get_user_company_role(p_company_id) in ('owner', 'admin'), false);
$$;

create or replace function public.can_write_company_data(p_company_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    public.get_user_company_role(p_company_id) in ('owner', 'admin', 'member'),
    false
  );
$$;

-- profiles.company_id を現在の会社として返す（active メンバーシップ必須）
create or replace function public.current_company_id()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select p.company_id
  from public.profiles p
  where p.user_id = auth.uid()
    and public.is_company_member(p.company_id)
  limit 1;
$$;

-- ---------------------------------------------------------------------------
-- company_members RLS
-- ---------------------------------------------------------------------------
alter table public.company_members enable row level security;

drop policy if exists company_members_select on public.company_members;
drop policy if exists company_members_insert on public.company_members;
drop policy if exists company_members_update on public.company_members;
drop policy if exists company_members_delete on public.company_members;

create policy company_members_select on public.company_members
  for select using (public.is_company_member(company_id));

create policy company_members_insert on public.company_members
  for insert with check (
    public.can_manage_company(company_id)
    or (
      user_id = auth.uid()
      and role = 'owner'
      and not exists (
        select 1 from public.company_members m where m.company_id = company_members.company_id
      )
    )
  );

create policy company_members_update on public.company_members
  for update using (
    public.can_manage_company(company_id)
    and role <> 'owner'
  )
  with check (
    public.can_manage_company(company_id)
    and role <> 'owner'
  );

create policy company_members_delete on public.company_members
  for delete using (
    public.can_manage_company(company_id)
    and role <> 'owner'
    and user_id <> auth.uid()
  );

-- ---------------------------------------------------------------------------
-- company_invitations RLS
-- ---------------------------------------------------------------------------
alter table public.company_invitations enable row level security;

drop policy if exists company_invitations_select on public.company_invitations;
drop policy if exists company_invitations_insert on public.company_invitations;
drop policy if exists company_invitations_update on public.company_invitations;
drop policy if exists company_invitations_delete on public.company_invitations;

create policy company_invitations_select on public.company_invitations
  for select using (
    public.can_manage_company(company_id)
    or (
      lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      and accepted_at is null
    )
  );

create policy company_invitations_insert on public.company_invitations
  for insert with check (public.can_manage_company(company_id));

create policy company_invitations_update on public.company_invitations
  for update
  using (public.can_manage_company(company_id))
  with check (public.can_manage_company(company_id));

create policy company_invitations_delete on public.company_invitations
  for delete using (public.can_manage_company(company_id));

-- ---------------------------------------------------------------------------
-- companies: メンバーなら閲覧、admin/owner のみ更新
-- ---------------------------------------------------------------------------
drop policy if exists companies_insert_onboarding on public.companies;
drop policy if exists companies_select_member on public.companies;
drop policy if exists companies_update_admin on public.companies;
-- 旧ポリシー名（過去版との互換のため残す）
drop policy if exists companies_select_own on public.companies;
drop policy if exists companies_update_own on public.companies;

create policy companies_select_member on public.companies
  for select using (public.is_company_member(id));

create policy companies_update_admin on public.companies
  for update using (public.can_manage_company(id));

-- ---------------------------------------------------------------------------
-- テナントテーブル: viewer は閲覧のみ
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

-- ---------------------------------------------------------------------------
-- bank_accounts（会社設定扱い）: owner/admin のみ編集可
-- ---------------------------------------------------------------------------
drop policy if exists bank_accounts_select on public.bank_accounts;
drop policy if exists bank_accounts_insert on public.bank_accounts;
drop policy if exists bank_accounts_update on public.bank_accounts;
drop policy if exists bank_accounts_delete on public.bank_accounts;

create policy bank_accounts_select on public.bank_accounts
  for select using (
    company_id = public.current_company_id()
    and public.is_company_member(company_id)
  );

create policy bank_accounts_insert on public.bank_accounts
  for insert with check (
    company_id = public.current_company_id()
    and public.can_manage_company(company_id)
  );

create policy bank_accounts_update on public.bank_accounts
  for update using (
    company_id = public.current_company_id()
    and public.can_manage_company(company_id)
  ) with check (
    company_id = public.current_company_id()
    and public.can_manage_company(company_id)
  );

create policy bank_accounts_delete on public.bank_accounts
  for delete using (
    company_id = public.current_company_id()
    and public.can_manage_company(company_id)
  );

-- ---------------------------------------------------------------------------
-- RPC: 会社切替
-- ---------------------------------------------------------------------------
create or replace function public.switch_active_company(p_company_id text)
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  if not public.is_company_member(p_company_id) then
    raise exception 'not_a_member';
  end if;

  update public.profiles
  set company_id = p_company_id, updated_at = now()
  where user_id = auth.uid();

  return p_company_id;
end;
$$;

revoke all on function public.switch_active_company(text) from public;
grant execute on function public.switch_active_company(text) to authenticated;

-- ---------------------------------------------------------------------------
-- RPC: 招待受諾
-- ---------------------------------------------------------------------------
create or replace function public.accept_company_invitation(p_token text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inv public.company_invitations%rowtype;
  v_member_id text;
  v_email text;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  v_email := lower(coalesce(auth.jwt() ->> 'email', ''));

  select * into v_inv
  from public.company_invitations
  where token = p_token
  limit 1;

  if not found then
    raise exception 'invitation_not_found';
  end if;

  if v_inv.accepted_at is not null then
    raise exception 'invitation_already_accepted';
  end if;

  if v_inv.expires_at < now() then
    raise exception 'invitation_expired';
  end if;

  if lower(v_inv.email) <> v_email then
    raise exception 'email_mismatch';
  end if;

  if exists (
    select 1 from public.company_members m
    where m.company_id = v_inv.company_id and m.user_id = auth.uid()
  ) then
    update public.company_members
    set role = v_inv.role, status = 'active', updated_at = now()
    where company_id = v_inv.company_id and user_id = auth.uid();
  else
    v_member_id := 'cm_' || substr(md5(auth.uid()::text || ':' || v_inv.company_id || ':' || random()::text), 1, 12);
    insert into public.company_members (
      id, company_id, user_id, role, status, invited_by, joined_at, created_at, updated_at
    ) values (
      v_member_id,
      v_inv.company_id,
      auth.uid(),
      v_inv.role,
      'active',
      v_inv.invited_by,
      now(),
      now(),
      now()
    );
  end if;

  update public.company_invitations
  set accepted_at = now(), updated_at = now()
  where id = v_inv.id;

  update public.profiles
  set company_id = v_inv.company_id, updated_at = now()
  where user_id = auth.uid();

  return v_inv.company_id;
end;
$$;

revoke all on function public.accept_company_invitation(text) from public;
grant execute on function public.accept_company_invitation(text) to authenticated;

-- ---------------------------------------------------------------------------
-- RPC: 招待トークン検証（未ログインでも1件のみ取得可）
-- 重要: 一覧取得は不可。token 一致の1件のみ返す。
-- ---------------------------------------------------------------------------
create or replace function public.get_company_invitation_by_token(p_token text)
returns table (
  id text,
  company_id text,
  company_name text,
  email text,
  role text,
  expires_at timestamptz,
  accepted_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    i.id,
    i.company_id,
    c.company_name,
    i.email,
    i.role,
    i.expires_at,
    i.accepted_at
  from public.company_invitations i
  join public.companies c on c.id = i.company_id
  where i.token = p_token
  limit 1;
$$;

revoke all on function public.get_company_invitation_by_token(text) from public;
grant execute on function public.get_company_invitation_by_token(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- ensure_user_profile: company_members に owner も追加
-- ---------------------------------------------------------------------------
create or replace function public.ensure_user_profile(p_email text default '')
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company_id text;
  v_profile_id text;
  v_member_id text;
  v_company_name text;
  v_suffix text;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  select company_id
  into v_company_id
  from public.profiles
  where user_id = auth.uid()
  limit 1;

  if found then
    return v_company_id;
  end if;

  v_suffix := substr(md5(random()::text), 1, 4);
  v_company_id := 'co_' || to_char(floor(extract(epoch from clock_timestamp()) * 1000), 'FM9999999999990') || v_suffix;
  v_profile_id := 'prof_' || to_char(floor(extract(epoch from clock_timestamp()) * 1000), 'FM9999999999990') || v_suffix;
  v_member_id := 'cm_' || substr(md5(auth.uid()::text || ':' || v_company_id), 1, 12);

  if coalesce(p_email, '') <> '' then
    v_company_name := split_part(p_email, '@', 1) || 'の会社';
  else
    v_company_name := 'マイ会社';
  end if;

  insert into public.companies (
    id, company_name, email,
    postal_code, address, phone, invoice_number,
    bank_name, bank_branch, bank_account_type, bank_account_number, bank_account_holder
  ) values (
    v_company_id, v_company_name, coalesce(p_email, ''),
    '', '', '', '', '', '', '', '', ''
  );

  insert into public.profiles (id, user_id, company_id, email)
  values (v_profile_id, auth.uid(), v_company_id, coalesce(p_email, ''));

  insert into public.company_members (
    id, company_id, user_id, role, status, joined_at, created_at, updated_at
  ) values (
    v_member_id, v_company_id, auth.uid(), 'owner', 'active', now(), now(), now()
  );

  return v_company_id;
end;
$$;

revoke all on function public.ensure_user_profile(text) from public;
grant execute on function public.ensure_user_profile(text) to authenticated;

-- ---------------------------------------------------------------------------
-- RPC: メンバー一覧（メール付き）
-- ---------------------------------------------------------------------------
create or replace function public.list_company_members(p_company_id text)
returns table (
  id text,
  company_id text,
  user_id uuid,
  role text,
  status text,
  email text,
  joined_at timestamptz,
  invited_by uuid,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    m.id,
    m.company_id,
    m.user_id,
    m.role,
    m.status,
    coalesce(p.email, u.email, '') as email,
    m.joined_at,
    m.invited_by,
    m.created_at,
    m.updated_at
  from public.company_members m
  left join public.profiles p on p.user_id = m.user_id
  left join auth.users u on u.id = m.user_id
  where m.company_id = p_company_id
    and public.is_company_member(p_company_id)
  order by m.joined_at asc;
$$;

revoke all on function public.list_company_members(text) from public;
grant execute on function public.list_company_members(text) to authenticated;

-- ---------------------------------------------------------------------------
-- RPC: ユーザーの所属会社一覧
-- ---------------------------------------------------------------------------
create or replace function public.list_user_companies()
returns table (
  company_id text,
  company_name text,
  role text,
  is_current boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.id as company_id,
    c.company_name,
    m.role,
    (c.id = (select company_id from public.profiles where user_id = auth.uid() limit 1)) as is_current
  from public.company_members m
  join public.companies c on c.id = m.company_id
  where m.user_id = auth.uid()
    and m.status = 'active'
  order by c.company_name asc;
$$;

revoke all on function public.list_user_companies() from public;
grant execute on function public.list_user_companies() to authenticated;
