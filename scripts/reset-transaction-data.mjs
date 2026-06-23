/**
 * 案件・見積・請求データを Supabase から削除（Dashboard SQL Editor が使えない場合用）
 *
 * 事前準備:
 * 1. Supabase Dashboard → Project Settings → API → service_role key をコピー
 * 2. .env.local に追加: SUPABASE_SERVICE_ROLE_KEY=eyJ...
 *
 * 実行:
 *   npm run reset:data
 *
 * ⚠ service_role key は絶対に Git にコミットしないでください
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvLocal() {
  const path = resolve(process.cwd(), ".env.local");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnvLocal();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url) {
  console.error("NEXT_PUBLIC_SUPABASE_URL が .env.local にありません");
  process.exit(1);
}

if (!serviceKey) {
  console.error(
    [
      "SUPABASE_SERVICE_ROLE_KEY が .env.local にありません。",
      "",
      "Supabase Dashboard → Project Settings → API → service_role をコピーし、",
      ".env.local に SUPABASE_SERVICE_ROLE_KEY=... を追加してから再実行してください。",
      "",
      "※ Dashboard で api.supabase.com エラーが出る場合は、",
      "  別ブラウザ（シークレット）や VPN オフで Dashboard を開き直してください。",
    ].join("\n")
  );
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function count(table) {
  const { count, error } = await supabase
    .from(table)
    .select("*", { count: "exact", head: true });
  if (error) throw new Error(`${table}: ${error.message}`);
  return count ?? 0;
}

async function main() {
  console.log("削除前:");
  console.log(
    `  projects=${await count("projects")}, quotes=${await count("quotes")}, invoices=${await count("invoices")}`
  );

  const { error } = await supabase.from("projects").delete().neq("id", "");
  if (error) throw error;

  console.log("削除後:");
  console.log(
    `  projects=${await count("projects")}, quotes=${await count("quotes")}, invoices=${await count("invoices")}`
  );
  console.log("\n完了しました。ブラウザで FlowBill を再読み込みしてください。");
}

main().catch((err) => {
  console.error("リセットに失敗しました:", err.message ?? err);
  process.exit(1);
});
