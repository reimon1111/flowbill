# FlowBill 不具合・リスク報告書

**調査日:** 2026-07-25  
**実装修正:** なし（本ドキュメントと関連 docs のみ作成）  
**関連:** `quote-edit-save-investigation.md` / `flowbill-functional-inventory.md` / `flowbill-test-matrix.md`

---

## 1. 不具合一覧

| ID | 優先度 | 領域 | 問題 | 再現条件 | 原因候補 | 影響 | 修正方針 | 関連ファイル |
|---|---|---|---|---|---|---|---|---|
| BUG-001 | **P0** | 見積編集 | 保存しても成功/失敗が分からない／保存できないように見える | 既存見積を編集→保存 | try/catch なし・`if (!updated) return`・Zod invalid 時 toast なし | 業務停止・変更が残らない | invoice-edit 同等のエラー処理＋onInvalid | `quote-edit.tsx`, `quote-form.tsx` |
| BUG-002 | **P0** | 見積明細 | UPDATE 後に明細が空になりうる | 親UPDATE成功→明細DELETE→INSERT失敗 | 非トランザクション置換 | **データ消失** | トランザクション or INSERT成功後DELETE / ロールバック | `write-quotes.ts` |
| BUG-003 | **P0** | 定期請求 | 再ログイン後に一覧が空になる可能性 | Supabase 利用・作成後フルリロード | `load-all` に recurring SELECT なし | データが消えたように見える | load-all に追加 | `load-all.ts`, `write-recurring.ts` |
| BUG-004 | **P0** | 見積更新 | 追加列未適用 DB で UPDATE 失敗 | honorific/discount/contact SQL 未適用 | フォールバックが expiry_type のみ | 保存不可 | マイグレ確認＋フォールバック or 必須適用 | `write-quotes.ts`, add-*.sql |
| BUG-005 | P1 | 見積UI | 明細 Zod エラーが行に出ない | 空商品名のまま保存 | ConstructionLineItemsEditor が form errors 非連携 | 無反応に見える | 行エラー表示 / 空行除去 | `construction-line-items-editor.tsx` |
| BUG-006 | P1 | 帳票編集 | commercial-document-edit も null 時 silent | 注文等の更新失敗 | `if (!updated) return` | 保存失敗が不可視 | toast 追加 | `commercial-document-edit.tsx` |
| BUG-007 | P1 | 見積削除 | 物理削除のみ・他は論理削除 | 見積削除 | 設計差 | 参照切れ・復旧不可 | 仕様決定→必要なら soft delete | `write-quotes.ts` |
| BUG-008 | P2 | テンプレ | カテゴリUIが死蔵 | — | page から未 import | 混乱・メンテコスト | 削除 or 本実装 | category-*.tsx |
| BUG-009 | P2 | 見積フォーム | ステータス表示が常に「下書き」 | 編集画面 | ハードコード | 誤解 | 実 status 表示 | `quote-form.tsx` |
| BUG-010 | P2 | 見積フォーム | 「提出済みにすると案件が…」古い文言 | | 案件非連動後の残渣 | 誤解 | 文言修正 | `quote-form.tsx` |
| BUG-011 | P2 | 明細UI | React key が index | 並び替え | `key={line-item-${idx}}` | フォーカス不安定の可能性 | 安定 key | construction-line-items-editor |
| BUG-012 | P3 | 数量バリデーション | UI min 0.01 vs Zod min 1 | 小数数量 | スキーマ不一致 | 保存拒否 | 仕様統一 | quote.ts / editor |

---

## 2. リスク一覧（未再現だがコード上）

| ID | 優先度 | 内容 | 根拠 |
|----|--------|------|------|
| RISK-001 | P0 | モックでは編集保存成功・本番で失敗 | local は store のみ / Supabase は BUG-001–004 |
| RISK-002 | P0 | RLS 拒否が silent | fetch 0件 → null → return |
| RISK-003 | P1 | viewer が編集画面を開けるが保存時 throw（UI未ガード） | quote-edit に canWrite なし |
| RISK-004 | P1 | 見積削除後も order.quote_id が残骸 | 軟参照＋物理削除 |
| RISK-005 | P1 | 採用見積 ID 未保存 | accepted_quote_id なし |
| RISK-006 | P2 | Storage 未使用・巨大 data URL | companies カラム肥大 |

---

## 3. SQL とコードの照合

### 3.1 コードが参照し、追加 SQL / schema-full に定義があるもの（適用は要DB確認）

| 領域 | カラム/テーブル | SQL ファイル | アプリ使用 |
|------|-----------------|--------------|------------|
| 値引 | discount_label/amount | add-document-discounts.sql / schema-full | ○ |
| 敬称 | customer_honorific | add-customer-honorific.sql / schema-full | ○ |
| 先方担当 | customer_contact_* | add-counterparty-contact.sql / schema-full | ○ |
| 見積期限タイプ | expiry_type | add-quote-expiry-type.sql / schema-full | ○（欠落フォールバックあり） |
| 監査列 | created_by/updated_by | add-audit-fields.sql | ○ withCreate/UpdateAudit |
| activity_logs | テーブル | add-activity-logs.sql | ○ |
| soft delete | deleted_at（注文等） | add-commercial-document-soft-delete.sql | ○ |
| invoice soft delete | deleted_at | add-invoice-soft-delete.sql / schema-full | ○ |
| 工事寸法 | width/height | add-construction-item-fields.sql | ○（insert fallback） |
| カテゴリマスタ | item_template_categories | add-item-template-categories.sql | load のみ・UI未接続 |
| 定期請求 | recurring_* | schema-full | write のみ・**load-all なし** |

