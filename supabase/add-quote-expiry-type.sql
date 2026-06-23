-- 見積の有効期限タイプ（期間選択）
alter table quotes
  add column if not exists expiry_type text not null default 'custom';

-- 既存データは任意日付扱い
update quotes
set expiry_type = 'custom'
where expiry_type is null or expiry_type = '';

-- 会社設定: 見積のデフォルト有効期限
alter table companies
  add column if not exists quote_default_expiry_type text not null default '1_month';
