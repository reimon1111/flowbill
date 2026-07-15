"use client";

import { create } from "zustand";
import type {
  RecurringBillingInput,
  RecurringBillingItemRecord,
  RecurringBillingListItem,
  RecurringBillingRecord,
  RecurringBillingStatus,
} from "@/lib/types";
import {
  initialRecurringBillingItems,
  initialRecurringBillings,
} from "@/lib/mock-recurring";
import { initialStoreData } from "@/lib/stores/store-initial";
import { advanceNextBillingDate } from "@/lib/recurring-utils";
import { useCustomerStore } from "@/stores/customer-store";

function id(prefix: string) {
  return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

function computeTotals(items: Array<Pick<RecurringBillingItemRecord, "amount" | "taxRate">>) {
  const subtotal = items.reduce((s, i) => s + i.amount, 0);
  const taxAmount = items.reduce((s, i) => s + i.amount * i.taxRate, 0);
  const totalAmount = subtotal + taxAmount;
  return { subtotal, taxAmount, totalAmount };
}

type RecurringStore = {
  recurringBillings: RecurringBillingRecord[];
  recurringBillingItems: RecurringBillingItemRecord[];

  hydrate: (data: {
    recurringBillings: RecurringBillingRecord[];
    recurringBillingItems: RecurringBillingItemRecord[];
  }) => void;
  mergeRecurring: (
    billing: RecurringBillingRecord,
    items: RecurringBillingItemRecord[]
  ) => void;

  getRecurringBillings: () => RecurringBillingRecord[];
  getRecurringById: (id: string) => RecurringBillingRecord | undefined;
  getRecurringItems: (recurringBillingId: string) => RecurringBillingItemRecord[];
  getListItems: () => RecurringBillingListItem[];

  createRecurring: (input: RecurringBillingInput) => RecurringBillingRecord;
  updateRecurring: (id: string, input: RecurringBillingInput) => RecurringBillingRecord | null;
  updateRecurringStatus: (
    id: string,
    status: RecurringBillingStatus
  ) => RecurringBillingRecord | null;
  advanceAfterInvoice: (id: string) => RecurringBillingRecord | null;
};

export const useRecurringStore = create<RecurringStore>((set, get) => ({
  recurringBillings: initialStoreData(initialRecurringBillings, []),
  recurringBillingItems: initialStoreData(initialRecurringBillingItems, []),

  hydrate: ({ recurringBillings, recurringBillingItems }) =>
    set({ recurringBillings, recurringBillingItems }),

  mergeRecurring: (billing, items) =>
    set((state) => ({
      recurringBillings: [
        billing,
        ...state.recurringBillings.filter((r) => r.id !== billing.id),
      ],
      recurringBillingItems: [
        ...items,
        ...state.recurringBillingItems.filter(
          (i) => i.recurringBillingId !== billing.id
        ),
      ],
    })),

  getRecurringBillings: () => get().recurringBillings,
  getRecurringById: (recurringId) =>
    get().recurringBillings.find((r) => r.id === recurringId),
  getRecurringItems: (recurringBillingId) =>
    get()
      .recurringBillingItems.filter((i) => i.recurringBillingId === recurringBillingId)
      .sort((a, b) => a.sortOrder - b.sortOrder),

  getListItems: () => {
    const customers = useCustomerStore.getState();
    return get().recurringBillings.map((r) => {
      const c = customers.getCustomerById(r.customerId);
      return {
        ...r,
        customerName: c?.customerName ?? "（不明な顧客）",
      };
    });
  },

  createRecurring: (input) => {
    const now = new Date().toISOString();
    const recurringId = id("rb_");

    const items: RecurringBillingItemRecord[] = input.items.map((it, idx) => {
      const amount = it.quantity * it.unitPrice;
      return {
        id: id("rbi_"),
        recurringBillingId: recurringId,
        itemTemplateId: it.itemTemplateId,
        name: it.name,
        description: it.description,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        taxRate: it.taxRate,
        amount,
        sortOrder: it.sortOrder ?? idx,
        createdAt: now,
        updatedAt: now,
      };
    });
    const totals = computeTotals(items);

    const record: RecurringBillingRecord = {
      id: recurringId,
      customerId: input.customerId,
      title: input.title,
      billingDay: input.billingDay,
      nextBillingDate: input.nextBillingDate,
      status: "active",
      subtotal: totals.subtotal,
      taxAmount: totals.taxAmount,
      totalAmount: totals.totalAmount,
      discountLabel: "",
      discountAmount: 0,
      memo: input.memo,
      createdAt: now,
      updatedAt: now,
    };

    set((s) => ({
      recurringBillings: [record, ...s.recurringBillings],
      recurringBillingItems: [...items, ...s.recurringBillingItems],
    }));

    return record;
  },

  updateRecurring: (recurringId, input) => {
    const existing = get().getRecurringById(recurringId);
    if (!existing || existing.status === "ended") return null;

    const now = new Date().toISOString();
    const items: RecurringBillingItemRecord[] = input.items.map((it, idx) => {
      const amount = it.quantity * it.unitPrice;
      return {
        id: id("rbi_"),
        recurringBillingId: recurringId,
        itemTemplateId: it.itemTemplateId,
        name: it.name,
        description: it.description,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        taxRate: it.taxRate,
        amount,
        sortOrder: it.sortOrder ?? idx,
        createdAt: now,
        updatedAt: now,
      };
    });
    const totals = computeTotals(items);

    const updated: RecurringBillingRecord = {
      ...existing,
      customerId: input.customerId,
      title: input.title,
      billingDay: input.billingDay,
      nextBillingDate: input.nextBillingDate,
      subtotal: totals.subtotal,
      taxAmount: totals.taxAmount,
      totalAmount: totals.totalAmount,
      discountLabel: existing?.discountLabel ?? "",
      discountAmount: existing?.discountAmount ?? 0,
      memo: input.memo,
      updatedAt: now,
    };

    set((s) => ({
      recurringBillings: s.recurringBillings.map((r) =>
        r.id === recurringId ? updated : r
      ),
      recurringBillingItems: [
        ...items,
        ...s.recurringBillingItems.filter((i) => i.recurringBillingId !== recurringId),
      ],
    }));

    return updated;
  },

  updateRecurringStatus: (recurringId, status) => {
    const existing = get().getRecurringById(recurringId);
    if (!existing) return null;
    if (existing.status === "ended" && status !== "ended") return null;

    const updated: RecurringBillingRecord = {
      ...existing,
      status,
      updatedAt: new Date().toISOString(),
    };

    set((s) => ({
      recurringBillings: s.recurringBillings.map((r) =>
        r.id === recurringId ? updated : r
      ),
    }));

    return updated;
  },

  advanceAfterInvoice: (recurringId) => {
    const existing = get().getRecurringById(recurringId);
    if (!existing || existing.status !== "active") return null;

    const nextBillingDate = advanceNextBillingDate(
      existing.nextBillingDate,
      existing.billingDay
    );

    const updated: RecurringBillingRecord = {
      ...existing,
      nextBillingDate,
      updatedAt: new Date().toISOString(),
    };

    set((s) => ({
      recurringBillings: s.recurringBillings.map((r) =>
        r.id === recurringId ? updated : r
      ),
    }));

    return updated;
  },
}));
