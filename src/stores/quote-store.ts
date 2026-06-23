"use client";

import { create } from "zustand";
import type {
  QuoteInput,
  QuoteItemRecord,
  QuoteListItem,
  QuoteRecord,
  QuoteStatus,
} from "@/lib/types";
import { initialQuoteItems, initialQuotes } from "@/lib/mock-quotes";
import { useCustomerStore } from "@/stores/customer-store";
import { useProjectStore } from "@/stores/project-store";
import { useItemTemplateStore } from "@/stores/item-template-store";
import { normalizeUnit } from "@/lib/constants/units";

function id(prefix: string) {
  return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

function computeTotals(items: Array<Pick<QuoteItemRecord, "amount" | "taxRate">>) {
  const subtotal = items.reduce((s, i) => s + i.amount, 0);
  const taxAmount = items.reduce((s, i) => s + i.amount * i.taxRate, 0);
  const totalAmount = subtotal + taxAmount;
  return { subtotal, taxAmount, totalAmount };
}

function yearOf(date: string) {
  return date.slice(0, 4);
}

function nextQuoteNumber(issueDate: string, existing: QuoteRecord[]) {
  const y = yearOf(issueDate);
  const count = existing.filter((q) => q.quoteNumber.startsWith(`QT-${y}-`)).length + 1;
  return `QT-${y}-${String(count).padStart(4, "0")}`;
}

type QuoteStore = {
  quotes: QuoteRecord[];
  quoteItems: QuoteItemRecord[];

  hydrate: (data: { quotes: QuoteRecord[]; quoteItems: QuoteItemRecord[] }) => void;
  mergeQuote: (quote: QuoteRecord, items: QuoteItemRecord[]) => void;
  removeQuote: (quoteId: string) => void;

  getQuotes: () => QuoteRecord[];
  getQuoteById: (id: string) => QuoteRecord | undefined;
  getQuoteItems: (quoteId: string) => QuoteItemRecord[];
  getQuotesByProjectId: (projectId: string) => QuoteRecord[];

  getListItems: () => QuoteListItem[];

  createQuote: (input: QuoteInput) => QuoteRecord;
  updateQuote: (id: string, input: QuoteInput) => QuoteRecord | null;
  deleteQuote: (id: string) => boolean;
  updateQuoteStatus: (id: string, status: QuoteStatus) => QuoteRecord | null;
};

export const useQuoteStore = create<QuoteStore>((set, get) => ({
  quotes: initialQuotes,
  quoteItems: initialQuoteItems,

  hydrate: ({ quotes, quoteItems }) => set({ quotes, quoteItems }),

  mergeQuote: (quote, items) =>
    set((state) => ({
      quotes: [quote, ...state.quotes.filter((q) => q.id !== quote.id)],
      quoteItems: [
        ...items,
        ...state.quoteItems.filter((i) => i.quoteId !== quote.id),
      ],
    })),

  removeQuote: (quoteId) =>
    set((state) => ({
      quotes: state.quotes.filter((q) => q.id !== quoteId),
      quoteItems: state.quoteItems.filter((i) => i.quoteId !== quoteId),
    })),

  getQuotes: () => get().quotes,
  getQuoteById: (quoteId) => get().quotes.find((q) => q.id === quoteId),
  getQuoteItems: (quoteId) =>
    get()
      .quoteItems.filter((i) => i.quoteId === quoteId)
      .sort((a, b) => a.sortOrder - b.sortOrder),
  getQuotesByProjectId: (projectId) =>
    get().quotes.filter((q) => q.projectId === projectId),

  getListItems: () => {
    const customers = useCustomerStore.getState();
    const projects = useProjectStore.getState();
    return get().quotes.map((q) => {
      const p = projects.getProjectById(q.projectId);
      const c = customers.getCustomerById(q.customerId);
      return {
        ...q,
        projectName: p?.projectName ?? "（不明な案件）",
        customerName: c?.customerName ?? "（不明な顧客）",
      };
    });
  },

  createQuote: (input) => {
    const now = new Date().toISOString();
    const quoteId = id("qt_");
    const quoteNumber = nextQuoteNumber(input.issueDate, get().quotes);

    const items: QuoteItemRecord[] = input.items.map((it, idx) => {
      const amount = it.quantity * it.unitPrice;
      return {
        id: id("qti_"),
        quoteId,
        itemTemplateId: it.itemTemplateId,
        name: it.name,
        description: it.description,
        width: it.width ?? "",
        height: it.height ?? "",
        quantity: it.quantity,
        unit: normalizeUnit(it.unit),
        unitPrice: it.unitPrice,
        taxRate: it.taxRate,
        amount,
        sortOrder: it.sortOrder ?? idx,
        createdAt: now,
        updatedAt: now,
      };
    });

    const totals = computeTotals(items);

    const quote: QuoteRecord = {
      id: quoteId,
      projectId: input.projectId,
      customerId: input.customerId,
      quoteNumber,
      issueDate: input.issueDate,
      expiryType: input.expiryType,
      expiryDate: input.expiryDate,
      status: "draft",
      subtotal: totals.subtotal,
      taxAmount: totals.taxAmount,
      totalAmount: totals.totalAmount,
      memo: input.memo,
      paymentTerms: input.paymentTerms,
      createdAt: now,
      updatedAt: now,
    };

    set((s) => ({
      quotes: [quote, ...s.quotes],
      quoteItems: [...items, ...s.quoteItems],
    }));

    return quote;
  },

  updateQuote: (quoteId, input) => {
    const existing = get().getQuoteById(quoteId);
    if (!existing) return null;

    const now = new Date().toISOString();
    const items: QuoteItemRecord[] = input.items.map((it, idx) => {
      const amount = it.quantity * it.unitPrice;
      // 既存idは保持せずスナップショットとして差し替え（RLS/DB移行時も簡単）
      return {
        id: id("qti_"),
        quoteId,
        itemTemplateId: it.itemTemplateId,
        name: it.name,
        description: it.description,
        width: it.width ?? "",
        height: it.height ?? "",
        quantity: it.quantity,
        unit: normalizeUnit(it.unit),
        unitPrice: it.unitPrice,
        taxRate: it.taxRate,
        amount,
        sortOrder: it.sortOrder ?? idx,
        createdAt: now,
        updatedAt: now,
      };
    });
    const totals = computeTotals(items);

    const updated: QuoteRecord = {
      ...existing,
      projectId: input.projectId,
      customerId: input.customerId,
      issueDate: input.issueDate,
      expiryType: input.expiryType,
      expiryDate: input.expiryDate,
      subtotal: totals.subtotal,
      taxAmount: totals.taxAmount,
      totalAmount: totals.totalAmount,
      memo: input.memo,
      paymentTerms: input.paymentTerms,
      updatedAt: now,
    };

    set((s) => ({
      quotes: s.quotes.map((q) => (q.id === quoteId ? updated : q)),
      quoteItems: [...items, ...s.quoteItems.filter((i) => i.quoteId !== quoteId)],
    }));

    return updated;
  },

  deleteQuote: (quoteId) => {
    const exists = get().quotes.some((q) => q.id === quoteId);
    if (!exists) return false;
    set((s) => ({
      quotes: s.quotes.filter((q) => q.id !== quoteId),
      quoteItems: s.quoteItems.filter((i) => i.quoteId !== quoteId),
    }));
    return true;
  },

  updateQuoteStatus: (quoteId, status) => {
    const existing = get().getQuoteById(quoteId);
    if (!existing) return null;
    const updated: QuoteRecord = {
      ...existing,
      status,
      updatedAt: new Date().toISOString(),
    };
    set((s) => ({
      quotes: s.quotes.map((q) => (q.id === quoteId ? updated : q)),
    }));

    // accepted/rejected は、テンプレ側のUIだけで完結させず、
    // STEP4の体験として案件側にも反映される
    if (status === "accepted") {
      useProjectStore.getState().changeStatus(updated.projectId, "ordered");
    }
    if (status === "sent") {
      useProjectStore.getState().changeStatus(updated.projectId, "estimate");
    }
    if (status === "rejected") {
      useProjectStore.getState().changeStatus(updated.projectId, "lost");
    }

    // 履歴を追加
    const historyTitle =
      status === "sent"
        ? "見積を提出済みにしました"
        : status === "accepted"
          ? "見積が承認され、案件を受注に変更しました"
          : status === "rejected"
            ? "見積が否認されました"
            : "見積を下書きに戻しました";

    useProjectStore.getState().addHistory({
      projectId: updated.projectId,
      type: "status_changed",
      title: historyTitle,
      description: `見積 ${updated.quoteNumber}`,
    });

    return updated;
  },
}));

export function getItemTemplateSnapshot(templateId: string | null) {
  if (!templateId) return null;
  return useItemTemplateStore.getState().getItemTemplateById(templateId);
}

