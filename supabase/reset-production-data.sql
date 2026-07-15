-- =============================================================================
-- FlowBill 本番リリース前 — テストデータのみリセット
-- =============================================================================
--
-- 目的:
--   public スキーマの業務データ（テストデータ）を削除する。
--   テーブル定義・RLS・RPC・Function・Policy は変更しない。
--
-- 削除対象（ユーザー指定 + 依存テーブル）:
--   companies, company_members, profiles, customers, projects, project_items,
--   quotes, quote_items, orders, order_items, delivery_notes, delivery_note_items,
--   invoices, invoice_items, receipts, receipt_items,
--   recurring_billings, recurring_billing_items,
--   company_invitations, allowed_signups, activity_logs,
--   bank_accounts, item_templates, item_template_categories
--   ※ project_histories も案件に紐づくテストデータのため同時削除
--
-- 削除しないもの:
--   auth.users          … SQL では触らない（Authentication 管理画面から手動削除）
--   admin_users         … 運営管理者は残す
--   スキーマ / RLS / RPC / Function / Policy
--
-- ⚠️  このファイルは破壊的操作です。必ず手順どおり確認してから実行してください。
-- ⚠️  まだ実行しない場合は、下記「STEP 1〜3」の SELECT のみ実行して件数確認してください。
--
-- =============================================================================


-- =============================================================================
-- STEP 0: 実行前チェックリスト（手動）
-- =============================================================================
--
-- [ ] Supabase Dashboard → Settings → Database でバックアップ/PITR が有効か確認
-- [ ] 本番プロジェクトを開いているか URL を再確認（dev / prod の取り違え防止）
-- [ ] メンテナンス時間帯である / 利用者に告知済み
-- [ ] 下記 STEP 1 の件数を記録した
-- [ ] 必要なら STEP 2 のバックアップ SELECT 結果を CSV エクスポートした
-- [ ] Authentication → Users からテストユーザーを手動削除する手順を把握した
-- [ ] 最後に STEP 4 の COMMIT 版のみ実行する（ROLLBACK 版はドライラン用）


-- =============================================================================
-- STEP 1: 実行前の件数確認（安全・いつでも実行可）
-- =============================================================================

select 'BEFORE RESET' as phase, now() as checked_at;

select
  (select count(*) from public.companies) as companies,
  (select count(*) from public.company_members) as company_members,
  (select count(*) from public.profiles) as profiles,
  (select count(*) from public.customers) as customers,
  (select count(*) from public.projects) as projects,
  (select count(*) from public.project_histories) as project_histories,
  (select count(*) from public.project_items) as project_items,
  (select count(*) from public.quotes) as quotes,
  (select count(*) from public.quote_items) as quote_items,
  (select count(*) from public.orders) as orders,
  (select count(*) from public.order_items) as order_items,
  (select count(*) from public.delivery_notes) as delivery_notes,
  (select count(*) from public.delivery_note_items) as delivery_note_items,
  (select count(*) from public.invoices) as invoices,
  (select count(*) from public.invoice_items) as invoice_items,
  (select count(*) from public.receipts) as receipts,
  (select count(*) from public.receipt_items) as receipt_items,
  (select count(*) from public.recurring_billings) as recurring_billings,
  (select count(*) from public.recurring_billing_items) as recurring_billing_items,
  (select count(*) from public.company_invitations) as company_invitations,
  (select count(*) from public.allowed_signups) as allowed_signups,
  (select count(*) from public.activity_logs) as activity_logs,
  (select count(*) from public.bank_accounts) as bank_accounts,
  (select count(*) from public.item_templates) as item_templates,
  (select count(*) from public.item_template_categories) as item_template_categories,
  (select count(*) from public.admin_users) as admin_users_kept,
  (select count(*) from auth.users) as auth_users_manual;

-- 会社一覧（削除対象の確認用）
select id, company_name, email, contract_status, created_at
from public.companies
order by created_at desc;

-- 運営 admin（残る想定）
select id, email, role, created_at
from public.admin_users
order by created_at desc;


-- =============================================================================
-- STEP 2: バックアップ用 SELECT（必要なテーブルだけ CSV エクスポート）
-- =============================================================================
-- SQL Editor で各クエリを実行 → Results → Download CSV
-- または Dashboard → Database → Backups / PITR を利用（推奨）

-- select * from public.companies order by created_at;
-- select * from public.profiles order by created_at;
-- select * from public.company_members order by created_at;
-- select * from public.customers order by created_at;
-- select * from public.projects order by created_at;
-- select * from public.quotes order by created_at;
-- select * from public.invoices order by created_at;
-- select * from public.allowed_signups order by created_at;


