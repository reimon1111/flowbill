# FlowBill P0 根本原因確定レポート

**調査日:** 2026-07-25  
**方針:** コード追跡による原因確定。実装修正なし。  
**凡例:**
- **確定** … コード上、条件が揃えば必ず起きる（再現条件付き）
- **NEEDS MANUAL VERIFICATION** … 実機・実DBなしでは「ユーザー環境で今起きているか」は断定不可

---

## 総括（先に結論）

| P0 | 確定度 | 一言 |
|----|--------|------|
| 1. 見積編集で保存できない | **症状の原因は確定**。端末障害の“どれが今ヒットしているか”は環境依存 | 失敗時に UI が黙るのが確定原因。失敗そのもののトリガーは複数あり、環境で分岐 |
| 2. 明細 DELETE→INSERT 非トランザクション | **欠陥として100%確定** | INSERT 失敗時に明細消失しうる設計 |
| 3. 定期請求が初回ロードされない | **100%確定** | `load-all` が recurring を SELECT しない |
| 4. 追加カラム未適用で UPDATE 失敗 | **「未適用なら必ず失敗」は確定**。本番列の有無は要DB確認 | `quoteToRow` が列を送り、honorific/discount/contact にフォールバックなし |

---

# P0-1. 見積編集で保存できない

## 重要な切り分け

「保存できない」は **1つのバグではなく、次の2層**で起きる。

| 層 | 内容 | 確定? |
|----|------|-------|
| **A. 失敗がユーザーに見えない** | 保存失敗・バリデーション失敗でも toast/遷移なし | **確定** |
| **B. 実際に DB/バリデーションが失敗する** | null 返却 / throw / Zod invalid | **各トリガー条件付きで確定**。ユーザー環境でどれかは **NEEDS MANUAL VERIFICATION** |

コード上、「正しい入力・列あり・RLS OK・書込権限あり」でも **必ず UPDATE が失敗する** という単一パスは **ない**。  
ローカルモードでは `useQuoteStore.updateQuote` が成功しうる。

ユーザー報告の「保存を押しても保存できない」に対する **確定した直接原因（症状）** は **層A**。  
層B のどれかが起きると、層Aのせいで「無反応＝保存できない」に見える。

---

## 呼び出し順（確定）

```text
1. QuoteForm 保存ボタン onClick
     src/components/quotes/quote-form.tsx
     → form.handleSubmit(async (values) => onSubmit({...values, items: toFormItems(items)}))
2. Zod (quoteFormSchema) 検証
     失敗時: onSubmit 未実行・onInvalid 未登録 → 無反応（確定）
3. EditQuoteClient.handleSave(v)
     src/components/quotes/quote-edit.tsx
4. updateQuote(quoteId, quoteInputFromForm(v))
     src/lib/services/quotes.ts
5. assertCanWriteBusinessData()
     失敗時: throw → handleSave に catch なし → 無反応（確定）
6a. [Supabase] dbUpdateQuote
     src/lib/db/write-quotes.ts
6b. [ローカル] quote-store.updateQuote
7. 成功時のみ toast + router.push
     失敗(null)/throw 時は何もしない（確定）
```

---

## 確定原因 A — エラー非表示（症状の直接原因）

### 100% 再現条件

1. 見積編集画面 `/quotes/[id]/edit` を開く
2. 次のいずれかが起きる:
   - Zod 検証失敗（例: 商品名空の明細が残っている）
   - `updateQuote` が `null` を返す
   - `updateQuote` が throw する
3. 「変更を保存」を押す

### 期待されるユーザー体験（現状）

- 成功 toast なし
- エラー toast なし
- 画面遷移なし  
→ **「保存できない」ように見える**

### 原因（確定）

| # | コード | 内容 |
|---|--------|------|
| 1 | `quote-edit.tsx` L104–108 | `if (!updated) return;` のあと toast なし。try/catch なし |
| 2 | `quote-form.tsx` L182–184 | `handleSubmit` に第2引数（onInvalid）なし。Zod 失敗時に toast なし |
| 3 | `quote-form.tsx` / `construction-line-items-editor.tsx` | 明細行の Zod エラーを行に表示しない |

対照（請求はエラー表示あり）: `invoice-edit.tsx` L107–125。

### 原因ファイル・関数

