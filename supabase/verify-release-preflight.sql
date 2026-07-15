-- =============================================================================
-- リリース前 整合性確認 SQL（読み取り専用）
-- Supabase SQL Editor で実行してください。
-- パッチ適用後に「カラム未適用」が 0 件になることを確認します。
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. 値引きカラムの存在・型・NULL・default
-- ---------------------------------------------------------------------------
SELECT
  c.table_name,
  c.column_name,
  c.data_type,
  c.is_nullable,
  c.column_default
FROM information_schema.columns c
WHERE c.table_schema = 'public'
  AND c.table_name IN (
    'projects', 'quotes', 'orders', 'delivery_notes', 'invoices', 'receipts'
  )
  AND c.column_name IN ('discount_label', 'discount_amount')
ORDER BY c.table_name, c.column_name;

-- 値引きカラムが欠けているテーブル（0行が期待）
SELECT t.table_name, m.column_name
FROM (
  VALUES
    ('projects'), ('quotes'), ('orders'),
    ('delivery_notes'), ('invoices'), ('receipts')
) AS t(table_name)
CROSS JOIN (
  VALUES ('discount_label'), ('discount_amount')
) AS m(column_name)
WHERE NOT EXISTS (
  SELECT 1
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name = t.table_name
    AND c.column_name = m.column_name
)
ORDER BY t.table_name, m.column_name;

-- ---------------------------------------------------------------------------
-- 2. 先方担当者カラム
-- ---------------------------------------------------------------------------
SELECT
  c.table_name,
  c.column_name,
  c.data_type,
  c.is_nullable,
  c.column_default
FROM information_schema.columns c
WHERE c.table_schema = 'public'
  AND c.table_name IN (
    'projects', 'quotes', 'orders', 'delivery_notes', 'invoices', 'receipts'
  )
  AND c.column_name IN (
    'customer_contact_name',
    'customer_department',
    'customer_position'
  )
ORDER BY c.table_name, c.column_name;

-- 担当者カラムが欠けているテーブル（0行が期待）
SELECT t.table_name, m.column_name
FROM (
  VALUES
    ('projects'), ('quotes'), ('orders'),
    ('delivery_notes'), ('invoices'), ('receipts')
) AS t(table_name)
CROSS JOIN (
  VALUES
    ('customer_contact_name'),
    ('customer_department'),
    ('customer_position')
) AS m(column_name)
WHERE NOT EXISTS (
  SELECT 1
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name = t.table_name
    AND c.column_name = m.column_name
)
ORDER BY t.table_name, m.column_name;

-- ---------------------------------------------------------------------------
-- 3. 論理削除カラム
-- ---------------------------------------------------------------------------
SELECT
  c.table_name,
  c.column_name,
  c.data_type,
  c.is_nullable
FROM information_schema.columns c
WHERE c.table_schema = 'public'
  AND c.table_name IN ('invoices', 'orders', 'delivery_notes', 'receipts')
  AND c.column_name = 'deleted_at'
ORDER BY c.table_name;

-- deleted_at 欠落（0行が期待）
SELECT t.table_name
FROM (
  VALUES ('invoices'), ('orders'), ('delivery_notes'), ('receipts')
) AS t(table_name)
WHERE NOT EXISTS (
  SELECT 1
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name = t.table_name
    AND c.column_name = 'deleted_at'
);

-- ---------------------------------------------------------------------------
-- 4. 削除済み・キャンセル済み請求書
-- ---------------------------------------------------------------------------
SELECT id, invoice_number, project_id, status, deleted_at, total_amount
FROM public.invoices
WHERE deleted_at IS NOT NULL
ORDER BY deleted_at DESC
LIMIT 50;

SELECT id, invoice_number, project_id, status, deleted_at, total_amount
FROM public.invoices
WHERE status = 'cancelled' AND deleted_at IS NULL
ORDER BY updated_at DESC
LIMIT 50;

