# 見積編集保存 不具合調査レポート

**調査日:** 2026-07-25  
**方針:** 実装修正なし。コード追跡＋静的確認。ブラウザは `/login` まで到達（認証情報なしのため編集操作の実機再現は未完了）。  
**凡例:** `[確認済み事実]` / `[推測]` / `[未確認・要手動]`

---

## 1. 処理フロー（コード上の経路）

```text
/quotes/[id]/edit
  → EditQuoteClient (src/components/quotes/quote-edit.tsx)
  → QuoteForm (src/components/quotes/quote-form.tsx)
  → form.handleSubmit → onSubmit(values)
  → handleSave → updateQuote(id, quoteInputFromForm(v))
  → src/lib/services/quotes.ts::updateQuote
      ├─ assertCanWriteBusinessData()
      ├─ [Supabase] dbUpdateQuote (src/lib/db/write-quotes.ts)
      │     ├─ SELECT quotes by id + company_id (.single)
      │     ├─ writeQuoteRow("update") → UPDATE quotes
      │     ├─ DELETE quote_items
      │     └─ INSERT quote_items (construction fallback)
      └─ mergeQuote → Zustand
  → toast.success + router.push(`/quotes/${id}`)
```

ローカルモード時は `useQuoteStore.updateQuote` のみ（DB なし）。

---

## 2. 画面・フォーム

| 確認項目 | 結果 | 根拠 |
|----------|------|------|
| 保存ボタンが submit か | `[確認済み]` `type="button"` + `onClick={handleSave}` | `quote-form.tsx` L385–401 |
| `<form>` 内側か | `[確認済み]` **`<form>` なし**。RHF の `handleSubmit` を直接呼ぶ | 同ファイル全体 |
| onSubmit 登録 | `[確認済み]` `onSubmit={handleSave}` | `quote-edit.tsx` L139 |
| disabled | `[確認済み]` `isSubmitting` のみ | `quote-form.tsx` L388 |
| viewer 停止 | `[確認済み]` UI 側ガードなし。`updateQuote` 内 `assertCanWriteBusinessData` が throw | `quotes.ts` L302–303 |
| status で編集禁止 | `[確認済み]` **ステータスによる編集禁止なし**（sent/accepted も編集画面へ行ける） | `quote-edit.tsx` |
| 追加見積だけ別条件 | `[確認済み]` **なし**。通常/追加とも同一 `QuoteForm` + `updateQuote` | `quotes/new?projectId=` も同じフォーム |

### 重大な UX 欠陥（保存失敗時の無反応）

`[確認済み事実]` `quote-edit.tsx` の `handleSave`:

```ts
const updated = await updateQuote(quoteId, quoteInputFromForm(v));
if (!updated) return; // ← toast なし・エラー表示なし
```

- **try/catch なし**（請求編集 `invoice-edit.tsx` にはあり）
- `updated === null` のとき **成功も失敗もユーザーに伝わらない**
- throw 時も UI トーストなし（未処理 Promise / RHF 側で isSubmitting 解除）

→ 「保存を押しても何も起きない」症状と **整合するコードパス**。

対照: `invoice-edit.tsx` L107–125 は `toast.error` + `formatSupabaseError`。

---

## 3. バリデーション

| 項目 | 結果 |
|------|------|
| Zod スキーマ | `quoteFormSchema`（`src/lib/validations/quote.ts`） |
| 明細必須 | `items.min(1)` |
| 商品名 | `min(1).max(100)` |
| 数量 | `min(1)` ※UI は `min={0.01}` と不一致の可能性 `[推測]` |
| 単位 | `min(1)` |
| 値引 | `discountAmount <= 小計` refine |
| 明細行エラー表示 | `[確認済み]` `ConstructionLineItemsEditor` は **行ごとの Zod エラーを表示しない**。トップの `errors.items?.message` のみ |
| invalid 時の toast | `[確認済み]` **なし**（`handleSubmit` の第2引数未指定） |