- `src/components/quotes/quote-edit.tsx` … `handleSave`
- `src/components/quotes/quote-form.tsx` … `handleSave` (= `form.handleSubmit`)
- `src/lib/services/quotes.ts` … `updateQuote`（null を返しうる）

### 影響範囲

- 見積の **編集保存のみ**（新規作成 `quote-new` は成功時 toast あり。失敗時の catch 有無は別）
- 詳細・一覧・PDF は、実際に DB が更新されなければ古いまま

### 他画面への影響

- 直接なし
- 同パターンの silent return: `commercial-document-edit.tsx`（別 P1）

### 修正方法

1. `handleSave` に try/catch + `null` 時 `toast.error`（`invoice-edit` 同等）
2. `handleSubmit(onValid, onInvalid)` で invalid 時 toast
3. 明細行エラー表示

### 修正難易度 / リスク

- 難易度: **低**
- リスク: **低**（表示追加が主。保存ロジック自体は変えない）

---

## 確定原因 B1 — `dbUpdateQuote` が null を返す

### 100% 再現条件

Supabase 接続時、かつ次のいずれか:

- `quotes` の `select … .single()` が 0 件（id/company_id 不一致、RLS で見えない）
- `fetchError` が立つ

→ `return null`（L166）→ `updateQuote` が null → 原因 A で無反応。

### 原因関数

`dbUpdateQuote`（`write-quotes.ts` L160–166）

### NEEDS MANUAL VERIFICATION

- 当該見積が RLS / company_id で実際に読めないか

---

## 確定原因 B2 — UPDATE/INSERT が throw

### 100% 再現条件（列欠落）

`quoteToRow` が送る列が DB にない:

- `discount_label` / `discount_amount`
- `customer_honorific`
- `customer_contact_name` / `customer_department` / `customer_position`
- （`expiry_type` はフォールバックあり → 単独欠落なら継続しうる）

→ PostgREST が error → `writeQuoteRow` が `throw error`（L69）  
→ `handleSave` に catch なし → 原因 A で無反応。

`created_by`/`updated_by` は `withUpdateAudit` で付与。監査列未適用時も throw しうる（**確定: コードパス** / **列有無は NEEDS DATABASE VERIFICATION**）。

### 原因ファイル・関数

- `write-quotes.ts` … `writeQuoteRow`, `dbUpdateQuote`
- `mappers.ts` … `quoteToRow`
- `errors.ts` … `isMissingQuoteExpiryTypeColumn` のみ（discount/honorific 用なし）

詳細は **P0-4**。

---

## 確定原因 B3 — Zod で onSubmit に到達しない

### 100% 再現条件

例:

1. 編集画面で「手入力で追加」→ 商品名を空のまま
2. 「変更を保存」

`quoteItemSchema.name.min(1)` で失敗 → `onSubmit` 未呼出 → 原因 A。

### 原因

- `validations/quote.ts` … `quoteItemSchema`
- `quote-form.tsx` … onInvalid なし
- 明細エディタが form エラー非連携

---

## 確定原因 B4 — viewer

### 100% 再現条件

`currentRole === "viewer"` で編集保存  
→ `assertCanWriteBusinessData()` が throw（`write-access.ts`）  
→ catch なし → 無反応。

---

## P0-1 で断定しないこと

| 内容 | 理由 |
|------|------|
| 「どんな見積でも UPDATE が常に失敗する」 | ローカル成功パスあり。列・RLS・入力が揃えば成功しうる |
| 「ユーザーの本番で今ヒットしているのが B1/B2/B3 のどれか」 | **NEEDS MANUAL VERIFICATION**（Network / console / DB 列確認） |

---

# P0-2. 明細 DELETE→INSERT 非トランザクション（消失リスク）

## 結論

**欠陥として 100% 確定。**  
「すでに本番で明細が消えた」かは **NEEDS MANUAL VERIFICATION**。

## 100% 再現条件（消失が起きる条件）

Supabase 接続時:

1. `dbUpdateQuote` が親 `quotes` の UPDATE に成功する
2. `quote_items` の DELETE が成功する（※戻り値の `error` を **見ていない** — L202–207）
3. 直後の INSERT が失敗する（RLS、列欠落、制約違反など）
4. `insertRowsWithConstructionFallback` が `throw error`（`line-item-insert.ts` L38）

→ 親見積は新しい金額のまま、**明細は 0 件**になりうる。

対照: **新規作成** `dbInsertQuote` は明細失敗時に親 quote を DELETE してロールバック（L138–140）。**更新には同等処理がない。**

