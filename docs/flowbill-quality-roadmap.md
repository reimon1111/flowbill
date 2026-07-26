# FlowBill 品質保証ロードマップ

**作成日:** 2026-07-26  
**調査範囲:** `src/` 全体（DB write / load / services / stores / UI）  
**方針:** コード修正なし（本ドキュメントのみ）  
**前提:** P0-1〜P0-3 完了済み。P0-4 は現行環境で未再現のため保留。

関連ドキュメント:

- `docs/flowbill-p0-root-causes.md`（P0 確定原因）
- `docs/flowbill-bug-risk-report.md`（一部陳腐化あり。本ドキュメントが現行優先）
- `docs/flowbill-functional-inventory.md`
- `docs/flowbill-test-matrix.md`

---

## 凡例

| 項目 | 意味 |
|------|------|
| 難易度 | 低 / 中 / 高 |
| 修正時間目安 | 実装〜最低限の動作確認まで（レビュー・本番適用・E2E は含まない） |
| 他画面への影響 | 修正時に一緒に触る／回帰確認が必要な範囲 |

横断チェック結果（要約）:

| 調査項目 | 結果 |
|----------|------|
| `TODO` / `FIXME` / `HACK` | `src` 内 **0 件** |
| `any` / `@ts-ignore` / `@ts-expect-error` | `src` 内 **0 件**（良好） |
| `console.log` 残存 | `company-membership.ts` にデバッグ log あり |
| P0-1〜3 | 完了（見積エラー可視化 / 見積 RPC / 定期 load-all） |
| P0-4 | 保留（カラム未適用時は失敗確定だが現行環境は未再現） |

---

## P1（近いうちに直したい）

データ消失・業務フロー破綻・テナント境界・「保存したのに失敗が見えない」系。

### P1-01. 請求・帳票・定期の明細置換が非トランザクション（DELETE→INSERT）

| 項目 | 内容 |
|------|------|
| **原因** | `write-invoices.ts` / `write-commercial-documents.ts`（`replaceCommercialItems`）/ `write-recurring.ts` / `write-project-items.ts` が親 UPDATE 後に明細 DELETE→INSERT。見積のみ RPC `update_quote_with_items` で原子化済み。DELETE の `error` を破棄している箇所もある。 |
| **影響** | INSERT 失敗時に明細が空になる（データ消失）。請求・注文・納品・領収・定期・案件明細で再発しうる。 |
| **修正方法** | 見積と同様の RPC（親+明細の原子更新）を導入。最低限: DELETE の error 検査、失敗時は throw し空 hydrate しない。 |
| **難易度** | 高（RPC 設計）／暫定は中 |
| **修正時間目安** | RPC 一式 1〜2 日／帳票ごと。暫定 error 検査のみなら 2〜4 時間 |
| **他画面への影響** | 請求編集、注文/納品/領収編集、定期編集、案件編集。保存回帰必須 |

---

### P1-02. 定期請求→請求書の 2 回目以降が壊れる

| 項目 | 内容 |
|------|------|
| **原因** | `createInvoiceFromRecurring` が同一案件を再利用し、`createInvoice` は既存請求があると `allowAdditional` なしで **既存を silent return**。その後も `dbAdvanceRecurringAfterInvoice` で次回請求日が進む（`recurring.ts` / `invoices.ts`）。 |
| **影響** | 2 回目以降、新規請求が作られず次回日だけ進む。金額回収漏れ・運用事故。 |
| **修正方法** | 定期生成時は常に `allowAdditional: true`、または定期専用作成パス。既存返却時は advance しない。重複時は成功扱いにしない。 |
| **難易度** | 低〜中 |
| **修正時間目安** | 2〜4 時間（仕様確認込み） |
| **他画面への影響** | 定期一覧の「請求書を生成」、請求一覧、案件の請求状態 |

---

### P1-03. 帳票 update/delete が store-first（DB 失敗で UI/DB 乖離）