`[推測]` 空の手入力明細（商品名 ""）を残したまま保存 → Zod 失敗 → **画面ほぼ無反応**に見える。

---

## 4. ID・データ取得

| 項目 | 結果 |
|------|------|
| URL id | `resolveRouteId(params.id)` |
| 初期ロード | `getQuoteById` + `getQuoteItems` |
| projectId / customerId | state と `defaultValues` にセット |
| 作成誤爆 | `[確認済み]` 編集は `updateQuote(id, …)` のみ。`createQuote` は呼ばない |
| 明細 ID | 編集時、既存明細 ID はフォームに載せない。DB 更新時に **新規 `qti_` ID で全置換** |

---

## 5. Zustand

| 項目 | 結果 |
|------|------|
| 成功時 | `mergeQuote(quote, items)` |
| 失敗時 null | store 未更新（`if (result)`） |
| throw 時 | store 未更新（DB 側は途中まで進んでいる可能性あり → 下記） |
| 再 hydrate | 保存直後の自動全再読込なし。詳細へ遷移後は既存 store |

---

## 6. Supabase / write-quotes

### 6.1 UPDATE

```ts
.update(payload).eq("id", quoteId).eq("company_id", companyId)
```

- `.select().single()` は **更新後ではなく事前 fetch** で使用
- fetch 失敗 / 0件 → **`return null`**（throw しない）→ 上記 silent return に直結 `[確認済み]`

### 6.2 列フォールバック

- `expiry_type` 欠落時のみリトライあり（`isMissingQuoteExpiryTypeColumn`）
- **`discount_*` / `customer_honorific` / `customer_contact_*` 欠落時のフォールバックなし** → throw → UI 無反応 `[確認済み]`  
  → 本番で追加 SQL 未適用なら UPDATE 失敗しうる。`NEEDS DATABASE VERIFICATION`

### 6.3 明細置換（データ消失リスク）

```ts
await delete quote_items ...
await insertRowsWithConstructionFallback(...) // 失敗時 throw
```

- **トランザクションなし** `[確認済み]`
- 親 UPDATE 成功 → 明細 DELETE 成功 → INSERT 失敗、の場合 **明細が空になる** `[確認済み・危険]`
- insert エラーは throw するが、quote-edit が catch しないためユーザーに伝わりにくい

---

## 7. エラー表示

| 経路 | ユーザー表示 |
|------|----------------|
| Zod invalid | 一部フィールドのみ。明細行は弱い。toast なし |
| `updateQuote` → null | **完全無反応** |
| throw（RLS / 列欠落 / insert 失敗） | **toast なし**（console のみの可能性） |
| viewer | throw → 無反応寄り |

---

## 8. 再現パターン表

実機ログイン不可のため、多くは `[未確認・要手動]`。コードから推定する結果を併記。

| # | パターン | 実機 | コード上の想定 |
|---|----------|------|----------------|
| 1 | 件名のみ変更 | NEEDS MANUAL | 見積に「件名」フィールドなし。発行日等のみ。保存経路は同一 |
| 2 | 商品名変更 | NEEDS MANUAL | バリデーション通過なら DB 更新。失敗時 silent |
| 3–4 | 数量/単価 | NEEDS MANUAL | 同上。数量 `<1` は Zod で止まる可能性 |
| 5–8 | 明細追加/削除/テンプレ/手入力 | NEEDS MANUAL | 空名手入力は invalid で無反応になりやすい |
| 9–11 | 値引/敬称/担当 | NEEDS MANUAL | SQL 未適用時 throw → silent。適用済なら成功しうる |
| 12–14 | draft/sent/accepted | NEEDS MANUAL | 編集禁止なし。保存は status 維持（update は status を上書きしない） |
| 15–16 | 通常/追加見積 | NEEDS MANUAL | **同一コードパス** |
| 17–19 | 明細数・100文字 | NEEDS MANUAL | max(100) 超は invalid |
| 20–21 | PC/スマホ | NEEDS MANUAL | 保存ロジック同一 |

