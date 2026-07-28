-- ユーザー（profiles）の帳票用メールアドレス
-- Dashboard → SQL Editor で実行してください。
-- 既存行は default '' のため互換性あり。

alter table public.profiles
  add column if not exists document_email text not null default '';

comment on column public.profiles.document_email is
  '帳票用メールアドレス。未入力時は会社設定のメールを帳票初期値に使用する。';
