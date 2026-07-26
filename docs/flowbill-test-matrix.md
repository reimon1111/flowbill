# FlowBill 全機能テストマトリクス

**調査日:** 2026-07-25  
**注意:** 確認していないものを PASS にしていない。ブラウザはログイン画面まで確認。  
**現状値:** PASS / FAIL / BLOCKED / NOT TESTED / NOT IMPLEMENTED / NEEDS SQL / NEEDS MANUAL CHECK

優先度: P0 データ消失・保存不可・RLS / P1 主要フロー / P2 一部不良 / P3 UI

---

## A. 認証・権限

| ID | 機能領域 | 画面 | 操作 | 前提条件 | テスト手順 | 期待結果 | 優先度 | 現状 | 実装根拠 | 備考 |
|---|---|---|---|---|---|---|---|---|---|---|
| A-01 | 認証 | /login | ログイン | 有効アカウント | メール/PW でログイン | ダッシュボードへ | P0 | NEEDS MANUAL CHECK | session.ts | |
| A-02 | 認証 | 任意 | ログアウト | ログイン済 | ログアウト | /login・store クリア | P1 | NOT TESTED | signOut | |
| A-03 | 認証 | /signup | 未許可登録 | allowed なし | サインアップ | 拒否 | P0 | NOT TESTED | check_signup_allowed | NEEDS SQL |
| A-04 | 認証 | /invite | 招待受諾 | 有効トークン | 招待URL | メンバー参加 | P1 | NOT TESTED | invite page | |
| A-05 | 権限 | 全体 | viewer 書込 | viewer | 顧客作成等 | 拒否メッセージ | P0 | NOT TESTED | write-access | |
| A-06 | 権限 | 全体 | member 書込 | member | 見積保存 | 成功 | P1 | NOT TESTED | | |
| A-07 | 契約 | 全体 | 契約停止 | suspended | 業務画面 | ContractGate | P0 | NOT TESTED | contract-gate | |
| A-08 | RLS | DB | 他社データ | 2社 | 他社 id 直アクセス | 0件/拒否 | P0 | NOT TESTED | RLS | NEEDS SQL |

---

## B. 顧客

| ID | 機能領域 | 画面 | 操作 | 前提条件 | テスト手順 | 期待結果 | 優先度 | 現状 | 実装根拠 | 備考 |
|---|---|---|---|---|---|---|---|---|---|---|
| B-01 | 顧客 | /customers | 一覧 | データあり | 表示 | 一覧 | P1 | NOT TESTED | customer-list | |
| B-02 | 顧客 | /customers | 検索 | | 名前検索 | 絞り込み | P2 | NOT TESTED | | |
| B-03 | 顧客 | /customers/new | 作成保存 | canWrite | 入力→保存 | 詳細へ・再表示一致 | P1 | NOT TESTED | | |
| B-04 | 顧客 | edit | 再編集保存 | | 変更→保存→再表示 | 反映 | P1 | NOT TESTED | | |
| B-05 | 顧客 | detail | 案件・請求 | 紐づきあり | 詳細表示 | 案件1行/見積件数 | P2 | NOT TESTED | quoteCount | |
| B-06 | 顧客 | | 削除 | 制約確認 | 削除 | 制約通り | P2 | NOT TESTED | | |

---

## C. 案件

| ID | 機能領域 | 画面 | 操作 | 前提条件 | テスト手順 | 期待結果 | 優先度 | 現状 | 実装根拠 | 備考 |
|---|---|---|---|---|---|---|---|---|---|---|
| C-01 | 案件 | /projects | 一覧 | | | 1案件1行 | P1 | NOT TESTED | project-list | |
| C-02 | 案件 | /projects | 見積番号検索 | Q-xxx | 検索 | 案件1行のみ | P1 | NOT TESTED | quotes Set | |
| C-03 | 案件 | /projects | 見積件数 | 複数見積 | カード表示 | 「見積 N件」 | P2 | NOT TESTED | project-card | |
| C-04 | 案件 | new | 作成・明細・値引 | | 保存 | 再表示一致 | P1 | NOT TESTED | project-form | NEEDS SQL cols |
| C-05 | 案件 | edit | 再保存 | | | 反映 | P1 | NOT TESTED | | |
| C-06 | 案件 | detail | ステータス操作 | | 受注/完了 | 明示操作のみ | P1 | NOT TESTED | projects.ts | |
| C-07 | 案件 | schedule | 予定表 | 日程あり | 表示 | 重なり表示 | P2 | NOT TESTED | | |
| C-08 | 案件 | | アーカイブ | | | 一覧切替 | P2 | NOT TESTED | | NEEDS SQL |
| C-09 | 案件 | | 追加見積後件数 | 見積3件 | 一覧 | 案件1・見積3 | P0 | NOT TESTED | | 集計連動 |