### 手動確認チェックリスト（再現時に記録）

- [ ] 保存処理が呼ばれたか（Network: `quotes` UPDATE）
- [ ] Zod エラー（React Hook Form DevTools / 画面赤文字）
- [ ] Supabase レスポンス / error message（原文）
- [ ] store の quotes / quoteItems
- [ ] DB 再 SELECT 結果
- [ ] ブラウザ console

---

## 9. 原因候補（優先順）

| 優先 | 候補 | 種別 | 説明 |
|------|------|------|------|
| A | エラー握りつぶし（null / throw 無 toast） | `[確認済み]` | 「押せども無反応」の直接原因になりうる |
| B | Zod 失敗＋明細エラー非表示 | `[確認済み]`＋`[推測]` | 手入力空行など |
| C | 追加 SQL 未適用（honorific/discount/contact） | `[推測]` `NEEDS DATABASE VERIFICATION` | UPDATE throw |
| D | RLS / company_id 不一致で fetch 0件 → null | `[推測]` | silent return |
| E | 明細 DELETE 後 INSERT 失敗 | `[確認済み]` 経路あり | **データ消失** |
| F | viewer 権限 | `[確認済み]` 経路あり | throw |

**最有力（現時点）:**  
ユーザー体験としての「保存できない」は **A（エラー非表示）** が最有力。  
DB 上本当に失敗している場合は **C/D/E** を Network/SQL で切り分け。  
A を直さないと、真因が C/D/E でもすべて「無反応」に見える。

---

## 10. データ消失の危険

**あり（P0）。**  
`dbUpdateQuote` の非トランザクションな「明細全削除 → 再挿入」。INSERT 失敗時に明細が空になる。

---

## 11. 修正案（このフェーズでは実装しない）

1. `quote-edit.handleSave` に try/catch + null 時 toast（`invoice-edit` 同等）
2. `handleSubmit` の onInvalid で toast / 明細エラーを行表示
3. `dbUpdateQuote` をトランザクション化、または INSERT 成功後にだけ DELETE、または失敗時ロールバック
4. 欠落カラム向けフォールバック or マイグレーション必須化＋明確エラー
5. 保存前の空明細除去 or ブロックメッセージ

---

## 12. 関連ファイル

- `src/components/quotes/quote-edit.tsx`
- `src/components/quotes/quote-form.tsx`
- `src/components/quotes/quote-items-editor.tsx`
- `src/components/shared/construction-line-items-editor.tsx`
- `src/lib/validations/quote.ts`
- `src/lib/services/quotes.ts`
- `src/lib/db/write-quotes.ts`
- `src/lib/db/mappers.ts` (`quoteToRow`)
- `src/lib/db/line-item-insert.ts`
- `src/stores/quote-store.ts`
- 対照（良い例）: `src/components/invoices/invoice-edit.tsx`

---

## 13. 確認用 SQL（SELECT のみ・破壊なし）

```sql
-- 見積に必要な追加列があるか
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'quotes'
  AND column_name IN (
    'discount_label','discount_amount',
    'customer_honorific',
    'customer_contact_name','customer_department','customer_position',
    'expiry_type','created_by','updated_by'
  )
ORDER BY column_name;

-- quote_items の工事寸法列
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'quote_items'
  AND column_name IN ('width','height','unit');

-- 特定見積の明細件数（ID を差し替え）
-- SELECT q.id, q.quote_number, q.updated_at, count(qi.id) AS item_count
-- FROM quotes q
-- LEFT JOIN quote_items qi ON qi.quote_id = q.id
-- WHERE q.id = 'qt_xxx'
-- GROUP BY q.id, q.quote_number, q.updated_at;
```
