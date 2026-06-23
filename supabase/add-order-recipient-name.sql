-- 注文書: 宛名（注文書ごとに保持、手書き記入用の空欄も可）
alter table public.orders
  add column if not exists recipient_name text not null default '';
