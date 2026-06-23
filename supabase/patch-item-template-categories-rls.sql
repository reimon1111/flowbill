-- item_template_categories の RLS 修正
-- 既に add-item-template-categories.sql を実行済みで
-- 「データベースへのアクセスが拒否されました（RLS）」が出る場合に実行してください。
--
-- 原因: 旧ポリシーが auth.jwt() ->> 'company_id' を参照していたが、
--       このアプリは profiles テーブル経由の current_company_id() を使用している。

drop policy if exists item_template_categories_select on public.item_template_categories;
drop policy if exists item_template_categories_insert on public.item_template_categories;
drop policy if exists item_template_categories_update on public.item_template_categories;
drop policy if exists item_template_categories_delete on public.item_template_categories;

create policy item_template_categories_select
  on public.item_template_categories
  for select
  using (company_id = public.current_company_id());

create policy item_template_categories_insert
  on public.item_template_categories
  for insert
  with check (company_id = public.current_company_id());

create policy item_template_categories_update
  on public.item_template_categories
  for update
  using (company_id = public.current_company_id())
  with check (company_id = public.current_company_id());

create policy item_template_categories_delete
  on public.item_template_categories
  for delete
  using (company_id = public.current_company_id());
