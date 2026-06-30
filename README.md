# FlowBill — 受発注・見積・請求管理

案件を進めるだけで、請求漏れ・入金漏れ・再入力をなくす業務改善アプリ。

## 技術スタック

- Next.js 16 (App Router)
- TypeScript (strict)
- Tailwind CSS v4 / shadcn/ui
- React Hook Form + Zod
- Zustand（ローカル状態）
- Supabase（Auth + PostgreSQL + RLS）
- Lucide React / Sonner

## 開発

```bash
npm install
npm run dev
```

Supabase を使わない場合は `.env.local` に URL / Anon Key を設定せず起動すると、**ローカルモード**（モックデータ）で動作します。

## 機能概要

- **顧客 / 案件 / 見積 / 請求 / 入金 / 定期請求** を一連の流れで管理
- **注文書・納品書・領収書** と複数振込口座
- **会社別データ分離（company_id） + Supabase Auth**
- **案件明細**: 案件作成時に明細を登録し、見積・請求へ引き継ぎ
- **見積 → 請求書生成**（W/H・単位対応、プレビュー・印刷）
- **PDF印刷 / 会社設定**（ロゴ・社印・振込先・備考テンプレなど）

## 案件ステータス（簡略化）

- **案件ステータス**: 見積中 / 受注 / 作業中 / 完了 / 失注
- **請求状態**: `invoiceStatus`
- **入金状態**: `paymentStatus`

---

## Supabase 新規セットアップ

新しい Supabase プロジェクトを作る場合は、**次の手順だけ** で OK です。

### 1. Supabase プロジェクト作成

