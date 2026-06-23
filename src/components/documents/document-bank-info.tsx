import type { BankAccountDisplay } from "@/lib/services/bank-accounts";

function formatBankLine(account: BankAccountDisplay): string {
  return [
    account.bankName,
    account.bankBranch,
    account.bankAccountType,
    account.bankAccountNumber,
  ]
    .filter(Boolean)
    .join(" ");
}

export function DocumentBankInfo({
  bankAccounts,
}: {
  bankAccounts?: BankAccountDisplay[];
}) {
  const accounts = (bankAccounts ?? []).filter((account) => formatBankLine(account));
  if (accounts.length === 0) return null;

  return (
    <div className="document-bank text-[10px] leading-snug text-zinc-700">
      <p className="font-medium text-zinc-800">お振込先</p>
      <div className="mt-0.5 space-y-1">
        {accounts.map((account, index) => {
          const bankLine = formatBankLine(account);
          return (
            <div key={`${bankLine}-${index}`}>
              <p>{bankLine}</p>
              {account.bankAccountHolder ? <p>{account.bankAccountHolder}</p> : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
