import { buildMigrationBanner } from "@/lib/db/migration-warnings";

type SupabaseErrorShape = {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
  status?: number;
};

export const PROJECT_ITEMS_MIGRATION_HINT = buildMigrationBanner(
  "案件明細テーブル（project_items）が未適用です。supabase/add-project-items.sql を実行してください。"
);

export const ITEM_TEMPLATE_CATEGORIES_MIGRATION_HINT = buildMigrationBanner(
  "カテゴリ管理テーブル（item_template_categories）が未適用です。supabase/add-item-template-categories.sql を実行してください。"
);

export const PROJECT_ARCHIVED_MIGRATION_HINT = buildMigrationBanner(
  "案件アーカイブ列（projects.archived）が未適用です。supabase/add-project-archived.sql を実行してください。"
);

export const DOCUMENT_MANAGEMENT_MIGRATION_HINT = buildMigrationBanner(
  "書類管理テーブル（注文書・納品書・領収書・bank_accounts）が未適用です。supabase/add-document-management.sql を実行してください。"
);

export const CONSTRUCTION_ITEM_FIELDS_MIGRATION_HINT = buildMigrationBanner(
  "明細の W/H 列が未適用です。supabase/add-construction-item-fields.sql を実行してください。"
);

const ERROR_HINTS: Record<string, string> = {
  PGRST205: buildMigrationBanner(
    "必要なテーブルが見つかりません。新規環境は supabase/schema-full.sql、既存環境は README の追加 SQL を実行してください。"
  ),
  PGRST202: buildMigrationBanner(
    "ensure_user_profile 関数がありません。supabase/schema-full.sql または ensure-user-profile-rpc.sql を実行してください。"
  ),
  PGRST116:
    "会社データを更新できませんでした。ログアウトして再度ログインするか、Supabase の RLS 設定を確認してください。",
  "42501":
    buildMigrationBanner(
      "データベースへのアクセスが拒否されました（RLS）。supabase/schema-full.sql または schema-auth.sql が適用されているか確認してください。"
    ),
  not_authenticated:
    "ログインセッションが無効です。再度ログインしてください。",
};

const COMPANY_SETTINGS_MIGRATION_HINT = buildMigrationBanner(
  "会社設定用の列が不足しています。supabase/patch-company-settings.sql を実行してください。"
);

/** companies.fax / contact_name 列未作成か */
export function isMissingCompanyFaxContactColumns(error: unknown): boolean {
  const shape = readSupabaseErrorShape(error);
  const text = [shape.message, shape.details, shape.hint].filter(Boolean).join(" ").toLowerCase();
  if (!text.includes("companies")) return false;
  return text.includes("contact_name") || text.includes("fax");
}

function readSupabaseErrorShape(error: unknown): SupabaseErrorShape {
  if (!error || typeof error !== "object") return {};
  const e = error as Record<string, unknown>;
  return {
    code: typeof e.code === "string" ? e.code : undefined,
    message: typeof e.message === "string" ? e.message : undefined,
    details: typeof e.details === "string" ? e.details : undefined,
    hint: typeof e.hint === "string" ? e.hint : undefined,
    status: typeof e.status === "number" ? e.status : undefined,
  };
}

function migrationHintFromMessage(text: string): string | null {
  const lower = text.toLowerCase();
  if (lower.includes("item_template_categories")) {
    return ITEM_TEMPLATE_CATEGORIES_MIGRATION_HINT;
  }
  if (lower.includes("project_items")) {
    return PROJECT_ITEMS_MIGRATION_HINT;
  }
  if (lower.includes("projects") && lower.includes("archived")) {
    return PROJECT_ARCHIVED_MIGRATION_HINT;
  }
  if (lower.includes("archived") && lower.includes("column")) {
    return PROJECT_ARCHIVED_MIGRATION_HINT;
  }
  if (
    lower.includes("quote_items") &&
    (lower.includes("unit") || lower.includes("column"))
  ) {
    return PROJECT_ITEMS_MIGRATION_HINT;
  }
  if (
    lower.includes("invoice_items") &&
    (lower.includes("unit") || lower.includes("column"))
  ) {
    return PROJECT_ITEMS_MIGRATION_HINT;
  }
  if (
    lower.includes("quote_memo_template") ||
    lower.includes("invoice_memo_template") ||
    lower.includes("quote_validity_days") ||
    lower.includes("quote_default_expiry_type") ||
    lower.includes("payment_terms") ||
    lower.includes("order_memo_template") ||
    lower.includes("delivery_note_memo_template") ||
    lower.includes("receipt_memo_template") ||
    lower.includes("contact_name") ||
    lower.includes("fax")
  ) {
    return COMPANY_SETTINGS_MIGRATION_HINT;
  }
  if (lower.includes("companies") && lower.includes("column")) {
    return COMPANY_SETTINGS_MIGRATION_HINT;
  }
  return null;
}

/** item_template_categories テーブル未作成（PGRST205）か */
export function isMissingItemTemplateCategoriesTable(error: unknown): boolean {
  const shape = readSupabaseErrorShape(error);
  if (shape.code !== "PGRST205") return false;
  const text = [shape.message, shape.details, shape.hint].filter(Boolean).join(" ");
  return text.toLowerCase().includes("item_template_categories");
}

/** project_items テーブル未作成（PGRST205）か */
export function isMissingProjectItemsTable(error: unknown): boolean {
  const shape = readSupabaseErrorShape(error);
  if (shape.code !== "PGRST205") return false;
  const text = [shape.message, shape.details, shape.hint].filter(Boolean).join(" ");
  return text.toLowerCase().includes("project_items");
}