| 項目 | 内容 |
|------|------|
| **原因** | `commercial-documents.ts` の `updateOrder` / `updateDeliveryNote` / `updateReceipt` および soft-delete が **先に Zustand を更新**し、後から DB。DB throw 時も store は新しい値のまま。納品/領収の create は DB 失敗時の store rollback が注文より弱い。 |
| **影響** | 画面上は保存/削除済み、DB は旧状態。再読込で「戻った」ように見える／逆に幽霊データ。 |
| **修正方法** | quotes/invoices と同様に **DB 成功後 merge**。失敗時は store をロールバック、または再 hydrate。 |
| **難易度** | 中 |
| **修正時間目安** | 4〜8 時間 |
| **他画面への影響** | 注文・納品・領収の新規/編集/削除すべて |

---

### P1-04. commercial / recurring / quote-new などの silent return・try/catch 不足

| 項目 | 内容 |
|------|------|
| **原因** | `commercial-document-edit.tsx`: `if (!updated) return` かつ try/catch なし。`recurring-edit.tsx` / `recurring-new.tsx` / `quote-new.tsx` も catch または null toast が弱い。`project-edit.tsx` は catch あるが null 時 silent。 |
| **影響** | 保存失敗が無反応。P0-1 と同型の UX 障害が他画面に残存。 |
| **修正方法** | `quote-edit` / `invoice-edit` パターンに揃える（try/catch・null toast・権限 toast・`onInvalid`）。 |
| **難易度** | 低 |
| **修正時間目安** | 画面あたり 1〜2 時間。まとめて半日 |
| **他画面への影響** | 対象フォームのみ。パターン共通化すればメンテ容易 |

---

### P1-05. 帳票 write の `company_id` 漏れ（RLS 依存のみ）

| 項目 | 内容 |
|------|------|
| **原因** | `write-commercial-documents.ts` の update/soft-delete/明細 DELETE が `.eq("id")` のみ。`write-recurring.ts` も select/update/明細 DELETE が id 中心。customers / item_templates / bank_accounts / categories にも id-only 経路あり。 |
| **影響** | 現行 RLS が正しければ実害は出にくいが、ポリシー不整合・バグ時に他社行を触れうる。defense in depth 不足。 |
| **修正方法** | 全 mutate/select に `.eq("company_id", companyId)`。DELETE も同様。 |
| **難易度** | 低〜中 |
| **修正時間目安** | 3〜6 時間 |
| **他画面への影響** | テナント境界の回帰（他社 ID 直打ちで触れないこと） |

---

### P1-06. load-all の帳票系エラーが silent skip

| 項目 | 内容 |
|------|------|
| **原因** | orders / delivery_notes / receipts / bank_accounts は `firstError` に含まれず、テーブル欠落以外の失敗でも hydrate をスキップしうる。UI は空一覧＝「データなし」に見える。 |
| **影響** | P0-3 と同型の「消えたように見える」幽霊バグが帳票側で起きうる。 |
| **修正方法** | migration 欠落以外は throw、または migration banner + 明示エラー。空配列で上書きしない。 |
| **難易度** | 低 |
| **修正時間目安** | 2〜3 時間 |
| **他画面への影響** | 起動時ロード、注文書/納品/領収/口座一覧 |

---

### P1-07. `createInvoice` の既存 silent return

| 項目 | 内容 |
|------|------|
| **原因** | `createInvoice` が案件に既存請求があるとエラーなく既存を返す（`allowAdditional` なし）。UI が「新規作成成功」扱いになりうる。P1-02 の根因でもある。 |
| **影響** | 追加請求が作れない／作ったつもりで日付だけ進む。 |
| **修正方法** | 重複時は throw または `{ ok:false, reason }`。呼び出し側で `allowAdditional` を明示。 |
| **難易度** | 低 |
| **修正時間目安** | 2〜3 時間 |
| **他画面への影響** | 請求新規、定期生成、案件からの請求導線 |

---

### P1-08. 親 INSERT 後の明細失敗で孤児親（帳票）

| 項目 | 内容 |
|------|------|
| **原因** | `dbInsertOrder` / `DeliveryNote` / `Receipt` は親 INSERT 後に明細 INSERT。失敗時の親ロールバックが請求・見積ほど揃っていない（納品/領収のサービス層 rollback も弱い）。 |
| **影響** | 明細なしの親帳票が DB に残る。 |
| **修正方法** | 明細失敗時に親 DELETE（error 検査付き）、または作成 RPC。 |
| **難易度** | 中 |
| **修正時間目安** | 3〜5 時間 |
| **他画面への影響** | 帳票新規作成フロー |

