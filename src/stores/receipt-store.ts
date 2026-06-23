"use client";

import { create } from "zustand";
import type {
  ReceiptInput,
  ReceiptItemRecord,
  ReceiptListItem,
  ReceiptRecord,
} from "@/lib/commercial-document";
import {
  buildCommercialHeader,
  buildCommercialItemRecords,
  nextCommercialNumber,
} from "@/lib/create-commercial-store";
import { useCustomerStore } from "@/stores/customer-store";
import { useProjectStore } from "@/stores/project-store";

type ReceiptStore = {
  receipts: ReceiptRecord[];
  receiptItems: ReceiptItemRecord[];
  hydrate: (data: {
    receipts: ReceiptRecord[];
    receiptItems: ReceiptItemRecord[];
  }) => void;
  getReceiptById: (id: string) => ReceiptRecord | undefined;
  getByProjectId: (projectId: string) => ReceiptRecord[];
  getItems: (receiptId: string) => ReceiptItemRecord[];
  getListItems: () => ReceiptListItem[];
  createReceipt: (input: ReceiptInput) => ReceiptRecord;
  updateReceipt: (receiptId: string, input: ReceiptInput) => ReceiptRecord | null;
  upsertReceipt: (receipt: ReceiptRecord, items: ReceiptItemRecord[]) => void;
};

export const useReceiptStore = create<ReceiptStore>((set, get) => ({
  receipts: [],
  receiptItems: [],

  hydrate: ({ receipts, receiptItems }) => set({ receipts, receiptItems }),

  getReceiptById: (id) => get().receipts.find((r) => r.id === id),

  getByProjectId: (projectId) =>
    get().receipts.filter((r) => r.projectId === projectId),

  getItems: (receiptId) =>
    get()
      .receiptItems.filter((i) => i.receiptId === receiptId)
      .sort((a, b) => a.sortOrder - b.sortOrder),

  getListItems: () => {
    const projects = useProjectStore.getState().projects;
    const customers = useCustomerStore.getState().customers;
    return get().receipts.map((r) => ({
      ...r,
      projectName:
        projects.find((p) => p.id === r.projectId)?.projectName ??
        "（不明な案件）",
      customerName:
        customers.find((c) => c.id === r.customerId)?.customerName ??
        "（不明な顧客）",
    }));
  },

  createReceipt: (input) => {
    const now = new Date().toISOString();
    const id = `rc_${Date.now().toString(36)}`;
    const items = buildCommercialItemRecords<ReceiptItemRecord>(
      id,
      "receiptId",
      input.items,
      "ri_"
    );
    const header = buildCommercialHeader(input, input.items);
    const receipt: ReceiptRecord = {
      id,
      invoiceId: input.invoiceId ?? "",
      receiptNumber: nextCommercialNumber(
        "RC",
        input.issueDate,
        get().receipts.map((r) => r.receiptNumber)
      ),
      status: "issued",
      createdAt: now,
      updatedAt: now,
      ...header,
    };
    set((s) => ({
      receipts: [receipt, ...s.receipts],
      receiptItems: [...items, ...s.receiptItems],
    }));
    return receipt;
  },

  updateReceipt: (receiptId, input) => {
    const existing = get().getReceiptById(receiptId);
    if (!existing) return null;

    const now = new Date().toISOString();
    const items = buildCommercialItemRecords<ReceiptItemRecord>(
      receiptId,
      "receiptId",
      input.items,
      "ri_"
    );
    const header = buildCommercialHeader(input, input.items);
    const updated: ReceiptRecord = {
      ...existing,
      ...header,
      invoiceId: existing.invoiceId,
      updatedAt: now,
    };

    set((s) => ({
      receipts: s.receipts.map((r) => (r.id === receiptId ? updated : r)),
      receiptItems: [
        ...items,
        ...s.receiptItems.filter((i) => i.receiptId !== receiptId),
      ],
    }));
    return updated;
  },

  upsertReceipt: (receipt, items) =>
    set((s) => {
      const exists = s.receipts.some((r) => r.id === receipt.id);
      return {
        receipts: exists
          ? s.receipts.map((r) => (r.id === receipt.id ? receipt : r))
          : [receipt, ...s.receipts],
        receiptItems: [
          ...items,
          ...s.receiptItems.filter((i) => i.receiptId !== receipt.id),
        ],
      };
    }),
}));
