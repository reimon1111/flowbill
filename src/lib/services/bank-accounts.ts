import type { BankAccountInput, BankAccountRecord } from "@/lib/commercial-document";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import {
  dbDeleteBankAccount,
  dbInsertBankAccount,
  dbResolveBankAccountId,
  dbUpdateBankAccount,
} from "@/lib/db/write-bank-accounts";
import { useBankAccountStore } from "@/stores/bank-account-store";
import { useCompanySettingsStore } from "@/stores/company-settings-store";

export function resolveDefaultBankAccountId(): string | null {
  return useBankAccountStore.getState().getAccounts()[0]?.id ?? null;
}

export type BankAccountDisplay = Pick<
  BankAccountRecord,
  "bankName" | "bankBranch" | "bankAccountType" | "bankAccountNumber" | "bankAccountHolder"
>;

/** 請求書プレビュー用 — 登録済み口座をすべて返す */
export function resolveAllBankAccountsForDisplay(): BankAccountDisplay[] {
  const accounts = useBankAccountStore.getState().getAccounts();
  if (accounts.length > 0) return accounts;

  const settings = useCompanySettingsStore.getState().settings;
  if (!settings.bankName.trim()) return [];

  return [
    {
      bankName: settings.bankName,
      bankBranch: settings.bankBranch,
      bankAccountType: settings.bankAccountType,
      bankAccountNumber: settings.bankAccountNumber,
      bankAccountHolder: settings.bankAccountHolder,
    },
  ];
}

/** 請求書プレビュー用 — bankAccountId 指定時はその1件、未指定時は全口座 */
export function resolveBankAccountsForInvoiceDisplay(
  bankAccountId?: string | null
): BankAccountDisplay[] {
  const id = bankAccountId?.trim();
  if (id) {
    const account = useBankAccountStore.getState().getById(id);
    if (account) return [account];
  }
  return resolveAllBankAccountsForDisplay();
}

/** 請求書プレビュー用 — 口座ID → 登録口座 → 会社設定の順で解決 */
export function resolveBankAccountForDisplay(
  bankAccountId?: string | null
): BankAccountDisplay | null {
  if (bankAccountId) {
    const byId = useBankAccountStore.getState().getById(bankAccountId);
    if (byId) return byId;
  }

  const accounts = resolveAllBankAccountsForDisplay();
  return accounts[0] ?? null;
}

function formatBankAccountLine(account: BankAccountDisplay): string {
  return [
    account.bankName,
    account.bankBranch,
    account.bankAccountType,
    account.bankAccountNumber,
  ]
    .filter(Boolean)
    .join(" ");
}

export function formatBankAccountOptionLabel(account: BankAccountDisplay): string {
  const line = formatBankAccountLine(account);
  return account.bankAccountHolder
    ? `${line}（${account.bankAccountHolder}）`
    : line;
}

/** 請求書保存用 — Supabase では bank_accounts に存在する ID のみ（未選択は null） */
export async function resolveBankAccountIdForInvoice(
  bankAccountId: string | null | undefined
): Promise<string | null> {
  const explicitId = bankAccountId?.trim() || null;
  if (!explicitId) return null;
  if (!isSupabaseConfigured()) return explicitId;
  return dbResolveBankAccountId(explicitId);
}

export async function addBankAccount(
  input: BankAccountInput
): Promise<BankAccountRecord> {
  if (isSupabaseConfigured()) {
    const account = await dbInsertBankAccount(input);
    useBankAccountStore.getState().hydrate([
      ...useBankAccountStore.getState().bankAccounts.filter((a) => a.id !== account.id),
      account,
    ]);
    return account;
  }
  return useBankAccountStore.getState().addAccount(input);
}

export async function updateBankAccount(
  id: string,
  input: BankAccountInput
): Promise<BankAccountRecord | null> {
  if (isSupabaseConfigured()) {
    const account = await dbUpdateBankAccount(id, input);
    if (!account) return null;
    useBankAccountStore.getState().hydrate(
      useBankAccountStore
        .getState()
        .bankAccounts.map((a) => (a.id === id ? account : a))
    );
    return account;
  }
  return useBankAccountStore.getState().updateAccount(id, input);
}

export async function deleteBankAccount(id: string): Promise<boolean> {
  if (isSupabaseConfigured()) {
    await dbDeleteBankAccount(id);
  }
  return useBankAccountStore.getState().deleteAccount(id);
}