**適用済みかはコードだけでは断定不可 → `NEEDS DATABASE VERIFICATION`**

### 3.2 不一致・ギャップ一覧

| # | 内容 | 種別 |
|---|------|------|
| 1 | quotes に soft delete なし（他帳票あり） | 設計差 / 不一致の可能性 |
| 2 | recurring が load-all 未読込 | コード不備 |
| 3 | category UI 未接続だがテーブル・hydrate あり | 一部実装 |
| 4 | Storage bucket SQL なし・アプリも未使用 | 一致（未使用） |
| 5 | accepted_quote_id 等なし | 機能未実装 |
| 6 | write_status 等は schema 依存 | NEEDS DATABASE VERIFICATION |

**不一致件数（本調査のカウント）:**  
- 明確なコード欠陥に起因: **2**（recurring load、quotes soft-delete 方針差）  
- UI/スキーマ死蔵: **1**（カテゴリ）  
- DB適用不明で要検証の列群: **1セット（NEEDS DATABASE VERIFICATION）**  
→ 報告用に **コード↔SQL ギャップ項目 約 4〜6**（検証セット込み）

### 3.3 SQL にあるがアプリ未使用（またはほぼ未使用）

| 対象 | 状況 |
|------|------|
| `item_template_categories` UI | hydrate されるが画面未使用 |
| `item_templates.category` の可変運用 | 固定「その他」 |
| companies の単一銀行レガシー列 | bank_accounts 併用の可能性 → 要確認 |
| logo/stamp の Storage | URL 文字列のみ |

### 3.4 確認用 SQL（SELECT のみ）

```sql
-- 必須追加列（quotes）
SELECT column_name
FROM information_schema.columns
WHERE table_schema='public' AND table_name='quotes'
  AND column_name IN (
    'discount_label','discount_amount','customer_honorific',
    'customer_contact_name','customer_department','customer_position',
    'expiry_type','created_by','updated_by'
  )
ORDER BY 1;

-- soft delete
SELECT table_name, column_name
FROM information_schema.columns
WHERE table_schema='public'
  AND column_name='deleted_at'
  AND table_name IN ('quotes','invoices','orders','delivery_notes','receipts')
ORDER BY 1;

-- recurring / categories / activity
SELECT to_regclass('public.recurring_billings') AS recurring_billings,
       to_regclass('public.item_template_categories') AS item_template_categories,
       to_regclass('public.activity_logs') AS activity_logs;

-- RLS 有効
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname='public'
  AND tablename IN ('quotes','quote_items','projects','recurring_billings')
ORDER BY 1;
```

**破壊・変更 SQL は実行しないこと。**

---

## 4. 技術的負債

1. 新規と編集でエラーハンドリング品質が不均一（請求 > 見積）
2. 帳票フォームの「items は useState、RHF は同期」パターンが複数コピー
3. 孤立カテゴリコンポーネント
4. テストフレームワーク未導入
5. API Route なし・クライアント直 Supabase（デバッグは Network 依存）
6. 明細置換の非トランザクションが複数 write モジュールに存在しうる

---

## 5. 横断品質チェック結果（抜粋）

| 項目 | 結果 |
|------|------|
| await 漏れ（見積保存） | handleSave は await あり。エラー未処理 |
| catch 握りつぶし | quote-edit は catch 自体なし |
| soft delete 条件 | quotes は物理削除 |
| company_id | write は eq company_id あり |
| viewer | サービス層ガード、一部 UI 未 |
| モック vs Supabase | RISK-001 |
| React key | index 使用あり |
| TODO/FIXME | 業務コードに目立った大量なし |
| lint | error 0 |
| build | 成功 |

---

## 6. 推奨修正順（依存関係付き）

```text
1. BUG-001 見積編集のエラー可視化（toast/catch/onInvalid）
   └─ これがないと真因切り分け不能
2. BUG-002 明細置換の原子性（データ消失防止）
   └─ 1 と同時推奨（P0）
3. DB検証 SQL 実行 → BUG-004（欠落列の適用 or フォールバック）
4. BUG-003 定期請求を load-all に追加
5. BUG-005 明細バリデーション表示
6. BUG-006 他帳票 edit の silent return 一掃
7. 新規/編集エラーハンドリング共通化
8. 見積削除方針の仕様決定（BUG-007）
9. 請求・入金・金額の手動回帰（マトリクス G/I）
10. ダッシュボード集計回帰（I-03/I-04）
11. PDF・レスポンシブ・文言（BUG-009/010, P3）
12. カテゴリ死蔵コード整理（BUG-008）
```

**依存:**  
- 1 → 手動再現の精度向上  
- 2 は 1 と独立に直すべき（消失防止）  
- 3 は本番 DB 確認が前提  
- 4 は load-all 変更のみで完結しうる  

---

## 7. 件数サマリ（チャット報告用）

| 指標 | 数 |
|------|-----|
| P0（本表 BUG） | **4**（BUG-001〜004） |
| P1 | **3**（BUG-005〜007） |
| P2 | **4**（BUG-008〜011） |
| P3 | **1**（BUG-012） |
| SQL/コードギャップ項目 | **約 4〜6**（検証セット含む） |
| 実機 PASS した主要業務 | **0**（ログイン不可） |
| コード上 FAIL と判断 | 見積編集エラー処理、明細原子性、定期 load |

---

## 8. 最初に修正すべき項目

1. **見積編集保存のエラーハンドリング（BUG-001）**  
2. **明細 delete→insert の原子性（BUG-002）**  
3. **DB 列適用確認（BUG-004）**  
4. **定期請求 load-all（BUG-003）**
