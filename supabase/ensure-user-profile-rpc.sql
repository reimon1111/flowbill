-- 初回ログイン時の company + profile 作成（RLS を bypass する SECURITY DEFINER）
-- 既存プロジェクト: Supabase SQL Editor でこのファイルを実行してください

create or replace function public.ensure_user_profile(p_email text default '')
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company_id text;
  v_profile_id text;
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

  if coalesce(p_email, '') <> '' then
    v_company_name := split_part(p_email, '@', 1) || 'の会社';
  else
    v_company_name := 'マイ会社';
  end if;

  insert into public.companies (
    id,
    company_name,
    email,
    postal_code,
    address,
    phone,
    invoice_number,
    bank_name,
    bank_branch,
    bank_account_type,
    bank_account_number,
    bank_account_holder
  ) values (
    v_company_id,
    v_company_name,
    coalesce(p_email, ''),
    '', '', '', '',
    '', '', '', '', ''
  );

  insert into public.profiles (id, user_id, company_id, email)
  values (v_profile_id, auth.uid(), v_company_id, coalesce(p_email, ''));

  return v_company_id;
end;
$$;

revoke all on function public.ensure_user_profile(text) from public;
grant execute on function public.ensure_user_profile(text) to authenticated;
