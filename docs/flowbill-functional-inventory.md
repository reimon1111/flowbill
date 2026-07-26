# FlowBill 機能棚卸し（実装状態インベントリ）

**調査日:** 2026-07-25  
**方針:** 概要書を正とせずコード再照合。実装修正なし。  
**判定記号:** 下記「状態」列を参照。ブラウザ実機操作は未ログインのため主要フローは **未確認**。

### 状態区分

| 区分 | 意味 |
|------|------|
| 実装済み・動作確認済み | コードあり＋今回実機で確認 |
| 実装済み・未確認 | コードあり・実機未確認 |
| 一部実装 | 画面/ロジックが片方欠け or 導線未接続 |
| UIのみ存在 | コンポーネントはあるがページから未使用 |
| 処理のみ存在 | DB/サービスはあるが画面不足 |
| 未実装 | 見当たらない |
| 不具合あり | コード上の欠陥が確認できる |
| SQL適用状況によって動作が変わる | 追加 SQL 依存 |
| ローカルモードのみ / Supabaseのみ | 分岐あり |
| コードとDB定義が不一致 | 型・列・削除方式などの食い違い |

---

## 1. 画面別機能一覧

### 認証・権限

| 機能 | 状態 | 根拠 |
|------|------|------|
| ログイン | 実装済み・未確認 | `login-form.tsx`, `lib/auth/session.ts` |
| ログアウト | 実装済み・未確認 | `session.signOut` + store clear |
| サインアップ制限 | 実装済み・未確認 / SQL依存 | RPC `check_signup_allowed`, `allowed_signups` |
| 招待 | 実装済み・未確認 | `/invite/[token]`, `accept_company_invitation` |
| owner/admin/member/viewer | 実装済み・未確認 | `company_members.role`, `guards/write-access.ts` |
| 契約停止ゲート | 実装済み・未確認 | `ContractGate`, `contract_status` |
| 他社データ分離 / company_id / RLS | 実装済み・未確認 / SQL依存 | `resolveCompanyId`, RLS policies in SQL |
| viewer 書込拒否 | 実装済み・未確認 | `assertCanWriteBusinessData`（UI 抜け穴は帳票ごとに差） |

### 顧客

| 機能 | 状態 | 根拠 |
|------|------|------|
| 一覧・検索・CRUD | 実装済み・未確認 | `customer-list/detail/form`, `services/customers.ts` |
| 顧客詳細の案件 | 実装済み・未確認 | `customers/[id]/page.tsx` + `quoteCount` |
| 請求履歴 | 実装済み・未確認 | 同ページ invoices filter |

### 案件

| 機能 | 状態 | 根拠 |
|------|------|------|
| 一覧・検索・フィルタ・年 | 実装済み・未確認 | `project-list.tsx` |
| 見積番号検索で案件1行 | 実装済み・未確認 | `project-list` + quotes Set |
| 見積件数表示 | 実装済み・未確認 | `project-card` + `project-quotes.ts` |
| 作成・編集・明細・値引・敬称・担当 | 実装済み・未確認 / SQL依存 | `project-form`, write-projects |
| ステータス / 受注確定 / 作業完了 | 実装済み・未確認 | `services/projects.ts` |
| 予定表 | 実装済み・未確認 | `project-schedule-page.tsx` |
| アーカイブ | 実装済み・未確認 | `archived` 列 SQL依存 |
| 複数見積で案件が増えない | 実装済み・未確認（コード上 createQuote は project insert しない） | `quote-store.createQuote`, `write-quotes` |

### 見積書

| 機能 | 状態 | 根拠 |
|------|------|------|
| 通常/追加作成 | 実装済み・未確認 | `/quotes/new?projectId=` |
| 手入力・テンプレ明細 | 実装済み・未確認 | `QuoteForm` |
| W/H/数量/単位/単価/税率/値引 | 実装済み・未確認 | validations + editor |
| 保存（新規） | 実装済み・未確認 | `createQuote` |
| **再編集・再保存** | **不具合あり** | 調査詳細: `docs/quote-edit-save-investigation.md` |
| ステータス変更 | 実装済み・未確認 | `updateQuoteStatus`（案件非連動はコード確認済） |
| 受注確定（明示） | 実装済み・未確認 | `confirmOrderWithQuote` |
| 削除 | 実装済み・未確認 / **物理削除** | `dbDeleteQuote` DELETE |
| PDF/印刷 | 実装済み・未確認 | `useDocumentExport`, `QuotePreview` |
| 同一案件複数見積 | 実装済み・未確認 | project_id 共有 |

### 注文書・納品書・領収書

| 機能 | 状態 | 根拠 |
|------|------|------|
| 一覧・詳細・編集 | 実装済み・未確認 | commercial-document 系 |
| `/new` ページ | 未実装 | 案件詳細等から作成 |
| soft delete | 実装済み・未確認 / SQL依存 | `deleted_at` |
| スナップショット明細 | 実装済み・未確認 | delete+insert パターン |
| 編集保存エラー表示 | 一部実装 | `commercial-document-edit` は null 時 silent return あり |

