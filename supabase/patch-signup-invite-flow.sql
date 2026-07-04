-- 招待メンバー登録フローの修正（既存環境向けパッチ）
-- add-signup-access-control.sql 適用後に実行

drop function if exists public.ensure_user_profile(text);

create or replace function public.ensure_user_profile(
  p_email text default '',
  p_invite_token text default null
)
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
      return v_company_id;
    end if;
  end if;

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
        company_id = coalesce(excluded.company_id, public.profiles.company_id),
        email = coalesce(nullif(excluded.email, ''), public.profiles.email),
        updated_at = now()
    returning company_id into v_company_id;

    return v_company_id;
  end if;

  if coalesce(p_invite_token, '') <> '' then
    select * into v_inv
    from public.company_invitations
    where token = p_invite_token
      and accepted_at is null
      and expires_at > now()
    limit 1;
  else
    select * into v_inv
    from public.company_invitations
    where lower(email) = v_email
      and accepted_at is null
      and expires_at > now()
    order by created_at desc
    limit 1;
  end if;

  if found then
    v_suffix := substr(md5(random()::text), 1, 4);
    v_profile_id := 'prof_' || to_char(floor(extract(epoch from clock_timestamp()) * 1000), 'FM9999999999990') || v_suffix;
    v_member_id := 'cm_' || substr(md5(auth.uid()::text || ':' || v_inv.company_id), 1, 12);

    insert into public.profiles (id, user_id, company_id, email)
    values (v_profile_id, auth.uid(), v_inv.company_id, coalesce(p_email, ''))
    on conflict (user_id) do update
      set
        company_id = excluded.company_id,
        email = coalesce(nullif(excluded.email, ''), public.profiles.email),
        updated_at = now()
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
    set
      company_id = excluded.company_id,
      email = coalesce(nullif(excluded.email, ''), public.profiles.email),
      updated_at = now()
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

revoke all on function public.ensure_user_profile(text, text) from public;
grant execute on function public.ensure_user_profile(text, text) to authenticated;