---

## D. 見積書（最優先領域）

| ID | 機能領域 | 画面 | 操作 | 前提条件 | テスト手順 | 期待結果 | 優先度 | 現状 | 実装根拠 | 備考 |
|---|---|---|---|---|---|---|---|---|---|---|
| D-01 | 見積 | new | 通常作成 | projectId | 保存 | 詳細表示 | P1 | NOT TESTED | createQuote | |
| D-02 | 見積 | new | 追加作成 | 既存見積あり | 同 projectId | 案件増えない | P0 | NOT TESTED | | |
| D-03 | 見積 | form | 手入力明細 | | 追加→保存 | 明細残る | P1 | NOT TESTED | QuoteForm | |
| D-04 | 見積 | form | テンプレ追加 | テンプレあり | | 明細追加 | P1 | NOT TESTED | | |
| D-05 | 見積 | form | W/H/数量/単位/単価/税率 | | | 計算正しい | P1 | NOT TESTED | | |
| D-06 | 見積 | form | 値引・値引後小計 | | | 合計一致 | P1 | NOT TESTED | discount | |
| D-07 | 見積 | form | 敬称・担当 | | | PDF反映 | P2 | NOT TESTED | | NEEDS SQL |
| D-08 | 見積 | **edit** | **再保存（商品名変更）** | 既存見積 | 編集→保存 | 成功 toast・再表示 | **P0** | **FAIL（コード上欠陥）** | quote-edit silent | 実機未完了だがエラー非表示確認済 |
| D-09 | 見積 | edit | 再保存（空手入力行あり） | | 保存 | 明確なバリデーション表示 | P0 | FAIL（コード） | items Zod + 行エラー非表示 | |
| D-10 | 見積 | edit | DB列欠落時 | SQL未適用 | 保存 | 分かるエラー | P0 | FAIL（コード） | writeQuoteRow | NEEDS SQL |
| D-11 | 見積 | edit | 明細INSERT失敗 | 強制失敗 | | 明細空にならない | P0 | FAIL（コード） | delete→insert | データ消失リスク |
| D-12 | 見積 | detail | 提出/承認/否認 | | 各操作 | 見積のみ変更・案件不変 | P1 | NOT TESTED | updateQuoteStatus | |
| D-13 | 見積 | detail | 受注確定 | | ボタン | 案件受注+注文書 | P1 | NOT TESTED | confirmOrderWithQuote | |
| D-14 | 見積 | detail | 削除 | draft | | 物理削除・案件残 | P1 | NOT TESTED | dbDeleteQuote | |
| D-15 | 見積 | | PDF/印刷 | | | 内容一致 | P2 | NOT TESTED | | |
| D-16 | 見積 | detail | 案件詳細一覧 | 複数見積 | タブ | 全件表示 | P1 | NOT TESTED | project-detail | |
| D-17 | 見積 | edit | sent/accepted 編集 | | 保存 | 仕様通り（現状禁止なし） | P2 | NOT TESTED | | 仕様要確認 |
| D-18 | 見積 | | スマホ幅保存 | | | 同上 | P2 | NOT TESTED | | |

---

## E. 注文書

| ID | 機能領域 | 画面 | 操作 | 前提条件 | テスト手順 | 期待結果 | 優先度 | 現状 | 実装根拠 | 備考 |
|---|---|---|---|---|---|---|---|---|---|---|
| E-01 | 注文書 | 案件/見積 | 作成 | | | スナップショット | P1 | NOT TESTED | commercial-documents | /newなし |
| E-02 | 注文書 | edit | 再保存 | | | 反映・エラー表示 | P1 | NOT TESTED | commercial-document-edit | null silent の可能性 |
| E-03 | 注文書 | | soft delete | | | 一覧から消える | P1 | NOT TESTED | | NEEDS SQL |
| E-04 | 注文書 | | PDF | | | | P2 | NOT TESTED | | |

---

## F. 納品書

| ID | 機能領域 | 画面 | 操作 | 前提条件 | テスト手順 | 期待結果 | 優先度 | 現状 | 実装根拠 | 備考 |
|---|---|---|---|---|---|---|---|---|---|---|
| F-01 | 納品書 | 案件 | 作成 | completed | | 引継ぎ正しい | P1 | NOT TESTED | | |
| F-02 | 納品書 | edit | 再保存 | | | 反映 | P1 | NOT TESTED | | |
| F-03 | 納品書 | | 削除/PDF | | | | P2 | NOT TESTED | | |

---

## G. 請求書