## 原因（確定）

```text
writeQuoteRow("update")     // 成功しうる
→ quote_items.delete()      // error 未チェック
→ quote_items.insert()      // 失敗しうる → throw
→ return に到達しない
→ mergeQuote も走らない（サービス層）
```

DB 上は DELETE 済みのまま残る。

## 原因ファイル・関数

- `src/lib/db/write-quotes.ts` … `dbUpdateQuote`（L200–213）
- `src/lib/db/line-item-insert.ts` … `insertRowsWithConstructionFallback`
- `src/lib/services/quotes.ts` … `updateQuote`（throw 時 merge しない）

## 呼び出し順

`updateQuote` → `dbUpdateQuote` → UPDATE quotes → DELETE items → INSERT items（失敗）→ throw

## 影響範囲

- 見積編集保存時の明細
- 詳細・PDF・金額（親の total は UPDATE 済みの可能性）と明細の不整合

## 他画面への影響

- 同パターン: `write-commercial-documents.ts` の明細置換（`delete` → `insertRowsWithConstructionFallback`）
- 請求・定期の明細置換も類似リスク（要同型レビュー）

## 修正方法

1. DB トランザクション / RPC で原子的置換
2. または INSERT（新 ID）成功後に旧明細 DELETE
3. または失敗時にバックアップから戻す
4. DELETE の `error` も必ず検査

## 修正難易度 / リスク

- 難易度: **中**（RPC なら中〜高）
- リスク: **中**（置換順序を誤ると二重明細）

---

# P0-3. 定期請求が初回ロードされない

## 結論

**100% 確定。** 「可能性」ではなく、Supabase モードでは **ロードされない。**

## 100% 再現条件

1. `NEXT_PUBLIC_SUPABASE_*` 設定済み
2. 定期請求を作成する（`dbInsertRecurring` → DB に行あり、store に merge）
3. ページをフルリロードする、またはログアウト→ログインする

### 実際に起きること（確定）

```text
AppInit
  → clearAllBusinessStores()
       Supabase時: recurringBillings = []  （clear-business-stores.ts L52–55）
  → loadAllDataFromSupabase()
       Promise.all に recurring_billings / recurring_billing_items が無い
       （load-all.ts L70–88, L201–286 付近に hydrate なし）
  → 一覧は store の空配列を表示
```

DB に行が残っていても UI は空。  
セッション中に新規作成したものだけ、そのタブでは見える。

ローカルモード: `clearAllBusinessStores` が mock の `initialRecurringBillings` を入れるため、再表示はモックデータになる（本番データではない）。

## 原因（確定）

`loadAllDataFromSupabase` が定期請求を SELECT / hydrate しない。  
一覧は `useRecurringStore` のみ参照（`recurring-list.tsx`）。DB から読む経路が初期化にない。

## 原因ファイル・関数

| ファイル | 関数/箇所 |
|----------|-----------|
| `src/lib/db/load-all.ts` | `loadAllDataFromSupabase`（recurring 欠落） |
| `src/lib/stores/clear-business-stores.ts` | `clearAllBusinessStores`（空配列化） |
| `src/components/layout/app-init.tsx` | `init`（clear → load） |
| `src/lib/db/write-recurring.ts` | `dbInsertRecurring` 等（書込のみ） |
| `src/lib/services/recurring.ts` | `createRecurring`（merge のみ） |
| `src/components/recurring/recurring-list.tsx` | store 参照のみ |

## 呼び出し順

`AppInit.init` → `clearAllBusinessStores` → `loadAllDataFromSupabase` →（recurring なし）→ `RecurringList` が空表示

## 影響範囲

- `/recurring-billings` 一覧・編集（ID 直打ちは store に無ければ失敗）
- 定期からの請求生成（対象が store に無い）

## 他画面への影響

- ダッシュボード等が recurring を数えていなければ直接なし
- 請求生成フローは間接影響

## 修正方法

`load-all.ts` に `recurring_billings` / `recurring_billing_items` の SELECT と `useRecurringStore.hydrate` を追加。

## 修正難易度 / リスク

- 難易度: **低**
- リスク: **低**（他エンティティと同型）

## NEEDS MANUAL VERIFICATION

- 本番 DB に既存の `recurring_billings` 行があるか（あれば「消えたように見える」実害が既にある）

---

# P0-4. 追加カラム未適用時の UPDATE 失敗

