-- 案件備考（帳票新規作成時の備考初期値の先頭に差し込む）
-- Dashboard → SQL Editor で実行してください。
-- 既存行は default '' のため互換性あり。

alter table public.projects
  add column if not exists document_memo text not null default '';

comment on column public.projects.document_memo is
  '案件備考。見積・注文・納品・請求・領収の新規作成時に会社備考テンプレートの前へ結合する。既存帳票の備考は変更しない。';