[Supabase Dashboard](https://supabase.com/dashboard) で新規プロジェクトを作成します。

### 2. Authentication（Email）を有効化

Dashboard → **Authentication → Providers** で Email を有効にします。

### 3. SQL を順番に実行（本番・新規共通）

Dashboard → **SQL Editor** で、以下のファイルを **この順番で** 1つずつ貼り付けて **Run** してください。  
`schema-full.sql` だけでは、マルチテナント・登録制限・Activity Log・監査列などが揃いません。

| 順 | ファイル | 内容 |
|----|---------|------|
| 1 | `supabase/schema-full.sql` | 基盤テーブル・RLS・関数 |
| 2 | `supabase/add-multi-tenant.sql` | 会社メンバー・マルチテナント RLS |
| 3 | `supabase/add-signup-access-control.sql` | 登録許可リスト・管理者 |
| 4 | `supabase/add-company-data-sharing.sql` | 会社内データ共有・招待 |
| 5 | `supabase/add-audit-fields.sql` | `created_by` / `updated_by`・更新トリガー |
| 6 | `supabase/add-activity-logs.sql` | 操作履歴（Activity Log） |
| 7 | `supabase/add-commercial-document-soft-delete.sql` | 書類の論理削除 |
| 8 | `supabase/fix-security-high-risks.sql` | **本番公開前必須**（セキュリティ修正） |

> 8番目の `fix-security-high-risks.sql` は本番公開前に必ず実行してください。  
> 詳細は [`supabase/README.md`](supabase/README.md) を参照してください。

### 3.1 適用後の確認 SQL

SQL Editor で以下を実行し、本番 Supabase に必要なオブジェクトが揃っているか確認してください。

```sql
-- ① 主要テーブルで RLS が有効か
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('projects', 'customers', 'quotes', 'invoices', 'company_members', 'activity_logs')
ORDER BY tablename;
-- 期待: すべて rowsecurity = true

-- ② マルチテナント・登録制限・操作履歴テーブルがあるか
SELECT
  to_regclass('public.company_members') AS company_members,
  to_regclass('public.allowed_signups') AS allowed_signups,
  to_regclass('public.admin_users') AS admin_users,
  to_regclass('public.activity_logs') AS activity_logs;
-- 期待: すべて NULL 以外

-- ③ 主要テーブルに監査列があるか
SELECT table_name, column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('projects', 'customers', 'quotes', 'invoices', 'orders', 'delivery_notes', 'receipts', 'item_templates')
  AND column_name IN ('created_by', 'updated_by')
ORDER BY table_name, column_name;
-- 期待: 各テーブルに created_by / updated_by の2列

-- ④ 無許可の companies 直接 INSERT ポリシーが削除されているか（fix-security-high-risks 適用確認）
SELECT policyname FROM pg_policies
WHERE tablename = 'companies'
  AND policyname = 'companies_insert_onboarding';
-- 期待: No rows returned

-- ⑤ company_invitations の UPDATE が owner/admin のみか
SELECT policyname, qual, with_check
FROM pg_policies
WHERE tablename = 'company_invitations'
  AND policyname = 'company_invitations_update';
-- 期待: 1行。qual / with_check に can_manage_company が含まれる
```

適用漏れがある場合は、上表の該当 SQL を未実行の順番から再実行してください。

### 4. 環境変数

`.env.local` を作成し、`.env.example` を参考に設定します。

| 変数 | 説明 |
|------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | プロジェクト URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon public key |

### 5. 起動

```bash
npm run dev
```

### 6. ログイン

ブラウザで `http://localhost:3000/login` を開き、**Sign up** からユーザーを作成します。  
初回ログイン時に会社（`companies`）とプロフィール（`profiles`）が自動作成されます。

### 7. Auth URL 設定（本番デプロイ時）

Dashboard → **Authentication → URL Configuration**

| 項目 | 値 |
|------|-----|
| Site URL | ローカル: `http://localhost:3000` / 本番: Vercel の URL |
| Redirect URLs | `http://localhost:3000/**` と本番 URL の `/**` |

---

## 既存環境をアップデートする場合

すでに `schema.sql` などを適用済みの DB は、**`schema-full.sql` の再実行は非推奨**です（既存列定義との差分で問題が出る可能性があります）。

不足している機能に応じて、以下の **追加 SQL のみ** を Supabase SQL Editor で順に実行してください。  
各ファイルは `IF NOT EXISTS` 等で再実行しやすくなっています。

| 順 | ファイル | 内容 |
|----|---------|------|
| 1 | `add-project-items.sql` | 案件明細テーブル |
| 2 | `add-construction-item-fields.sql` | 明細 W/H・工事場所・顧客 FAX |
| 3 | `add-project-date-fields.sql` | 受注確定日・作業完了日 |
| 4 | `add-project-schedule-fields.sql` | 開始日・完了予定日・担当者（古い schema.sql のみ必要） |
| 5 | `add-project-archived.sql` | アーカイブ列（古い schema.sql のみ必要） |
| 6 | `patch-company-settings.sql` | 会社設定列の一括追加（推奨） |
| 7 | `add-quote-expiry-type.sql` | 見積有効期限タイプ（patch 未適用時） |
| 8 | `add-item-template-categories.sql` | カテゴリマスタ |
| 9 | `add-document-management.sql` | 注文書・納品書・領収書・複数口座 |
| — | `patch-item-template-categories-rls.sql` | カテゴリ RLS エラー時のみ |
| — | `ensure-user-profile-rpc.sql` | 初回ログイン関数の再適用のみ必要な場合 |

個別ファイル（`add-company-fax-contact.sql` 等）は `patch-company-settings.sql` に包含済みのため、**patch を実行済みなら不要**です。

### 未適用 SQL の警告

アプリ起動後、画面上部に次のようなバナーが出る場合があります。

> Supabaseの一部テーブルまたはカラムが未適用です。READMEの「既存環境をアップデートする場合」を確認してください。

表示された **未適用ファイル名** に従い、上表の SQL を実行してください。

---

## SQL ファイル棚卸し

| ファイル | 役割 | 新規 | 既存追加 | schema-full 統合 |
|---------|------|------|---------|-----------------|
| **`schema-full.sql`** | **新規構築用オールインワン** | ✅ これだけ | — | — |
| `schema.sql` | 旧・基盤スキーマ | 非推奨 | 済みなら不要 | ✅ |
| `schema-auth.sql` | profiles / RLS 再適用 | 非推奨 | 必要時 | ✅ |
| `ensure-user-profile-rpc.sql` | 初回ログイン RPC | 非推奨 | 関数欠落時 | ✅ |
| `add-project-items.sql` | 案件明細 | — | ✅ | ✅ |
| `add-construction-item-fields.sql` | W/H・工事場所 | — | ✅ | ✅ |
| `add-project-date-fields.sql` | 確定日・完了日 | — | ✅ | ✅ |
| `add-project-schedule-fields.sql` | 予定表用列 | — | 古い DB のみ | ✅ |
| `add-project-archived.sql` | アーカイブ | — | 古い DB のみ | ✅ |
| `add-quote-validity-days.sql` | 有効期限日数 | — | patch で代替可 | ✅ |
| `add-document-memo-templates.sql` | 備考テンプレ | — | patch で代替可 | ✅ |
| `add-company-fax-contact.sql` | FAX・担当者 | — | patch で代替可 | ✅ |
| `add-quote-expiry-type.sql` | 期限タイプ | — | ✅ | ✅ |
| `patch-company-settings.sql` | 会社設定列まとめ | — | ✅ 推奨 | ✅ |
| `add-item-template-categories.sql` | カテゴリマスタ | — | ✅ | ✅ |
| `patch-item-template-categories-rls.sql` | カテゴリ RLS 修正 | — | エラー時のみ | — |
| `add-document-management.sql` | 書類・口座 | — | ✅ | ✅ |
| `reset-transaction-data.sql` | 案件等データ削除 | — | 開発用 | — |

---

## デプロイ（Vercel）

### 必須の環境変数

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### デプロイ前チェック

```bash
npm run lint
npm run build
```

---

## 画面一覧

| パス | 画面 |
|------|------|
| `/` | ダッシュボード |
| `/projects` | 案件一覧 |
| `/projects/new` | 案件作成 |
| `/projects/[id]` | 案件詳細 |
| `/projects/[id]/edit` | 案件編集 |
| `/projects/schedule` | 予定表 |
| `/quotes` | 見積一覧 |
| `/quotes/new` | 見積作成 |
| `/quotes/[id]` | 見積詳細 |
| `/quotes/[id]/edit` | 見積編集 |
| `/orders` | 注文書一覧 |
| `/delivery-notes` | 納品書一覧 |
| `/invoices` | 請求書一覧 |
| `/invoices/new` | 請求書作成 |
| `/payments` | 入金管理 |
| `/receipts` | 領収書一覧 |
| `/recurring-billings` | 定期請求 |
| `/customers` | 顧客一覧 |
| `/item-templates` | 請求項目テンプレ |
| `/settings/company` | 会社設定 |
| `/login` | ログイン |

---

## アーキテクチャ

データ操作は `lib/services/` に集約し、Zustand ストア + Supabase（またはモック）で動作します。

```
lib/services/     → ビジネスロジック
lib/db/write-*.ts → Supabase 永続化
stores/           → クライアント状態
supabase/         → SQL（新規: schema-full.sql）
```

## 備考

- 本番運用では Supabase の SQL 適用と Auth URL 設定が必須です。
- データのみリセットしたい場合: `supabase/reset-transaction-data.sql`（開発用）
