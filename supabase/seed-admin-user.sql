-- 運営管理者（青木）を admin_users に登録
-- 使い方: YOUR_ADMIN_EMAIL を実際のメールアドレスに書き換えて実行
-- 対象ユーザーは先に1回ログインして auth.users に存在している必要があります

insert into public.admin_users (id, user_id, email, role, created_at)
select
  'adm_' || substr(md5(u.id::text), 1, 12),
  u.id,
  u.email,
  'super_admin',
  now()
from auth.users u
where lower(u.email) = lower('YOUR_ADMIN_EMAIL@example.com')
on conflict (user_id) do nothing;