## 結論

- **コード動作:** 列が無いと UPDATE は **必ず失敗する（throw）** … **確定**
- **その環境の列の有無:** … **NEEDS DATABASE VERIFICATION**

「可能性」ではなく、「未適用なら失敗する」はコード上確定。未適用かどうかは DB 確認が必要。

## 100% 再現条件

1. Supabase 接続
2. `quotes` に次のいずれかが無い（PostgREST schema cache 含む）:
   - `discount_label` / `discount_amount`
   - `customer_honorific`
   - `customer_contact_name` / `customer_department` / `customer_position`
   - `created_by` / `updated_by`（audit 付与時）
3. 見積編集で保存（バリデーション通過）

→ `writeQuoteRow` が error → throw → P0-1 原因 A で無反応。

### expiry_type のみ欠落の場合

`isMissingQuoteExpiryTypeColumn` で列を除いてリトライ（L57–66）。  
**expiry_type 単独欠落では UPDATE 継続しうる（確定）。**  
discount/honorific/contact に同等処理は **ない（確定）。**

## 原因（確定）

`quoteToRow`（`mappers.ts` L680–704）が上記列を常に payload に含める。  
`writeQuoteRow` は expiry_type 以外の欠落を吸収しない。

## 原因ファイル・関数

- `src/lib/db/mappers.ts` … `quoteToRow`
- `src/lib/db/write-quotes.ts` … `writeQuoteRow`, `dbUpdateQuote`
- `src/lib/db/auth-user.ts` … `withUpdateAudit`（`updated_by`）
- SQL: `add-document-discounts.sql`, `add-customer-honorific.sql`, `add-counterparty-contact.sql`, `add-audit-fields.sql`, `schema-full.sql`

## 呼び出し順

`updateQuote` → `dbUpdateQuote` → `writeQuoteRow` → `quoteToRow` + `withUpdateAudit` → `supabase.update` →（列なし）error → throw

## 影響範囲

- 見積の **更新**（作成 `dbInsertQuote` も同じ `writeQuoteRow` → 新規も同様に失敗しうる）
- 編集保存が「できない」ように見える（P0-1 と複合）

## 他画面への影響

- 案件・請求なども同列を送るなら、未適用時に同様失敗（要各 write 確認）
- 見積に限定したフォールバック欠如が今回の焦点

## 修正方法

1. 確認用 SELECT で列の有無を検証（破壊なし）
2. 未適用なら追加 SQL を適用
3. アプリ側: 欠落検知フォールバック or 起動時マイグレーション警告の強化

## 修正難易度 / リスク

- SQL 適用: **低** / リスク **低〜中**（既存行 default あり）
- アプリフォールバック追加: **中** / リスク **低**

## 確認用 SQL（SELECT のみ）

```sql
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'quotes'
  AND column_name IN (
    'discount_label', 'discount_amount',
    'customer_honorific',
    'customer_contact_name', 'customer_department', 'customer_position',
    'expiry_type', 'created_by', 'updated_by'
  )
ORDER BY column_name;
-- 9行揃っていなければ未適用あり
```

---

# P0 間の依存関係

```text
P0-4（列未適用） ──throw──┐
P0-2（INSERT失敗）──throw──┼──► P0-1A（エラー非表示）──► 「保存できない」に見える
B1 null / B3 Zod / B4 viewer ─┘

P0-3 は独立（定期請求ロード）
P0-2 は P0-1 修正後も残る（データ消失は別問題）
```

**修正順（推奨・実装は次フェーズ）:**

1. P0-1A（エラー可視化）… 切り分け可能にする  
2. P0-2（明細原子性）… 消失防止  
3. P0-4（DB 検証→SQL or フォールバック）  
4. P0-3（load-all）

---

# 実機で原因 B を確定する手順（NEEDS MANUAL VERIFICATION）

1. ログイン後、既存見積を編集し DevTools → Network / Console を開く
2. 「変更を保存」
3. 判定:
   - Network に `quotes` の PATCH/UPDATE が **無い** → B3（Zod）またはボタン未到達
   - UPDATE が **400/ PGRST204** → P0-4（列）
   - UPDATE **200** のあと `quote_items` INSERT 失敗 → P0-2
   - UPDATE 前の GET が 0 件 / 406 → B1（null）
   - Console に「閲覧のみの権限」→ B4

コード変更は不要。観測のみで端末原因を特定できる。
