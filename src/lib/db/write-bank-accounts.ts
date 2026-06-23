import type { BankAccountInput, BankAccountRecord } from "@/lib/commercial-document";
import { getSupabaseClient } from "@/lib/supabase/client";
import { resolveCompanyId } from "@/lib/db/company-context";
import { generateId } from "@/lib/db/ids";
import { bankAccountFromRow, bankAccountToRow, type BankAccountRow } from "@/lib/db/commercial-mappers";

export async function dbFetchBankAccounts(): Promise<BankAccountRecord[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("bank_accounts")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data as BankAccountRow[]).map(bankAccountFromRow);
}

export async function dbInsertBankAccount(
  input: BankAccountInput
): Promise<BankAccountRecord> {
  const companyId = await resolveCompanyId();
  const now = new Date().toISOString();
  const account: BankAccountRecord = {
    id: generateId("ba_"),
    ...input,
    createdAt: now,
    updatedAt: now,
  };
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from("bank_accounts")
    .insert(bankAccountToRow(companyId, account));
  if (error) throw error;
  return account;
}

export async function dbUpdateBankAccount(
  id: string,
  input: BankAccountInput
): Promise<BankAccountRecord | null> {
  const companyId = await resolveCompanyId();
  const supabase = getSupabaseClient();
  const { data, error: fetchError } = await supabase
    .from("bank_accounts")
    .select("*")
    .eq("id", id)
    .single();
  if (fetchError || !data) return null;

  const updated: BankAccountRecord = {
    ...bankAccountFromRow(data as BankAccountRow),
    ...input,
    updatedAt: new Date().toISOString(),
  };
  const { error } = await supabase
    .from("bank_accounts")
    .update(bankAccountToRow(companyId, updated))
    .eq("id", id);
  if (error) throw error;
  return updated;
}

export async function dbDeleteBankAccount(id: string): Promise<boolean> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from("bank_accounts").delete().eq("id", id);
  if (error) throw error;
  return true;
}

/** invoices.bank_account_id 用 — DB に存在する ID のみ返す */
export async function dbResolveBankAccountId(
  bankAccountId: string | null | undefined
): Promise<string | null> {
  const id = bankAccountId?.trim();
  if (!id) return null;

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("bank_accounts")
    .select("id")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data?.id ?? null;
}
