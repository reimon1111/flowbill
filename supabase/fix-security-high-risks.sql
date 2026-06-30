-- 本番公開前セキュリティ修正（High: H1, H3）
-- SQL Editor で手動実行してください。
-- 前提: add-multi-tenant.sql / add-signup-access-control.sql 適用済み
--
-- H1: 無許可の companies 直接 INSERT を禁止
-- H3: 招待先による company_invitations の改ざん（role 昇格等）を禁止
--     招待受諾は accept_company_invitation RPC（SECURITY DEFINER）のみ

-- ---------------------------------------------------------------------------
-- H1: companies_insert_onboarding を削除
-- 会社作成は ensure_user_profile RPC（allowed_signups / 招待検証付き）のみ
-- ---------------------------------------------------------------------------
drop policy if exists companies_insert_onboarding on public.companies;

-- ---------------------------------------------------------------------------
-- H3: company_invitations の UPDATE は owner/admin のみ
-- 招待先は直接 UPDATE 不可（accepted_at は accept_company_invitation RPC が設定）
-- ---------------------------------------------------------------------------
drop policy if exists company_invitations_update on public.company_invitations;

create policy company_invitations_update on public.company_invitations
  for update
  using (public.can_manage_company(company_id))
  with check (public.can_manage_company(company_id));
