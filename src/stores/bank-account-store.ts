"use client";

import { create } from "zustand";
import type { BankAccountInput, BankAccountRecord } from "@/lib/commercial-document";

function generateId(): string {
  return `ba_${Date.now().toString(36)}`;
}

type BankAccountStore = {
  bankAccounts: BankAccountRecord[];
  hydrate: (accounts: BankAccountRecord[]) => void;
  getAccounts: () => BankAccountRecord[];
  getById: (id: string) => BankAccountRecord | undefined;
  addAccount: (input: BankAccountInput) => BankAccountRecord;
  updateAccount: (id: string, input: BankAccountInput) => BankAccountRecord | null;
  deleteAccount: (id: string) => boolean;
};

export const useBankAccountStore = create<BankAccountStore>((set, get) => ({
  bankAccounts: [],

  hydrate: (accounts) => set({ bankAccounts: accounts }),

  getAccounts: () =>
    [...get().bankAccounts].sort(
      (a, b) =>
        a.createdAt.localeCompare(b.createdAt) ||
        a.bankName.localeCompare(b.bankName, "ja")
    ),

  getById: (id) => get().bankAccounts.find((a) => a.id === id),

  addAccount: (input) => {
    const now = new Date().toISOString();
    const account: BankAccountRecord = {
      id: generateId(),
      ...input,
      createdAt: now,
      updatedAt: now,
    };
    set((s) => ({ bankAccounts: [...s.bankAccounts, account] }));
    return account;
  },

  updateAccount: (id, input) => {
    let updated: BankAccountRecord | null = null;
    set((s) => ({
      bankAccounts: s.bankAccounts.map((a) => {
        if (a.id !== id) return a;
        updated = {
          ...a,
          ...input,
          updatedAt: new Date().toISOString(),
        };
        return updated;
      }),
    }));
    return updated;
  },

  deleteAccount: (id) => {
    const exists = get().bankAccounts.some((a) => a.id === id);
    if (!exists) return false;
    set((s) => ({
      bankAccounts: s.bankAccounts.filter((a) => a.id !== id),
    }));
    return true;
  },
}));
