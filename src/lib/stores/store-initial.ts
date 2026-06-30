import { isSupabaseConfigured } from "@/lib/supabase/config";

/** Supabase 有効時は空、未設定時のみモックデータを使う */
export function initialStoreData<T>(mockValue: T, emptyValue: T): T {
  return isSupabaseConfigured() ? emptyValue : mockValue;
}
