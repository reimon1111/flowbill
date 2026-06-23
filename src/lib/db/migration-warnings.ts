/** 画面上部バナー — 未適用 SQL がある場合の共通メッセージ */
export const MIGRATION_BANNER_MESSAGE =
  "Supabaseの一部テーブルまたはカラムが未適用です。READMEの「既存環境をアップデートする場合」を確認してください。";

/** 詳細を付けた警告文を組み立てる */
export function buildMigrationBanner(detail?: string): string {
  if (!detail?.trim()) return MIGRATION_BANNER_MESSAGE;
  return `${MIGRATION_BANNER_MESSAGE} ${detail.trim()}`;
}