---

### P1-09. soft delete / 物理削除の方針不統一と参照残骸

| 項目 | 内容 |
|------|------|
| **原因** | 見積は物理削除。請求は draft=物理 / 発行後=論理。注文・納品・領収は論理。見積削除後も `invoice.quoteId` / `order.quoteId` が残りうる。 |
| **影響** | 復旧不能・参照切れ・一覧と詳細の見え方の差。 |
| **修正方法** | 方針ドキュメント化 → 見積 soft delete または削除時参照 null 化。store の getById も active のみに揃える。 |
| **難易度** | 中〜高（仕様決定込み） |
| **修正時間目安** | 仕様半日 + 実装 1 日〜 |
| **他画面への影響** | 見積削除、請求/注文の参照表示、案件詳細の関連リスト |

---

### P1-10. AppInit の二重ロード / 編集画面 load のキャンセル不足

| 項目 | 内容 |
|------|------|
| **原因** | Strict Mode で `clearAllBusinessStores` + `loadAllDataFromSupabase` が重複しうる。編集画面の `load()` に `cancelled` がなくアンマウント後 setState しうる。 |
| **影響** | 無駄な二重 SELECT、稀な競合・警告。起動体感の悪化。 |
| **修正方法** | モジュール級 init mutex / AbortController。編集 load に cancelled パターン（invite と同型）。 |
| **難易度** | 中 |
| **修正時間目安** | 3〜5 時間 |
| **他画面への影響** | 起動全般、各編集画面 |

---

### P1-11. 数量 Zod と UI / 帳票間の不整合

| 項目 | 内容 |
|------|------|
| **原因** | 案件明細 Zod `min(0.01)`、見積/請求/定期は `min(1)`。UI は `step="any"` + `min={0.01}`。案件→見積コピーで小数数量が拒否されうる。 |
| **影響** | 手入力は通るがコピーや保存で弾かれる。仕様が画面ごとに違う。 |
| **修正方法** | 業務仕様を 1 つに決め、Zod・UI・コピーロジックを揃える。 |
| **難易度** | 低（仕様が決まれば） |
| **修正時間目安** | 2〜4 時間 |
| **他画面への影響** | 全明細エディタ、案件→見積/請求導線 |

---

### P1-12. 定期フォームの UI フィールドと Zod のズレ

| 項目 | 内容 |
|------|------|
| **原因** | 定期が `QuoteItemsEditor`（unit/width/height あり）を使うが Zod/`RecurringBillingInput` に寸法・単位がなく、submit 時に落とす。 |
| **影響** | 入力した単位・寸法が保存されない（ユーザーから見ると消える）。 |
| **修正方法** | スキーマと DB まで通す、または定期専用の簡素 UI にする。 |
| **難易度** | 中 |
| **修正時間目安** | 半日〜1 日（DB 列要否による） |
| **他画面への影響** | 定期新規/編集。見積エディタ共通化の見直し |

---

## P2（改善推奨）

障害化しうるが、頻度・影響が P1 より低い、または UX/運用改善。

### P2-01. 各フォームの `onInvalid` 欠落

| 項目 | 内容 |
|------|------|
| **原因** | 見積・会社設定以外（invoice / commercial / recurring / project）は `handleSubmit(onValid)` のみで invalid 時 toast なし。 |
| **影響** | バリデーション失敗が無反応に見える（P0-1 と同型の UX）。 |
| **修正方法** | 共通 `onInvalid` ヘルパー + 行エラー表示。 |
| **難易度** | 低 |
| **修正時間目安** | 半日 |
| **他画面への影響** | 全帳票フォーム |

---

### P2-02. RHF の items を `useState` + `setValue` で二重管理

| 項目 | 内容 |
|------|------|
| **原因** | 複数フォームで `defaultValues.items: []` 固定 + Effect で同期。初期化レースや空 items での一時 invalid が起きやすい。 |
| **影響** | 稀な初期表示・検証のちらつき。メンテコスト高。 |
| **修正方法** | `useFieldArray` へ寄せる、または `defaultItems` を最初から defaultValues に載せる。 |
| **難易度** | 中 |
| **修正時間目安** | フォームあたり 2〜4 時間 |
| **他画面への影響** | 全明細付きフォーム |

