-- 請求書状態の整合性確認用 SQL
-- Supabase SQL Editor で company_id を必要に応じて絞り込んで実行してください

-- 1. 削除済み請求書一覧
SELECT
  id,
  invoice_number,
  project_id,
  status,
  deleted_at,
  updated_at
FROM invoices
WHERE deleted_at IS NOT NULL
ORDER BY deleted_at DESC;

-- 2. キャンセル済み請求書一覧
SELECT
  id,
  invoice_number,
  project_id,
  status,
  deleted_at,
  updated_at
FROM invoices
WHERE status = 'cancelled'
  AND deleted_at IS NULL
ORDER BY updated_at DESC;

-- 3. 同一 project_id に複数の有効請求書がある一覧
SELECT
  project_id,
  COUNT(*) AS active_count,
  ARRAY_AGG(invoice_number ORDER BY updated_at DESC) AS invoice_numbers
FROM invoices
WHERE deleted_at IS NULL
  AND status <> 'cancelled'
GROUP BY project_id
HAVING COUNT(*) > 1
ORDER BY active_count DESC;

-- 4. 期限超過判定の確認（DB status と due_date のズレ）
-- due_date が未来なのに status = overdue の請求書
SELECT
  id,
  invoice_number,
  project_id,
  status,
  due_date,
  updated_at
FROM invoices
WHERE deleted_at IS NULL
  AND status NOT IN ('cancelled', 'paid', 'draft')
  AND status = 'overdue'
  AND due_date >= CURRENT_DATE
ORDER BY due_date;

-- due_date が過去なのに status が issued/sent のまま（表示上は期限超過になるべき）
SELECT
  id,
  invoice_number,
  project_id,
  status,
  due_date,
  updated_at
FROM invoices
WHERE deleted_at IS NULL
  AND status IN ('issued', 'sent')
  AND due_date < CURRENT_DATE
ORDER BY due_date;

-- 5. ダッシュボード集計とズレが起きそうな請求書
-- 削除済みだが status が issued/overdue など（集計からは除外されるべき）
SELECT
  id,
  invoice_number,
  project_id,
  status,
  deleted_at,
  due_date,
  total_amount
FROM invoices
WHERE deleted_at IS NOT NULL
  AND status NOT IN ('draft', 'cancelled')
ORDER BY deleted_at DESC;

-- キャンセル済みだが未入金集計に含まれうる status
SELECT
  id,
  invoice_number,
  project_id,
  status,
  due_date,
  total_amount
FROM invoices
WHERE deleted_at IS NULL
  AND status = 'cancelled'
ORDER BY updated_at DESC;

-- 案件の invoice_status が有効請求書と不一致（参考）
SELECT
  p.id AS project_id,
  p.project_name,
  p.invoice_status AS project_invoice_status,
  p.payment_status AS project_payment_status,
  BOOL_OR(i.status IN ('issued', 'sent', 'paid', 'overdue')) AS has_billable_issued,
  BOOL_OR(
    i.deleted_at IS NULL
    AND i.status NOT IN ('cancelled', 'paid', 'draft')
    AND i.due_date < CURRENT_DATE
  ) AS has_overdue_invoice
FROM projects p
LEFT JOIN invoices i ON i.project_id = p.id
GROUP BY p.id, p.project_name, p.invoice_status, p.payment_status
HAVING
  (p.invoice_status IN ('issued', 'sent') AND NOT BOOL_OR(
    i.deleted_at IS NULL
    AND i.status NOT IN ('cancelled', 'draft')
    AND i.status IN ('issued', 'sent', 'paid', 'overdue')
  ))
  OR (p.invoice_status = 'not_created' AND BOOL_OR(
    i.deleted_at IS NULL
    AND i.status NOT IN ('cancelled', 'draft')
    AND i.status IN ('issued', 'sent', 'paid', 'overdue')
  ));
