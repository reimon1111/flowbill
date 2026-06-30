# FlowBill — Supabase SQL

## 新規環境・本番構築（推奨）

Supabase SQL Editor で、以下のファイルを **この順番で** 1つずつ実行してください。  
`schema-full.sql` のみでは、マルチテナント・登録制限・Activity Log・監査列が揃いません。

| 順 | ファイル | 内容 |
|----|---------|------|
| 1 | `schema-full.sql` | 基盤テーブル・RLS・関数 |
| 2 | `add-multi-tenant.sql` | 会社メンバー・マルチテナント RLS |
| 3 | `add-signup-access-control.sql` | 登録許可リスト（`allowed_signups`）・管理者（`admin_users`） |
| 4 | `add-company-data-sharing.sql` | 会社内データ共有・招待 |
| 5 | `add-audit-fields.sql` | `created_by` / `updated_by`・更新トリガー |
| 6 | `add-activity-logs.sql` | 操作履歴（`activity_logs`） |
| 7 | `add-commercial-document-soft-delete.sql` | 注文書・納品書・領収書の論理削除 |
| 8 | `fix-security-high-risks.sql` | **本番公開前必須** — セキュリティ修正 |

手順の詳細・環境変数はリポジトリ直下の [README.md](../README.md#supabase-新規セットアップ) を参照してください。

### 本番公開前の必須実行

**8番目の `fix-security-high-risks.sql` は本番公開前に必ず実行してください。**

- `companies_insert_onboarding` ポリシーを削除（無許可の会社作成を禁止）
- `company_invitations_update` を owner/admin のみに制限

---

## 適用状況の確認 SQL

本番 Supabase に以下が入っているか、SQL Editor で確認できます。

```sql
-- RLS が有効か（主要テーブル）
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('projects', 'customers', 'quotes', 'invoices', 'company_members', 'activity_logs')
ORDER BY tablename;
-- 期待: すべて rowsecurity = true

-- 必須テーブルの存在確認
SELECT
  to_regclass('public.company_members') AS company_members,
  to_regclass('public.allowed_signups') AS allowed_signups,
  to_regclass('public.admin_users') AS admin_users,
  to_regclass('public.activity_logs') AS activity_logs;
-- 期待: すべて NULL 以外

-- created_by / updated_by が主要テーブルにあるか
SELECT table_name, column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('projects', 'customers', 'quotes', 'invoices', 'orders', 'delivery_notes', 'receipts', 'item_templates')
  AND column_name IN ('created_by', 'updated_by')
ORDER BY table_name, column_name;
-- 期待: 各テーブルに created_by / updated_by

-- companies_insert_onboarding が削除されているか（fix-security-high-risks 適用後）
SELECT policyname FROM pg_policies
WHERE tablename = 'companies'
  AND policyname = 'companies_insert_onboarding';
-- 期待: No rows returned

-- company_invitations_update が owner/admin のみか
SELECT policyname, qual, with_check
FROM pg_policies
WHERE tablename = 'company_invitations'
  AND policyname = 'company_invitations_update';
-- 期待: 1行。qual / with_check に can_manage_company が含まれる
```

---

## 既存環境のアップデート

すでに `schema.sql` 等を適用済みの DB は、**`schema-full.sql` の再実行は非推奨**です（既存列定義との差分で問題が出る可能性があります）。

不足している機能に応じて、上記 2〜8 の **追加 SQL のみ** を順番に実行してください。  
各ファイルは `IF NOT EXISTS` / `DROP POLICY IF EXISTS` 等で再実行しやすくなっています。

### 旧手順からの移行メモ

| ファイル | 役割 | schema-full に統合 | 備考 |
|---------|------|-------------------|------|
| `schema-full.sql` | 新規構築用オールインワン | — | 新規は 1 番目に実行 |
| `add-multi-tenant.sql` | マルチテナント | — | **新規構築でも必須（2番目）** |
| `add-signup-access-control.sql` | 登録制限 | — | **新規構築でも必須（3番目）** |
| `add-company-data-sharing.sql` | 招待・共有 | — | **新規構築でも必須（4番目）** |
| `add-audit-fields.sql` | 監査列 | — | **新規構築でも必須（5番目）** |
| `add-activity-logs.sql` | Activity Log | — | **新規構築でも必須（6番目）** |
| `add-commercial-document-soft-delete.sql` | 書類論理削除 | — | **新規構築でも必須（7番目）** |
| `fix-security-high-risks.sql` | セキュリティ修正 | — | **本番公開前必須（8番目）** |
| `add-project-items.sql` 等 | 個別機能追加 | ✅ 統合済 | schema-full 適用済みなら不要 |
| `patch-item-template-categories-rls.sql` | カテゴリ RLS 修正 | — | RLS エラー時のみ |
| `reset-transaction-data.sql` | データ削除 | — | **開発用** |

---

## その他

- **データリセット**: `reset-transaction-data.sql`（案件・見積・請求のみ削除。顧客・会社設定は残す）
- **アプリ側**: 未適用 SQL があると画面上部に警告バナーが表示されます