---

### P2-03. 起動時フル `select("*")` のパフォーマンス

| 項目 | 内容 |
|------|------|
| **原因** | `loadAllDataFromSupabase` が全業務テーブルを並列フルロード。削除済み行も SQL で除外していない（store 側フィルタ）。 |
| **影響** | データ増で起動遅延・メモリ増。モバイル回線で顕著。 |
| **修正方法** | 画面別遅延ロード、列指定、`.is("deleted_at", null)`、ページング。 |
| **難易度** | 高 |
| **修正時間目安** | 段階導入で数日〜 |
| **他画面への影響** | 初期化・一覧の読み方全般 |

---

### P2-04. `syncProjectInvoiceFields` が soft-deleted 請求を除外しない可能性

| 項目 | 内容 |
|------|------|
| **原因** | 案件の請求状態同期 SELECT で `deleted_at` フィルタが弱い経路がある（`write-invoices.ts` 周辺）。 |
| **影響** | 削除済み請求が案件の請求サマリを歪める。 |
| **修正方法** | 常に `.is("deleted_at", null)` + active 判定を共通化。 |
| **難易度** | 低 |
| **修正時間目安** | 1〜2 時間 |
| **他画面への影響** | 案件詳細の請求状態、ダッシュボード |

---

### P2-05. ステータス変更系の silent null

| 項目 | 内容 |
|------|------|
| **原因** | `quote-detail` / `invoice-detail` 等で `if (!updated) return`。 |
| **影響** | ステータス変更失敗が不可視。 |
| **修正方法** | toast.error + 理由メッセージ。 |
| **難易度** | 低 |
| **修正時間目安** | 1〜2 時間 |
| **他画面への影響** | 詳細画面のステータス操作 |

---

### P2-06. 見積フォームの誤解を招く表示・文言

| 項目 | 内容 |
|------|------|
| **原因** | ステータス表示のハードコード、案件連動を示唆する古い文言（BUG-009/010）。 |
| **影響** | オペレーターの誤認。 |
| **修正方法** | 実 status 表示、文言修正。 |
| **難易度** | 低 |
| **修正時間目安** | 1 時間 |
| **他画面への影響** | 見積フォームのみ |

---

### P2-07. React key が index（明細行）

| 項目 | 内容 |
|------|------|
| **原因** | `construction-line-items-editor.tsx` で `key={line-item-${idx}}`。 |
| **影響** | 行削除・並び替え時のフォーカス/入力ずれ。 |
| **修正方法** | 安定 ID（クライアント一時 ID）を key に。 |
| **難易度** | 低 |
| **修正時間目安** | 1〜2 時間 |
| **他画面への影響** | 全明細エディタ |

---

### P2-08. デバッグ `console.log` の残存

| 項目 | 内容 |
|------|------|
| **原因** | `company-membership.ts` の invite/accept で `console.log`。 |
| **影響** | 本番コンソール汚染、トークン周辺の情報露出リスク。 |
| **修正方法** | 削除、または `NODE_ENV === "development"` 限定。 |
| **難易度** | 低 |
| **修正時間目安** | 15 分 |
| **他画面への影響** | 招待フローのみ |

---

### P2-09. 日付ユーティリティ・税率変換・toFormItems の重複

| 項目 | 内容 |
|------|------|
| **原因** | `todayISO`/`addDays`、税率 `10→0.1`、`toFormItems` が複数ファイルにコピー。 |
| **影響** | 片方だけ直して挙動差が出る。 |
| **修正方法** | `date-utils` / `line-item-form` に集約。 |
| **難易度** | 低〜中 |
| **修正時間目安** | 半日 |
| **他画面への影響** | import 差し替えの広い回帰 |

---

### P2-10. activity_logs / 補完プロジェクトの部分失敗が弱い可視化

