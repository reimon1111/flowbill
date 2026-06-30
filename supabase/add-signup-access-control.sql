-- 契約済みユーザーのみ新規登録可能 + 会社契約ステータス + 運営管理
-- 既存環境: Supabase SQL Editor で実行してください

create extension if not exists pgcrypto;

-- gen_random_bytes は extensions スキーマに入ることがあるため、search_path を明示したヘルパーで統一
create or replace function public.generate_random_hex_token(p_bytes integer default 32)
returns text
language sql
volatile
set search_path = public, extensions
as $$
  select encode(gen_random_bytes(p_bytes), 'hex');
$$;

-- ---------------------------------------------------------------------------
-- allowed_signups（登録許可メール）
-- ---------------------------------------------------------------------------
create table if not exists public.allowed_signups (
  id text primary key,
  email text not null,
  company_name text not null default '',
  role text not null default 'owner'
    check (role in ('owner', 'admin', 'member', 'viewer')),
  status text not null default 'pending'
    check (status in ('pending', 'used', 'canceled', 'expired')),
  token text not null unique default public.generate_random_hex_token(32),
  used_at timestamptz,
  expires_at timestamptz,
  invited_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 既存テーブル: token デフォルトをヘルパーに差し替え（再実行安全）
alter table public.allowed_signups
  alter column token set default public.generate_random_hex_token(32);

create unique index if not exists allowed_signups_pending_email_unique
  on public.allowed_signups (lower(email))
  where status = 'pending';

create index if not exists allowed_signups_token_idx on public.allowed_signups (token);

-- ---------------------------------------------------------------------------
-- admin_users（運営管理者）
-- ---------------------------------------------------------------------------
create table if not exists public.admin_users (
  id text primary key,
  user_id uuid not null unique references auth.users (id) on delete cascade,
  email text not null,
  role text not null default 'super_admin' check (role = 'super_admin'),
  created_at timestamptz not null default now()
);

create unique index if not exists admin_users_email_unique on public.admin_users (lower(email));

-- ---------------------------------------------------------------------------
-- companies 契約ステータス
-- ---------------------------------------------------------------------------
alter table public.companies
  add column if not exists contract_status text not null default 'active'
    check (contract_status in ('active', 'trial', 'suspended', 'canceled'));

alter table public.companies
  add column if not exists contract_started_at timestamptz;

alter table public.companies
  add column if not exists contract_ended_at timestamptz;

update public.companies
set contract_status = 'active'
where contract_status is null or contract_status = '';

-- ---------------------------------------------------------------------------
-- Helper: 運営管理者か
-- ---------------------------------------------------------------------------
create or replace function public.is_admin_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admin_users a where a.user_id = auth.uid()
  );
$$;

-- ---------------------------------------------------------------------------
-- Helper: 会社が利用可能か
-- ---------------------------------------------------------------------------
create or replace function public.is_company_contract_active(p_company_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.companies c
    where c.id = p_company_id
      and c.contract_status in ('active', 'trial')
  );
$$;