-- ---------------------------------------------------------------------------
-- 5. due_date と status の不一致
-- ---------------------------------------------------------------------------
-- 未来日なのに overdue
SELECT id, invoice_number, status, due_date
FROM public.invoices
WHERE deleted_at IS NULL
  AND status = 'overdue'
  AND due_date >= CURRENT_DATE;

-- 過去日なのに issued/sent（アプリ表示は期限超過になる）
SELECT id, invoice_number, status, due_date
FROM public.invoices
WHERE deleted_at IS NULL
  AND status IN ('issued', 'sent')
  AND due_date < CURRENT_DATE;

-- ---------------------------------------------------------------------------
-- 6. 案件の請求状態 vs 実請求書（ざっくり）
--    projects.invoice_status / payment_status はアプリ側導出もあるため参考値
-- ---------------------------------------------------------------------------
SELECT
  p.id AS project_id,
  p.project_name,
  p.status AS project_status,
  p.invoice_status,
  p.payment_status,
  COUNT(i.id) FILTER (
    WHERE i.deleted_at IS NULL AND i.status <> 'cancelled'
  ) AS active_invoice_count,
  COUNT(i.id) FILTER (
    WHERE i.deleted_at IS NULL AND i.status = 'draft'
  ) AS draft_count,
  COUNT(i.id) FILTER (
    WHERE i.deleted_at IS NULL
      AND i.status IN ('issued', 'sent', 'overdue', 'paid')
  ) AS issued_or_paid_count
FROM public.projects p
LEFT JOIN public.invoices i ON i.project_id = p.id
GROUP BY p.id, p.project_name, p.status, p.invoice_status, p.payment_status
HAVING
  -- 請求なしなのに invoice_status が issued など
  (
    COUNT(i.id) FILTER (
      WHERE i.deleted_at IS NULL AND i.status <> 'cancelled'
    ) = 0
    AND COALESCE(p.invoice_status, 'not_created') NOT IN ('not_created', 'draft')
  )
  OR
  -- 有効請求があるのに not_created
  (
    COUNT(i.id) FILTER (
      WHERE i.deleted_at IS NULL
        AND i.status IN ('issued', 'sent', 'overdue', 'paid')
    ) > 0
    AND COALESCE(p.invoice_status, 'not_created') = 'not_created'
  )
ORDER BY p.updated_at DESC
LIMIT 100;

-- ---------------------------------------------------------------------------
-- 7. 値引きデータ異常（負 / 小計超過の疑い）
-- ---------------------------------------------------------------------------
SELECT 'projects' AS src, id, discount_amount, amount AS subtotal_proxy
FROM public.projects
WHERE discount_amount < 0 OR discount_amount > GREATEST(amount, 0)
UNION ALL
SELECT 'quotes', id, discount_amount, subtotal
FROM public.quotes
WHERE discount_amount < 0 OR discount_amount > GREATEST(subtotal, 0)
UNION ALL
SELECT 'invoices', id, discount_amount, subtotal
FROM public.invoices
WHERE deleted_at IS NULL
  AND (discount_amount < 0 OR discount_amount > GREATEST(subtotal, 0))
UNION ALL
SELECT 'orders', id, discount_amount, subtotal
FROM public.orders
WHERE deleted_at IS NULL
  AND (discount_amount < 0 OR discount_amount > GREATEST(subtotal, 0))
UNION ALL
SELECT 'delivery_notes', id, discount_amount, subtotal
FROM public.delivery_notes
WHERE deleted_at IS NULL
  AND (discount_amount < 0 OR discount_amount > GREATEST(subtotal, 0))
UNION ALL
SELECT 'receipts', id, discount_amount, subtotal
FROM public.receipts
WHERE deleted_at IS NULL
  AND (discount_amount < 0 OR discount_amount > GREATEST(subtotal, 0));

-- ---------------------------------------------------------------------------
-- 8. RLS 有効確認（主要テーブル）
-- ---------------------------------------------------------------------------
SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND c.relname IN (
    'projects', 'quotes', 'orders', 'delivery_notes', 'invoices', 'receipts',
    'customers', 'profiles', 'companies'
  )
ORDER BY c.relname;
