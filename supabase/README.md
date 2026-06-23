# FlowBill — Supabase SQL

## 新規環境（推奨）

Supabase SQL Editor で **次の1ファイルだけ** を実行してください。

```
supabase/schema-full.sql
```

これで FlowBill に必要なテーブル・列・RLS・関数がすべて揃います。

手順の詳細はリポジトリ直下の [README.md](../README.md#supabase新規セットアップ) を参照してください。

---

## 既存環境のアップデート

すでに `schema.sql` 等を適用済みの DB は、**不足している追加 SQL のみ** を順番に実行してください。  
各ファイルは `IF NOT EXISTS` / `DROP POLICY IF EXISTS` 等で再実行しやすくなっています。

| 順 | ファイル | 役割 | schema-full に統合 | 備考 |
|----|---------|------|-------------------|------|
| — | `schema-full.sql` | **新規構築用オールインワン** | — | 新規のみ。既存 DB への上書き適用は非推奨 |
| 1 | `schema.sql` | 基盤テーブル・RLS・`ensure_user_profile` | ✅ 統合済 | 旧新規手順。新規は schema-full を使用 |
| 2 | `schema-auth.sql` | profiles / RLS 再適用 | ✅ 統合済 | schema.sql 後の旧手順。重複実行可 |
| 3 | `ensure-user-profile-rpc.sql` | `ensure_user_profile()` 関数 | ✅ 統合済 | 関数のみ再適用したい場合 |
| 4 | `add-project-items.sql` | `project_items` テーブル・明細 `unit` 列 | ✅ 統合済 | 案件明細 |
| 5 | `add-construction-item-fields.sql` | W/H 列・工事場所・顧客 FAX | ✅ 統合済 | 建築業向け明細 |
| 6 | `add-project-date-fields.sql` | `confirmed_date` / `completed_date` | ✅ 統合済 | 案件日付 |
| 7 | `add-project-schedule-fields.sql` | `start_date` / `end_date` / `assignee_name` | ✅ 統合済 | schema.sql 新規版には含まれる |
| 8 | `add-project-archived.sql` | `archived` 列 | ✅ 統合済 | schema.sql 新規版には含まれる |
| 9 | `add-quote-validity-days.sql` | `quote_validity_days` | ✅ 統合済 | 後方互換用 |
| 10 | `add-document-memo-templates.sql` | 見積・請求備考テンプレ列 | ✅ 統合済 | patch-company-settings に包含 |
| 11 | `add-company-fax-contact.sql` | FAX・担当者名 | ✅ 統合済 | patch-company-settings に包含 |
| 12 | `add-quote-expiry-type.sql` | `quotes.expiry_type`・デフォルト期限タイプ | ✅ 統合済 | |
| 13 | `patch-company-settings.sql` | 会社設定列の一括追加 | ✅ 統合済 | 個別 SQL のまとめ版 |
| 14 | `add-item-template-categories.sql` | カテゴリマスタ + 初期データ | ✅ 統合済 | |
| 15 | `patch-item-template-categories-rls.sql` | カテゴリ RLS 修正 | — | RLS エラー時のみ |
| 16 | `add-document-management.sql` | 注文書・納品書・領収書・複数口座 | ✅ 統合済 | |
| — | `reset-transaction-data.sql` | 案件・見積・請求データ削除 | — | **開発用**。スキーマ変更ではない |

### 依存関係（既存環境で追いかける場合）

```
schema.sql
  └─（任意）schema-auth.sql / ensure-user-profile-rpc.sql
  └─ add-project-items.sql
  └─ add-construction-item-fields.sql
  └─ add-project-date-fields.sql
  └─ add-project-schedule-fields.sql  ※ schema.sql が古い場合
  └─ add-project-archived.sql         ※ schema.sql が古い場合
  └─ patch-company-settings.sql       ※ または個別 add-* / add-quote-expiry-type
  └─ add-item-template-categories.sql
  └─ add-document-management.sql
```

`patch-item-template-categories-rls.sql` は、カテゴリ追加後に RLS エラーが出る場合のみ。

---

## その他

- **データリセット**: `reset-transaction-data.sql`（案件・見積・請求のみ削除。顧客・会社設定は残す）
- **アプリ側**: 未適用 SQL があると画面上部に警告バナーが表示されます