/** quotes.expiry_type 列未作成か */
export function isMissingQuoteExpiryTypeColumn(error: unknown): boolean {
  const shape = readSupabaseErrorShape(error);
  const text = [shape.message, shape.details, shape.hint]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  if (!text.includes("expiry_type")) return false;
  return (
    text.includes("quotes") ||
    text.includes("column") ||
    shape.code === "PGRST204" ||
    shape.code === "42703"
  );
}

/** companies.quote_default_expiry_type 列未作成か */
export function isMissingQuoteDefaultExpiryTypeColumn(error: unknown): boolean {
  const shape = readSupabaseErrorShape(error);
  const text = [shape.message, shape.details, shape.hint]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  if (!text.includes("quote_default_expiry_type")) return false;
  return (
    text.includes("companies") ||
    text.includes("column") ||
    shape.code === "PGRST204" ||
    shape.code === "42703"
  );
}

/** companies の STEP14 列（支払条件・書類備考テンプレ）未作成か */
export function isMissingCompanyDocumentSettingsColumns(error: unknown): boolean {
  const shape = readSupabaseErrorShape(error);
  const text = [shape.message, shape.details, shape.hint]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const cols = [
    "payment_terms",
    "order_memo_template",
    "delivery_note_memo_template",
    "receipt_memo_template",
  ];
  if (!cols.some((c) => text.includes(c))) return false;
  return (
    text.includes("companies") ||
    text.includes("column") ||
    shape.code === "PGRST204" ||
    shape.code === "42703"
  );
}

/** projects.confirmed_date / completed_date 列未作成か */
export function isMissingProjectDateColumns(error: unknown): boolean {
  const shape = readSupabaseErrorShape(error);
  const text = [shape.message, shape.details, shape.hint]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  if (
    !text.includes("confirmed_date") &&
    !text.includes("completed_date")
  ) {
    return false;
  }
  return (
    text.includes("projects") ||
    text.includes("column") ||
    shape.code === "PGRST204" ||
    shape.code === "42703"
  );
}

/** projects.archived 列未作成か */
export function isMissingProjectArchivedColumn(error: unknown): boolean {
  const shape = readSupabaseErrorShape(error);
  const text = [shape.message, shape.details, shape.hint].filter(Boolean).join(" ").toLowerCase();
  if (!text.includes("archived")) return false;
  return (
    text.includes("projects") ||
    text.includes("column") ||
    shape.code === "PGRST204" ||
    shape.code === "42703"
  );
}

/** STEP14 書類管理テーブル未作成か */
export function isMissingDocumentManagementTables(error: unknown): boolean {
  const shape = readSupabaseErrorShape(error);
  const text = [shape.message, shape.details, shape.hint]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const tables = [
    "bank_accounts",
    "orders",
    "order_items",
    "delivery_notes",
    "delivery_note_items",
    "receipts",
    "receipt_items",
  ];
  if (!tables.some((t) => text.includes(t))) return false;
  return (
    text.includes("does not exist") ||
    text.includes("could not find") ||
    shape.code === "PGRST205" ||
    shape.code === "42P01"
  );
}

/** quote_items / invoice_items / order_items 等の width / height 列未作成か */
export function isMissingConstructionItemFieldColumns(error: unknown): boolean {
  const shape = readSupabaseErrorShape(error);
  const text = [shape.message, shape.details, shape.hint]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  if (!text.includes("width") && !text.includes("height")) return false;
  const tables = [
    "quote_items",
    "invoice_items",
    "order_items",
    "delivery_note_items",
    "receipt_items",
    "project_items",
  ];
  if (!tables.some((t) => text.includes(t)) && !text.includes("column")) {
    return false;
  }
  return (
    shape.code === "PGRST204" ||
    shape.code === "42703" ||
    text.includes("column") ||
    text.includes("schema cache")
  );
}

export function logSupabaseError(label: string, error: unknown) {
  const shape = readSupabaseErrorShape(error);
  console.error(label, formatSupabaseError(error), shape);
}

export function formatSupabaseError(error: unknown): string {
  if (!error) return "不明なエラー";
  if (typeof error === "string") return error;

  const shape = readSupabaseErrorShape(error);
  if (shape.code && ERROR_HINTS[shape.code]) return ERROR_HINTS[shape.code];

  const parts = [shape.message, shape.details, shape.hint].filter(
    (v) => typeof v === "string" && v.length > 0
  );
  if (parts.length > 0) {
    const joined = parts.join(" — ");
    const migration = migrationHintFromMessage(joined);
    if (migration) return migration;
    return joined;
  }

  if (error instanceof Error && error.message) {
    const migration = migrationHintFromMessage(error.message);
    if (migration) return migration;
    return error.message;
  }

  if (shape.code) return `データベースエラー（${shape.code}）`;
  if (typeof shape.status === "number") {
    return `リクエストエラー（HTTP ${shape.status}）`;
  }

  return "データベースエラーが発生しました。ブラウザのコンソールに詳細が表示されています。";
}

export function toDbErrorMessage(error: unknown): string {
  return formatSupabaseError(error);
}

/** throw 用 — 必ず message 付きの Error にする */
export function toUserFacingDbError(error: unknown): Error {
  if (error instanceof Error && error.message.trim()) {
    const migration = migrationHintFromMessage(error.message);
    if (migration) return new Error(migration);
    return error;
  }
  return new Error(formatSupabaseError(error));
}
