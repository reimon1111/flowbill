import type { BankAccountRecord } from "@/lib/commercial-document";

export const initialBankAccounts: BankAccountRecord[] = [
  {
    id: "ba_1",
    label: "八十二銀行",
    bankName: "八十二銀行",
    bankBranch: "長野支店",
    bankAccountType: "普通",
    bankAccountNumber: "1234567",
    bankAccountHolder: "カ）クリエイトスタジオ",
    sortOrder: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];