-- ---------------------------------------------------------------------------
-- 新規登録可否チェック（一般ユーザーは自分のメールのみ確認可）
-- ---------------------------------------------------------------------------
create or replace function public.check_signup_allowed(
  p_email text,
  p_invite_token text default null,
  p_allowed_token text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_inv public.company_invitations%rowtype;
  v_allowed public.allowed_signups%rowtype;
begin
  if v_email = '' then
    return jsonb_build_object('allowed', false, 'reason', 'invalid_email');
  end if;

  -- 会社招待トークン経由
  if coalesce(p_invite_token, '') <> '' then
    select * into v_inv
    from public.company_invitations
    where token = p_invite_token
    limit 1;

    if not found then
      return jsonb_build_object('allowed', false, 'reason', 'invite_not_found');
    end if;
    if v_inv.accepted_at is not null then
      return jsonb_build_object('allowed', false, 'reason', 'invite_already_used');
    end if;
    if v_inv.expires_at < now() then
      return jsonb_build_object('allowed', false, 'reason', 'invite_expired');
    end if;
    if lower(v_inv.email) <> v_email then
      return jsonb_build_object('allowed', false, 'reason', 'invite_email_mismatch');
    end if;
    return jsonb_build_object('allowed', true, 'source', 'company_invitation');
  end if;

  -- allowed_signups トークン経由
  if coalesce(p_allowed_token, '') <> '' then
    select * into v_allowed
    from public.allowed_signups
    where token = p_allowed_token
    limit 1;

    if not found then
      return jsonb_build_object('allowed', false, 'reason', 'allowed_not_found');
    end if;
    if lower(v_allowed.email) <> v_email then
      return jsonb_build_object('allowed', false, 'reason', 'allowed_email_mismatch');
    end if;
    if v_allowed.status <> 'pending' then
      return jsonb_build_object('allowed', false, 'reason', 'allowed_not_pending');
    end if;
    if v_allowed.expires_at is not null and v_allowed.expires_at < now() then
      return jsonb_build_object('allowed', false, 'reason', 'allowed_expired');
    end if;
    return jsonb_build_object(
      'allowed', true,
      'source', 'allowed_signup',
      'company_name', v_allowed.company_name
    );
  end if;

  -- メールアドレスで allowed_signups を確認
  select * into v_allowed
  from public.allowed_signups
  where lower(email) = v_email
    and status = 'pending'
  order by created_at desc
  limit 1;

  if not found then
    return jsonb_build_object('allowed', false, 'reason', 'not_allowed');
  end if;

  if v_allowed.expires_at is not null and v_allowed.expires_at < now() then
    return jsonb_build_object('allowed', false, 'reason', 'allowed_expired');
  end if;

  return jsonb_build_object(
    'allowed', true,
    'source', 'allowed_signup',
    'company_name', v_allowed.company_name
  );
end;
$$;

revoke all on function public.check_signup_allowed(text, text, text) from public;
grant execute on function public.check_signup_allowed(text, text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- ensure_user_profile 更新（登録制限 + 招待参加 + allowed 消費・冪等）
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
  v_email text := lower(trim(coalesce(p_email, '')));
  v_inv public.company_invitations%rowtype;
  v_allowed public.allowed_signups%rowtype;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  -- 既存 profile があれば company_id を返す（再ログイン・リロード復帰）
  select company_id into v_company_id
  from public.profiles
  where user_id = auth.uid()
  limit 1;

  if found then
    if v_company_id is null then
      select cm.company_id into v_company_id
      from public.company_members cm
      where cm.user_id = auth.uid()
        and cm.status = 'active'
      order by cm.joined_at desc nulls last, cm.created_at desc
      limit 1;

      if found then
        update public.profiles
        set company_id = v_company_id, updated_at = now()
        where user_id = auth.uid();
      end if;
    end if;

    if v_company_id is not null then
      update public.allowed_signups
      set
        status = 'used',
        used_at = coalesce(used_at, now()),
        updated_at = now()
      where lower(email) = v_email
        and status = 'pending';

      return v_company_id;
    end if;
  end if;

  -- profile は無いが company_members だけある（不整合復旧）
  select cm.company_id into v_company_id
  from public.company_members cm
  where cm.user_id = auth.uid()
    and cm.status = 'active'
  order by cm.joined_at desc nulls last, cm.created_at desc
  limit 1;

  if found then
    v_suffix := substr(md5(random()::text), 1, 4);
    v_profile_id := 'prof_' || to_char(floor(extract(epoch from clock_timestamp()) * 1000), 'FM9999999999990') || v_suffix;

    insert into public.profiles (id, user_id, company_id, email)
    values (v_profile_id, auth.uid(), v_company_id, coalesce(p_email, ''))
    on conflict (user_id) do update
      set
        company_id = coalesce(public.profiles.company_id, excluded.company_id),
        updated_at = now()
    returning company_id into v_company_id;

    update public.allowed_signups
    set
      status = 'used',
      used_at = coalesce(used_at, now()),
      updated_at = now()
    where lower(email) = v_email
      and status = 'pending';

    return v_company_id;
  end if;

  -- 有効な会社招待があれば参加（新規会社は作らない）
  select * into v_inv
  from public.company_invitations
  where lower(email) = v_email
    and accepted_at is null
    and expires_at > now()
  order by created_at desc
  limit 1;

  if found then
    v_suffix := substr(md5(random()::text), 1, 4);
    v_profile_id := 'prof_' || to_char(floor(extract(epoch from clock_timestamp()) * 1000), 'FM9999999999990') || v_suffix;
    v_member_id := 'cm_' || substr(md5(auth.uid()::text || ':' || v_inv.company_id), 1, 12);

    insert into public.profiles (id, user_id, company_id, email)
    values (v_profile_id, auth.uid(), v_inv.company_id, coalesce(p_email, ''))
    on conflict (user_id) do update
      set updated_at = now()
    returning company_id into v_company_id;

    insert into public.company_members (
      id, company_id, user_id, role, status, invited_by, joined_at, created_at, updated_at
    ) values (
      v_member_id, v_inv.company_id, auth.uid(), v_inv.role, 'active',
      v_inv.invited_by, now(), now(), now()
    )
    on conflict (company_id, user_id) do update
      set role = excluded.role, status = 'active', updated_at = now();

    update public.company_invitations
    set accepted_at = coalesce(accepted_at, now()), updated_at = now()
    where id = v_inv.id;

    return v_company_id;
  end if;

  -- allowed_signups 確認（新規オーナー登録）
  select * into v_allowed
  from public.allowed_signups
  where lower(email) = v_email
    and status = 'pending'
    and (expires_at is null or expires_at > now())
  order by created_at desc
  limit 1;

  if not found then
    raise exception 'signup_not_allowed';
  end if;

  v_suffix := substr(md5(random()::text), 1, 4);
  v_company_id := 'co_' || to_char(floor(extract(epoch from clock_timestamp()) * 1000), 'FM9999999999990') || v_suffix;
  v_profile_id := 'prof_' || to_char(floor(extract(epoch from clock_timestamp()) * 1000), 'FM9999999999990') || v_suffix;
  v_member_id := 'cm_' || substr(md5(auth.uid()::text || ':' || v_company_id), 1, 12);

  v_company_name := nullif(trim(v_allowed.company_name), '');
  if v_company_name is null then
    if coalesce(p_email, '') <> '' then
      v_company_name := split_part(p_email, '@', 1) || 'の会社';
    else
      v_company_name := 'マイ会社';
    end if;
  end if;

  insert into public.companies (
    id, company_name, email,
    postal_code, address, phone, invoice_number,
    bank_name, bank_branch, bank_account_type, bank_account_number, bank_account_holder,
    contract_status, contract_started_at
  ) values (
    v_company_id, v_company_name, coalesce(p_email, ''),
    '', '', '', '', '', '', '', '', '',
    'active', now()
  );

  insert into public.profiles (id, user_id, company_id, email)
  values (v_profile_id, auth.uid(), v_company_id, coalesce(p_email, ''))
  on conflict (user_id) do update
    set updated_at = now()
  returning company_id into v_company_id;

  insert into public.company_members (
    id, company_id, user_id, role, status, joined_at, created_at, updated_at
  ) values (
    v_member_id, v_company_id, auth.uid(), 'owner', 'active', now(), now(), now()
  )
  on conflict (company_id, user_id) do update
    set role = 'owner', status = 'active', updated_at = now();

  update public.allowed_signups
  set
    status = 'used',
    used_at = coalesce(used_at, now()),
    updated_at = now()
  where id = v_allowed.id
    and status = 'pending';

  return v_company_id;
end;
$$;

revoke all on function public.ensure_user_profile(text) from public;
grant execute on function public.ensure_user_profile(text) to authenticated;

-- ---------------------------------------------------------------------------
-- テナント書き込み: 契約 active/trial のみ
-- ---------------------------------------------------------------------------
create or replace function public.can_write_company_data(p_company_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    public.get_user_company_role(p_company_id) in ('owner', 'admin', 'member')
      and public.is_company_contract_active(p_company_id),
    false
  );
$$;

-- companies SELECT: 契約停止中もメッセージ表示のため閲覧は許可
-- （既存 is_company_member ベースの select は維持）

-- ---------------------------------------------------------------------------
-- RLS: allowed_signups / admin_users（直接アクセス禁止、RPC経由）
-- ---------------------------------------------------------------------------
alter table public.allowed_signups enable row level security;
alter table public.admin_users enable row level security;

drop policy if exists allowed_signups_deny_all on public.allowed_signups;
create policy allowed_signups_deny_all on public.allowed_signups
  for all using (false) with check (false);

drop policy if exists admin_users_select_own on public.admin_users;
create policy admin_users_select_own on public.admin_users
  for select using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 運営 RPC
-- ---------------------------------------------------------------------------
create or replace function public.admin_create_allowed_signup(
  p_email text,
  p_company_name text default '',
  p_role text default 'owner',
  p_expires_at timestamptz default null
)
returns public.allowed_signups
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.allowed_signups;
  v_id text;
  v_token text;
begin
  if not public.is_admin_user() then
    raise exception 'not_admin';
  end if;

  v_id := 'as_' || substr(md5(random()::text || clock_timestamp()::text), 1, 12);
  v_token := public.generate_random_hex_token(32);

  insert into public.allowed_signups (
    id, email, company_name, role, status, token, expires_at, invited_by, created_at, updated_at
  ) values (
    v_id,
    lower(trim(p_email)),
    coalesce(p_company_name, ''),
    coalesce(p_role, 'owner'),
    'pending',
    v_token,
    p_expires_at,
    auth.uid(),
    now(),
    now()
  )
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function public.admin_list_allowed_signups()
returns setof public.allowed_signups
language sql
stable
security definer
set search_path = public
as $$
  select *
  from public.allowed_signups
  where public.is_admin_user()
  order by created_at desc;
$$;

create or replace function public.admin_cancel_allowed_signup(p_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin_user() then
    raise exception 'not_admin';
  end if;

  update public.allowed_signups
  set status = 'canceled', updated_at = now()
  where id = p_id and status = 'pending';
end;
$$;

create or replace function public.admin_list_companies()
returns table (
  id text,
  company_name text,
  email text,
  contract_status text,
  contract_started_at timestamptz,
  contract_ended_at timestamptz,
  created_at timestamptz,
  member_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.id,
    c.company_name,
    c.email,
    c.contract_status,
    c.contract_started_at,
    c.contract_ended_at,
    c.created_at,
    count(m.id) as member_count
  from public.companies c
  left join public.company_members m on m.company_id = c.id and m.status = 'active'
  where public.is_admin_user()
  group by c.id
  order by c.created_at desc;
$$;

create or replace function public.admin_update_contract_status(
  p_company_id text,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin_user() then
    raise exception 'not_admin';
  end if;

  if p_status not in ('active', 'trial', 'suspended', 'canceled') then
    raise exception 'invalid_status';
  end if;

  update public.companies
  set
    contract_status = p_status,
    contract_started_at = case
      when p_status in ('active', 'trial') and contract_started_at is null then now()
      else contract_started_at
    end,
    contract_ended_at = case
      when p_status in ('suspended', 'canceled') then now()
      else null
    end,
    updated_at = now()
  where id = p_company_id;
end;
$$;

revoke all on function public.admin_create_allowed_signup(text, text, text, timestamptz) from public;
revoke all on function public.admin_list_allowed_signups() from public;
revoke all on function public.admin_cancel_allowed_signup(text) from public;
revoke all on function public.admin_list_companies() from public;
revoke all on function public.admin_update_contract_status(text, text) from public;

grant execute on function public.admin_create_allowed_signup(text, text, text, timestamptz) to authenticated;
grant execute on function public.admin_list_allowed_signups() to authenticated;
grant execute on function public.admin_cancel_allowed_signup(text) to authenticated;
grant execute on function public.admin_list_companies() to authenticated;
grant execute on function public.admin_update_contract_status(text, text) to authenticated;

grant execute on function public.is_admin_user() to authenticated;

-- ---------------------------------------------------------------------------
-- 運営管理者の初期登録用（メールアドレスを書き換えて実行）
-- ---------------------------------------------------------------------------
-- 例: 初回ログイン後に以下を実行
-- insert into public.admin_users (id, user_id, email, role, created_at)
-- select
--   'adm_seed',
--   u.id,
--   u.email,
--   'super_admin',
--   now()
-- from auth.users u
-- where lower(u.email) = lower('YOUR_ADMIN_EMAIL@example.com')
-- on conflict (user_id) do nothing;