-- =============================================================================
-- STEP 3: auth.users の手動削除（SQL の外で実施）
-- =============================================================================
--
-- Supabase Dashboard → Authentication → Users
--   テスト用ユーザーを選択して Delete
--
-- 注意:
--   - auth.users を SQL DELETE すると profiles / company_members 等が
--     ON DELETE CASCADE で連鎖削除される可能性があり、意図しない順序になる
--   - 本スクリプト実行「後」に削除しても、「前」に削除してもよい
--   - admin_users に紐づく運営アカウントは削除しないこと


-- =============================================================================
-- STEP 4: データリセット本体
-- =============================================================================
--
-- 【ドライラン】最初は必ず ROLLBACK 版を実行し、件数が 0 になることを確認
-- 【本番実行】問題なければ COMMIT 版に差し替えて再実行
--
-- 削除順の考え方:
--   - customers → projects 等は ON DELETE RESTRICT があるため、
--     子（明細・帳票）→ 親（案件・顧客）→ テナント（会社・メンバー）の順が安全
--   - 1 つの TRUNCATE 文に全テーブルを列挙し、PostgreSQL に順序を任せる
--   - RESTRICT 制約は TRUNCATE では一括処理されるため DELETE より安全
--   - admin_users / auth.users はリストに含めない
--
-- ---------------------------------------------------------------------------


-- ---------------------------------------------------------------------------
-- 4-A. ドライラン（変更を確定しない）— 最初はこちらを実行
-- ---------------------------------------------------------------------------

begin;

truncate table
  public.receipt_items,
  public.delivery_note_items,
  public.order_items,
  public.invoice_items,
  public.quote_items,
  public.recurring_billing_items,
  public.project_items,
  public.project_histories,
  public.receipts,
  public.delivery_notes,
  public.orders,
  public.invoices,
  public.quotes,
  public.recurring_billings,
  public.projects,
  public.activity_logs,
  public.company_invitations,
  public.bank_accounts,
  public.item_templates,
  public.item_template_categories,
  public.customers,
  public.company_members,
  public.profiles,
  public.companies,
  public.allowed_signups
restart identity cascade;

-- ドライラン確認（すべて 0 であること）
select
  (select count(*) from public.companies) as companies,
  (select count(*) from public.profiles) as profiles,
  (select count(*) from public.customers) as customers,
  (select count(*) from public.projects) as projects,
  (select count(*) from public.quotes) as quotes,
  (select count(*) from public.invoices) as invoices,
  (select count(*) from public.allowed_signups) as allowed_signups,
  (select count(*) from public.admin_users) as admin_users_kept;

rollback;  -- ★ ドライラン: ここで変更を破棄


-- ---------------------------------------------------------------------------
-- 4-B. 本番実行（ドライラン確認後に、4-A をコメントアウトしてこちらを実行）
-- ---------------------------------------------------------------------------

/*
begin;

truncate table
  public.receipt_items,
  public.delivery_note_items,
  public.order_items,
  public.invoice_items,
  public.quote_items,
  public.recurring_billing_items,
  public.project_items,
  public.project_histories,
  public.receipts,
  public.delivery_notes,
  public.orders,
  public.invoices,
  public.quotes,
  public.recurring_billings,
  public.projects,
  public.activity_logs,
  public.company_invitations,
  public.bank_accounts,
  public.item_templates,
  public.item_template_categories,
  public.customers,
  public.company_members,
  public.profiles,
  public.companies,
  public.allowed_signups
restart identity cascade;

commit;  -- ★ 本番: ここで確定
*/


-- =============================================================================
-- STEP 5: 実行後確認（COMMIT 後に実行）
-- =============================================================================

-- select 'AFTER RESET' as phase, now() as checked_at;
--
-- select
--   (select count(*) from public.companies) as companies,
--   (select count(*) from public.company_members) as company_members,
--   (select count(*) from public.profiles) as profiles,
--   (select count(*) from public.customers) as customers,
--   (select count(*) from public.projects) as projects,
--   (select count(*) from public.quotes) as quotes,
--   (select count(*) from public.invoices) as invoices,
--   (select count(*) from public.allowed_signups) as allowed_signups,
--   (select count(*) from public.admin_users) as admin_users_kept,
--   (select count(*) from public.admin_users) > 0 as admin_still_exists;
--
-- -- すべて 0（admin_users_kept のみ運営分が残る）であること


-- =============================================================================
-- STEP 6: リリース後の再セットアップ（参考）
-- =============================================================================
--
-- 1. Supabase Authentication で本番用ユーザー / 運営 admin を作成
-- 2. seed-admin-user.sql で admin_users を登録（メールを書き換え）
-- 3. /admin から allowed_signups で契約会社オーナーを許可
-- 4. 許可メールで signup → ensure_user_profile で会社作成
-- 5. patch-signup-invite-flow.sql が未適用なら適用
-- 6. ブラウザのローカルストレージ / セッションをクリアして再ログイン