| 項目 | 内容 |
|------|------|
| **原因** | activity log は fire-and-forget。`fetchSupplementalProjects` は warn して続行。 |
| **影響** | 操作履歴欠落、案件名「不明」が黙って出る。 |
| **修正方法** | 失敗を UI バナー or toast（非ブロッキング）。 |
| **難易度** | 低 |
| **修正時間目安** | 2〜3 時間 |
| **他画面への影響** | ダッシュボード履歴、案件名表示 |

---

### P2-11. カテゴリマスタ UI 未接続

| 項目 | 内容 |
|------|------|
| **原因** | `item_template_categories` は load/hydrate あるが画面未接続（BUG-008）。 |
| **影響** | 死蔵コード・メンテコスト。運用者の混乱。 |
| **修正方法** | UI 接続 or コード削除。 |
| **難易度** | 中 |
| **修正時間目安** | 接続なら 1〜2 日、削除なら半日 |
| **他画面への影響** | 商品テンプレ |

---

### P2-12. companies の logo/stamp が巨大 data URL の可能性

| 項目 | 内容 |
|------|------|
| **原因** | Storage 未使用でカラムに埋め込みうる（RISK-006）。 |
| **影響** | DB/転送肥大、設定画面の遅延。 |
| **修正方法** | Supabase Storage + URL 参照。 |
| **難易度** | 中 |
| **修正時間目安** | 1〜2 日 |
| **他画面への影響** | 会社設定、PDF/印刷プレビュー |

---

## P3（リファクタリング候補）

緊急度は低いが、長期の保守性・型安全・テスト容易性のため。

### P3-01. 帳票フォーム・ストアの共通化深化

| 項目 | 内容 |
|------|------|
| **原因** | quote/invoice/commercial/recurring/project で類似パターンが複製。`isActiveDocument` も 3 ストアにコピペ。 |
| **影響** | バグ修正の取りこぼし（今回の P1 が典型）。 |
| **修正方法** | 保存ハンドラ雛形、active 判定、line-item form を共有モジュール化。 |
| **難易度** | 中〜高 |
| **修正時間目安** | 段階的に数日 |
| **他画面への影響** | 広い。段階 PR 必須 |

---

### P3-02. クライアント直 Supabase（API Route なし）

| 項目 | 内容 |
|------|------|
| **原因** | 業務ロジックがブラウザから DB 直叩き。 |
| **影響** | 監査・レート制限・複合トランザクションが難しい。デバッグは Network 依存。 |
| **修正方法** | 重要 write を Server Actions / Route Handler へ段階移行。 |
| **難易度** | 高 |
| **修正時間目安** | 大規模（週単位） |
| **他画面への影響** | 全体アーキテクチャ |

---

### P3-03. 自動テスト未導入

| 項目 | 内容 |
|------|------|
| **原因** | Vitest/Playwright なし。回帰は手動。 |
| **影響** | P1 修正時の再発検知が弱い。 |
| **修正方法** | まず write パスの単体（RPC・createInvoice 契約）と主要 E2E 数本。 |
| **難易度** | 中 |
| **修正時間目安** | 基盤半日 + ケース追加は継続 |
| **他画面への影響** | CI 設定 |

---

### P3-04. deprecated re-export / 型の手書き Record マッピング

| 項目 | 内容 |
|------|------|
| **原因** | `invoice-filters` の deprecated 再エクスポート、admin/membership の `Record<string, unknown>`。 |
| **影響** | 型安全性の穴、削除忘れ。 |
| **修正方法** | 生成型 or zod parse、旧 export 削除。 |
| **難易度** | 低 |
| **修正時間目安** | 2〜4 時間 |
| **他画面への影響** | import 差し替え |

---

### P3-05. `payment-list` 等の exhaustive-deps 無効化

| 項目 | 内容 |
|------|------|
| **原因** | store 購読トリガーのために deps を意図的無視。 |
| **影響** | 将来の依存追加で stale / 過剰再実行。 |
| **修正方法** | セレクタ + `useShallow` で正規化。 |
| **難易度** | 低 |
| **修正時間目安** | 1〜2 時間 |
| **他画面への影響** | 入金一覧 |

---

### P3-06. リストの広い store 購読