| ID | 機能領域 | 画面 | 操作 | 前提条件 | テスト手順 | 期待結果 | 優先度 | 現状 | 実装根拠 | 備考 |
|---|---|---|---|---|---|---|---|---|---|---|
| G-01 | 請求 | new | 案件/見積から | | | 作成成功 | P1 | NOT TESTED | invoices | |
| G-02 | 請求 | edit | 再保存 | | | toast ありで成功/失敗 | P1 | NOT TESTED | invoice-edit | エラー処理は見積より良い |
| G-03 | 請求 | | 発行/送付/取消 | | | 状態遷移 | P1 | NOT TESTED | | |
| G-04 | 請求 | | 入金済み | | | payment 同期 | P0 | NOT TESTED | | |
| G-05 | 請求 | | 期限超過 | 期日超過 | 同期 | overdue | P1 | NOT TESTED | background-init | |
| G-06 | 請求 | | 振込先・値引・PDF | | | | P2 | NOT TESTED | | |
| G-07 | 請求 | | 複数請求集計 | | 二重加算なし | P0 | NOT TESTED | | |

---

## H. 領収書

| ID | 機能領域 | 画面 | 操作 | 前提条件 | テスト手順 | 期待結果 | 優先度 | 現状 | 実装根拠 | 備考 |
|---|---|---|---|---|---|---|---|---|---|---|
| H-01 | 領収 | | 請求から作成 | | | 引継ぎ | P1 | NOT TESTED | | |
| H-02 | 領収 | edit | 再保存 | | | 反映 | P1 | NOT TESTED | | |
| H-03 | 領収 | | PDF/削除 | | | | P2 | NOT TESTED | | |

---

## I. 入金・ダッシュボード

| ID | 機能領域 | 画面 | 操作 | 前提条件 | テスト手順 | 期待結果 | 優先度 | 現状 | 実装根拠 | 備考 |
|---|---|---|---|---|---|---|---|---|---|---|
| I-01 | 入金 | /payments | 未入金/超過/入金 | | 入金処理 | 請求・案件同期 | P0 | NOT TESTED | payments.ts | |
| I-02 | 入金 | | 取消 | | | 状態戻る | P1 | NOT TESTED | | |
| I-03 | Dash | / | KPI | 追加見積後 | | 案件数増えない | P0 | NOT TESTED | dashboard | |
| I-04 | Dash | / | 二重集計 | | | なし | P0 | NOT TESTED | | |

---

## J. 定期請求

| ID | 機能領域 | 画面 | 操作 | 前提条件 | テスト手順 | 期待結果 | 優先度 | 現状 | 実装根拠 | 備考 |
|---|---|---|---|---|---|---|---|---|---|---|
| J-01 | 定期 | list | 作成直後表示 | | 作成 | 一覧に出る | P1 | NOT TESTED | recurring store | |
| J-02 | 定期 | list | **再ログイン後** | Supabase | ログアウト→ログイン | **一覧に残る** | **P0** | **FAIL（コード: load-all未読込）** | load-all.ts | |
| J-03 | 定期 | | 請求書生成 | | | 請求作成 | P1 | NOT TESTED | services/recurring | |
| J-04 | 定期 | edit | 再保存・再表示 | | | | P1 | NOT TESTED | | J-02に依存 |

---

## K. 品目テンプレート・会社設定

| ID | 機能領域 | 画面 | 操作 | 前提条件 | テスト手順 | 期待結果 | 優先度 | 現状 | 実装根拠 | 備考 |
|---|---|---|---|---|---|---|---|---|---|---|
| K-01 | テンプレ | list | CRUD・検索・★ | | | | P1 | NOT TESTED | | |
| K-02 | テンプレ | | カテゴリ操作 | | UIで操作 | | P3 | NOT IMPLEMENTED | 孤立コンポーネント | ユーザー未使用と一致 |
| K-03 | 会社 | settings | 保存→帳票反映 | | ロゴ等 | PDF反映 | P1 | NOT TESTED | | Storage未使用 |
| K-04 | 会社 | | 口座・招待 | | | | P1 | NOT TESTED | | |

---

## L. 静的品質（本調査で実施）

| ID | 機能領域 | 画面 | 操作 | 前提条件 | テスト手順 | 期待結果 | 優先度 | 現状 | 実装根拠 | 備考 |
|---|---|---|---|---|---|---|---|---|---|---|
| L-01 | 品質 | - | lint | | npm run lint | error 0 | P2 | PASS | | warning 7 |
| L-02 | 品質 | - | build | | npm run build | 成功 | P1 | PASS | | |
| L-03 | 品質 | - | 単体/E2E | | | | P2 | NOT IMPLEMENTED | | テストFWなし |

---

## 手動テスト実施メモ欄

| 実施日 | 実施者 | 環境（local/Supabase） | 結果サマリ |
|--------|--------|------------------------|------------|
| | | | |
