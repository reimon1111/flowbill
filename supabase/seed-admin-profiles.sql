-- =============================================================================
-- 運営 admin 用 profiles 再作成（reset-production-data.sql 実行後）
-- =============================================================================
--
-- 背景:
--   TRUNCATE で profiles が消えた状態でログインすると、
--   ensure_user_profile が allowed_signups を探して signup_not_allowed になる。
--
-- 対象:
--   admin_users に紐づく auth.users のうち、profiles が無いユーザー
--
-- 注意（重要）:
--   1. profiles.company_id は通常 NOT NULL + companies への FK がある
--      → company_id = NULL の INSERT は失敗する（下記「A」参照）
--   2. 現行 ensure_user_profile は profile だけあって company_id が NULL だと
--      依然 signup_not_allowed になる
--      → 本ファイルの「B（推奨）」でプレースホルダー会社 + profile を作る
--
-- 変更しないもの:
--   RLS / Policy / RPC / Function / Trigger / admin_users / auth.users
--
-- =============================================================================


-- -----------------------------------------------------------------------------
-- STEP 1: 実行前確認（いつでも実行可）
-- -----------------------------------------------------------------------------

select 'admin_users' as source, a.user_id, a.email, a.role
from public.admin_users a
order by a.created_at;

select
  a.user_id,
  a.email as admin_email,
  u.email as auth_email,
  p.id as profile_id,
  p.company_id
from public.admin_users a
join auth.users u on u.id = a.user_id
left join public.profiles p on p.user_id = a.user_id
order by a.created_at;

select
  column_name,
  is_nullable,
  data_type
from information_schema.columns
where table_schema = 'public'
  and table_name = 'profiles'
  and column_name = 'company_id';


-- -----------------------------------------------------------------------------
-- A. profiles のみ（company_id = NULL）— 条件どおりの最小版
-- -----------------------------------------------------------------------------
-- ※ company_id が NOT NULL の環境では ERROR 23502 になります。
-- ※ 仮に INSERT できても、現行 RPC ではログイン時 signup_not_allowed のままです。
-- -----------------------------------------------------------------------------

/*
insert into public.profiles (id, user_id, company_id, email, created_at, updated_at)
select
  'prof_' || substr(md5(a.user_id::text || ':admin'), 1, 16),
  a.user_id,
  null,
  coalesce(nullif(trim(u.email), ''), a.email, ''),
  now(),
  now()
from public.admin_users a
join auth.users u on u.id = a.user_id
where not exists (
  select 1
  from public.profiles p
  where p.user_id = a.user_id
)
on conflict (user_id) do nothing;
*/


-- -----------------------------------------------------------------------------
-- B. 推奨: 運営プレースホルダー会社 + profiles（現行スキーマ・ログイン両対応）
-- -----------------------------------------------------------------------------
-- companies にテナント業務用ではない 1 行だけ追加し、運営 admin の profile を紐づける。
-- 既に profile がある admin はスキップ（on conflict do nothing）。
-- -----------------------------------------------------------------------------

begin;

-- 運営用プレースホルダー会社（FK 用。業務データは入れない）
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
  bank_account_holder,
  contract_status,
  contract_started_at,
  created_at,
  updated_at
)
values (
  'co_flowbill_ops',
  'FlowBill 運営（プレースホルダー）',
  '',
  '', '', '', '',
  '', '', '', '', '',
  'active',
  now(),
  now(),
  now()
)
on conflict (id) do nothing;

-- admin_users に紐づく auth.users 向け profiles（未作成のみ）
insert into public.profiles (id, user_id, company_id, email, created_at, updated_at)
select
  'prof_' || substr(md5(a.user_id::text || ':admin'), 1, 16),
  a.user_id,
  'co_flowbill_ops',
  coalesce(nullif(trim(u.email), ''), a.email, ''),
  now(),
  now()
from public.admin_users a
join auth.users u on u.id = a.user_id
where not exists (
  select 1
  from public.profiles p
  where p.user_id = a.user_id
)
on conflict (user_id) do nothing;

commit;


-- -----------------------------------------------------------------------------
-- STEP 2: 実行後確認
-- -----------------------------------------------------------------------------

select
  a.user_id,
  a.email as admin_email,
  p.id as profile_id,
  p.company_id,
  c.company_name
from public.admin_users a
join auth.users u on u.id = a.user_id
left join public.profiles p on p.user_id = a.user_id
left join public.companies c on c.id = p.company_id
order by a.created_at;

-- 期待:
--   profile_id が NULL でない
--   company_id = 'co_flowbill_ops'
--   admin_users の件数と profile が付いた admin の件数が一致
