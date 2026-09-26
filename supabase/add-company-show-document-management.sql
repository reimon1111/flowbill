-- 会社設定: サイドバー「書類管理」メニューの表示切替
-- Dashboard → SQL Editor で実行してください。
-- 既存行は default true のため、適用直後の表示は現状どおりです。

alter table public.companies
  add column if not exists show_document_management boolean not null default true;

comment on column public.companies.show_document_management is
  '左サイドバーの書類管理（見積・注文・納品・請求・領収）を表示するか。false でも URL 直アクセス・案件詳細からの操作は可能。';