| 項目 | 内容 |
|------|------|
| **原因** | `useXStore(s => s.invoices)` 等で配列全体購読。 |
| **影響** | 無関係な更新でも再レンダー。 |
| **修正方法** | 派生セレクタ、仮想リスト（件数増時）。 |
| **難易度** | 中 |
| **修正時間目安** | 一覧あたり 1〜3 時間 |
| **他画面への影響** | 各一覧 |

---

### P3-07. P0-4 保留分のマイグレーション検証体制

| 項目 | 内容 |
|------|------|
| **原因** | 追加カラム未適用時は UPDATE 失敗確定だが、環境差で再現しない。 |
| **影響** | 新環境・別テナントで突然保存不可。 |
| **修正方法** | 起動時スキーマチェック or README 必須 SQL の検証クエリを運用化（コード改修は任意）。 |
| **難易度** | 低 |
| **修正時間目安** | 運用手順 1〜2 時間 |
| **他画面への影響** | なし（検証のみなら） |

---

## 次に直すべき TOP10

| 順位 | ID | 題名 | 理由 |
|------|-----|------|------|
| **1** | P1-02 | 定期→請求の 2 回目以降破綻 | 実害がコード上ほぼ確定。回収漏れ直結 |
| **2** | P1-01 | 明細 DELETE→INSERT の原子化 | 見積以外でデータ消失リスクが残存 |
| **3** | P1-03 | 帳票 store-first 同期 | UI/DB 乖離は再現しやすく信頼を損なう |
| **4** | P1-04 | silent return / toast 不足の横展開 | P0-1 と同型。工数対効果が高い |
| **5** | P1-07 | `createInvoice` silent return | P1-02 の根。契約を明確にしないと再発 |
| **6** | P1-05 | company_id の defense in depth | RLS 事故時の被害範囲を限定 |
| **7** | P1-06 | load-all 帳票エラーの可視化 | 「消えた」幽霊バグの予防 |
| **8** | P1-08 | 帳票作成の孤児親防止 | データ不整合の入り口 |
| **9** | P1-11 / P1-12 | 数量・定期明細の仕様整合 | 入力が消える／保存拒否の体感障害 |
| **10** | P1-10 | AppInit mutex / load cancel | 起動安定性と編集画面の競合防止 |

---

## 推奨スプリント分割（参考）

| スプリント | 内容 |
|------------|------|
| **QA-S1（安全・業務）** | TOP 1, 5, 4（定期生成 + createInvoice 契約 + silent toast） |
| **QA-S2（データ消失）** | TOP 2, 3, 8（明細 RPC 化の着手 + store-first 是正 + 孤児親） |
| **QA-S3（境界・起動）** | TOP 6, 7, 10 |
| **QA-S4（仕様・UX）** | TOP 9、P2-01〜07、文言・key |
| **継続** | P2-03 パフォーマンス、P3 テスト基盤、P0-4 検証運用 |

---

## 今回やらないこと（明示）

- コード修正（本ドキュメント作成のみ）
- P0-4 の実装修正（保留継続）
- 新機能追加
- UI 全面刷新
- Playwright / Vitest の導入実装（P3 候補として記載のみ）

---

## 調査メモ（証拠ファイル早見）

| 領域 | 主なファイル |
|------|----------------|
| 明細置換 | `write-invoices.ts`, `write-commercial-documents.ts`, `write-recurring.ts`, `write-project-items.ts` |
| 定期→請求 | `services/recurring.ts`, `services/invoices.ts` |
| store-first | `services/commercial-documents.ts` |
| silent UI | `commercial-document-edit.tsx`, `recurring-edit.tsx`, `quote-new.tsx`, `project-edit.tsx` |
| company_id | `write-commercial-documents.ts`, `write-recurring.ts`, `write-bank-accounts.ts` 等 |
| load-all | `load-all.ts`, `app-init.tsx`, `data-ready-gate.tsx` |
| Zod/UI | `validations/*.ts`, `construction-line-items-editor.tsx`, `recurring-form.tsx` |

**NEEDS MANUAL VERIFICATION:** 定期の 2 回目請求生成、帳票保存失敗時の store/DB 差、本番 RLS ポリシー適用状況、追加カラム一式の DB 適用状況（P0-4）。