### 請求書・入金

| 機能 | 状態 | 根拠 |
|------|------|------|
| CRUD・発行・取消・入金 | 実装済み・未確認 | `services/invoices`, `payments` |
| 編集保存エラー | 実装済み（コード上は toast あり）・動作未確認 | `invoice-edit.tsx` |
| 期限超過更新 | 実装済み・未確認 | `refreshOverdueInvoices` / background-init |
| ダッシュボード反映 | 実装済み・未確認 | `dashboard-page.tsx` |

### 定期請求

| 機能 | 状態 | 根拠 |
|------|------|------|
| 一覧・作成・編集・請求生成 | 一部実装〜不具合リスク | UI + `write-recurring.ts` あり |
| **初回 load-all での SELECT** | **不具合あり（コード確認）** | `load-all.ts` に `recurring_*` **なし** |
| 再ログイン後表示 | `[推測]` 消える可能性 | hydrate されないため store 空 |

### 品目テンプレート

| 機能 | 状態 | 根拠 |
|------|------|------|
| 一覧・検索・お気に入り・CRUD | 実装済み・未確認 | `item-template-list/form` |
| **カテゴリ UI** | **UIのみ存在** | `CategoryFilter/Select/ManagerDialog` が **どの page からも import されない** |
| `item_templates.category` | 処理のみ存在 | create 時固定 `"その他"`（`item-templates.ts`） |
| `item_template_categories` テーブル | SQL + load-all hydrate あり / 画面未接続 | `load-all.ts` L102 |

### 会社設定

| 機能 | 状態 | 根拠 |
|------|------|------|
| 会社情報・メモテンプレ・支払条件 | 実装済み・未確認 / SQL依存 | `company-settings-form` |
| ロゴ/印/署名 | 実装済み・未確認 | data URL → `companies` UPDATE（Storage 未使用） |
| 振込口座 | 実装済み・未確認 | `bank-accounts-manager` |
| メンバー招待 | 実装済み・未確認 | membership services |

### ダッシュボード

| 機能 | 状態 | 根拠 |
|------|------|------|
| 案件/未請求/未入金等 KPI | 実装済み・未確認 | projects 基準（追加見積で案件増えない設計） |
| 見積件数 KPI | 要確認 | ダッシュボードが見積件数を明示するかは要画面確認 |

---

## 2. 仕様の矛盾・未整理

### 2.1 テンプレートカテゴリ

- ユーザー認識: カテゴリ未使用 → **コードと一致（一覧・作成フォームにカテゴリ欄なし）**
- 概要書記載のカテゴリ機能: **DB・ストア・孤立コンポーネントは残存**（死蔵）
- `item_templates.category`（文字列）と `item_template_categories`（マスタ）に **FK なし**。UI 未接続のため実質未使用

### 2.2 見積削除（物理） vs 他帳票（論理）

| | quotes | orders/invoices/delivery/receipts |
|--|--------|-------------------------------------|
| コード | `DELETE` | `deleted_at` |
| SQL soft-delete | quotes 用なし | あり |

意図的かはコメントなし。注文書の `quote_id` は軟参照のため、見積削除後も注文は残るが参照切れになりうる。

### 2.3 定期請求の初期ロード欠落

`load-all.ts` は recurring を読まない。`write-recurring` のみ。  
→ 作成直後は store に載るが、フルリロード後は空の可能性が高い。

### 2.4 見積ステータスと案件

- `updateQuoteStatus` は案件を自動変更しない `[確認済み]`（store / write-quotes）
- UI 文言の一部に古い説明残存の可能性（`quote-form` 「見積提出済」文言）

### 2.5 採用見積 ID

`projects.accepted_quote_id` 等は **なし**。受注確定は処理フローのみ。

---

## 3. 新規 vs 編集 / 通常 vs 追加見積

| 観点 | 結果 |
|------|------|
| 通常見積と追加見積 | **同一** `QuoteForm` + `createQuote`（projectId 指定） |
| 新規 vs 編集 | 別コンポーネント。編集側のエラーハンドリングが請求より弱い |
| 帳票コピー実装 | commercial / quote / invoice で類似の form + items state パターン |

---

## 4. ローカル vs Supabase

| モード | 特徴 |
|--------|------|
| ローカル（env 未設定） | Zustand のみ。`dbUpdateQuote` を通らない → 編集保存は store 上成功しうる |
| Supabase | RLS・列・明細置換のリスクが顕在化 |

→ **モックでは成功・本番では失敗** が起きやすい領域: 見積更新、追加列、定期請求再表示。

---

## 5. lint / build（本調査時）

- `npm run lint`: エラー 0 / warning 7（既存）
- `npm run build`: 成功
- テストコマンド: **なし**（Playwright/Vitest 未導入）
- 型チェック専用 script: **なし**（build 内 TS は通過）
