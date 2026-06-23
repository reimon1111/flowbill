-- 案件・見積・請求・入金管理データのリセット
--
-- 削除対象:
--   - 案件 (projects) と案件履歴・案件明細
--   - 見積 (quotes) と見積明細
--   - 請求書 (invoices) と請求明細（入金管理も請求書ベースのため含む）
--
-- 残すもの:
--   - 会社設定 (companies)
--   - 顧客 (customers)
--   - 請求項目テンプレ (item_templates / item_template_categories)
--   - 定期請求 (recurring_billings) ※必要なら末尾のコメントを解除
--
-- 使い方: Supabase Dashboard → SQL Editor → このファイルの内容を貼り付けて Run
-- 実行後: ブラウザで FlowBill を再読み込み（Cmd+Shift+R）

begin;

-- projects 削除で quotes / invoices / project_histories / project_items も CASCADE 削除されます
delete from public.projects;

-- 定期請求もリセットする場合は以下の2行のコメントを外してください
-- delete from public.recurring_billing_items;
-- delete from public.recurring_billings;

commit;

-- 削除件数の確認（任意）
select
  (select count(*) from public.projects) as projects,
  (select count(*) from public.quotes) as quotes,
  (select count(*) from public.invoices) as invoices,
  (select count(*) from public.customers) as customers;
