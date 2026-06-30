"use client";

import { create } from "zustand";
import type {
  InvoiceDocumentStatus,
  InvoiceInput,
  InvoiceItemRecord,
  InvoiceListItem,
  InvoiceRecord,
} from "@/lib/types";
import { initialInvoiceItems, initialInvoices } from "@/lib/mock-invoices";
import { initialStoreData } from "@/lib/stores/store-initial";
import { useCustomerStore } from "@/stores/customer-store";
import { useProjectStore } from "@/stores/project-store";
import { resolveProjectFieldsAfterInvoiceChange } from "@/lib/invoice-project-sync";
import { useQuoteStore } from "@/stores/quote-store";
import { normalizeUnit } from "@/lib/constants/units";
import {
  resolveProjectNameFromStore,
  UNKNOWN_CUSTOMER_LABEL,
} from "@/lib/project-display";

function id(prefix: string) {
  return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

function isOverdue(dueDate: string) {
  if (!dueDate) return false;
  const due = new Date(dueDate + "T23:59:59");
  return due < new Date();
}

function computeTotals(items: Array<Pick<InvoiceItemRecord, "amount" | "taxRate">>) {
  const subtotal = items.reduce((s, i) => s + i.amount, 0);
  const taxAmount = items.reduce((s, i) => s + i.amount * i.taxRate, 0);
  const totalAmount = subtotal + taxAmount;
  return { subtotal, taxAmount, totalAmount };
}

function yearOf(date: string) {
  return date.slice(0, 4);
}

function nextInvoiceNumber(issueDate: string, existing: InvoiceRecord[]) {
  const y = yearOf(issueDate);
  const count = existing.filter((q) => q.invoiceNumber.startsWith(`INV-${y}-`)).length + 1;
  return `INV-${y}-${String(count).padStart(4, "0")}`;
}

type InvoiceStore = {
  invoices: InvoiceRecord[];
  invoiceItems: InvoiceItemRecord[];

  hydrate: (data: {
    invoices: InvoiceRecord[];
    invoiceItems: InvoiceItemRecord[];
  }) => void;
  mergeInvoice: (invoice: InvoiceRecord, items: InvoiceItemRecord[]) => void;
  removeInvoice: (invoiceId: string) => void;

  getInvoices: () => InvoiceRecord[];
  getInvoiceById: (id: string) => InvoiceRecord | undefined;
  getInvoiceItems: (invoiceId: string) => InvoiceItemRecord[];
  getInvoicesByProjectId: (projectId: string) => InvoiceRecord[];
  getListItems: () => InvoiceListItem[];

  createInvoice: (input: InvoiceInput) => InvoiceRecord;
  updateInvoice: (id: string, input: InvoiceInput) => InvoiceRecord | null;
  deleteInvoice: (id: string) => boolean;
  updateInvoiceStatus: (id: string, status: InvoiceDocumentStatus) => InvoiceRecord | null;
  refreshOverdueInvoices: () => void;
};

export const useInvoiceStore = create<InvoiceStore>((set, get) => ({
  invoices: initialStoreData(initialInvoices, []),
  invoiceItems: initialStoreData(initialInvoiceItems, []),

  hydrate: ({ invoices, invoiceItems }) => set({ invoices, invoiceItems }),

  mergeInvoice: (invoice, items) =>
    set((state) => ({
      invoices: [invoice, ...state.invoices.filter((q) => q.id !== invoice.id)],
      invoiceItems: [
        ...items,
        ...state.invoiceItems.filter((i) => i.invoiceId !== invoice.id),
      ],
    })),

  removeInvoice: (invoiceId) =>
    set((state) => ({
      invoices: state.invoices.filter((q) => q.id !== invoiceId),
      invoiceItems: state.invoiceItems.filter((i) => i.invoiceId !== invoiceId),
    })),

  getInvoices: () => get().invoices,
  getInvoiceById: (invoiceId) => get().invoices.find((q) => q.id === invoiceId),
  getInvoiceItems: (invoiceId) =>
    get()
      .invoiceItems.filter((i) => i.invoiceId === invoiceId)
      .sort((a, b) => a.sortOrder - b.sortOrder),
  getInvoicesByProjectId: (projectId) =>
    get().invoices.filter((q) => q.projectId === projectId),

  getListItems: () => {
    const customers = useCustomerStore.getState();
    const projects = useProjectStore.getState().projects;
    const quotes = useQuoteStore.getState();
    return get().invoices.map((inv) => {
      const c = customers.getCustomerById(inv.customerId);
      const q = quotes.getQuoteById(inv.quoteId);
      return {
        ...inv,
        projectName: resolveProjectNameFromStore(inv.projectId, projects, {
          documentType: "invoice",
          documentId: inv.id,
        }),
        customerName: c?.customerName ?? UNKNOWN_CUSTOMER_LABEL,
        quoteNumber: q?.quoteNumber ?? "（不明な見積）",
      };
    });
  },

  createInvoice: (input) => {
    const now = new Date().toISOString();
    const invoiceId = id("inv_");
    const invoiceNumber = nextInvoiceNumber(input.issueDate, get().invoices);

    const items: InvoiceItemRecord[] = input.items.map((it, idx) => {
      const amount = it.quantity * it.unitPrice;
      return {
        id: id("invi_"),
        invoiceId,
        quoteItemId: it.quoteItemId,
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
        createdBy: null,
        updatedBy: null,
        createdAt: now,
        updatedAt: now,
      };
    });
    const totals = computeTotals(items);

    const invoice: InvoiceRecord = {
      id: invoiceId,
      projectId: input.projectId,
      customerId: input.customerId,
      quoteId: input.quoteId,
      invoiceNumber,
      issueDate: input.issueDate,
      dueDate: input.dueDate,
      status: "draft",
      subtotal: totals.subtotal,
      taxAmount: totals.taxAmount,
      totalAmount: totals.totalAmount,
      pdfUrl: null,
      memo: input.memo,
      paymentTerms: input.paymentTerms,
      bankAccountId: input.bankAccountId ?? null,
      createdBy: null,
      updatedBy: null,
      createdAt: now,
      updatedAt: now,
    };

    set((s) => ({
      invoices: [invoice, ...s.invoices],
      invoiceItems: [...items, ...s.invoiceItems],
    }));

    const proj = useProjectStore.getState().getProjectById(input.projectId);
    if (proj) {
      useProjectStore.getState().upsertProject({
        ...proj,
        invoiceStatus: "draft",
        updatedAt: now,
      });
      useProjectStore.getState().addHistory({
        projectId: input.projectId,
        type: "invoice_generated",
        title: "請求書を作成しました",
        description: invoiceNumber,
      });
    }

    return invoice;
  },

  updateInvoice: (invoiceId, input) => {
    const existing = get().getInvoiceById(invoiceId);
    if (!existing) return null;

    const now = new Date().toISOString();
    const items: InvoiceItemRecord[] = input.items.map((it, idx) => {
      const amount = it.quantity * it.unitPrice;
      return {
        id: id("invi_"),
        invoiceId,
        quoteItemId: it.quoteItemId,
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
        createdBy: null,
        updatedBy: null,
        createdAt: now,
        updatedAt: now,
      };
    });
    const totals = computeTotals(items);

    const updated: InvoiceRecord = {
      ...existing,
      projectId: input.projectId,
      customerId: input.customerId,
      quoteId: input.quoteId,
      issueDate: input.issueDate,
      dueDate: input.dueDate,
      subtotal: totals.subtotal,
      taxAmount: totals.taxAmount,
      totalAmount: totals.totalAmount,
      memo: input.memo,
      paymentTerms: input.paymentTerms,
      bankAccountId: input.bankAccountId ?? null,
      updatedAt: now,
    };

    set((s) => ({
      invoices: s.invoices.map((q) => (q.id === invoiceId ? updated : q)),
      invoiceItems: [...items, ...s.invoiceItems.filter((i) => i.invoiceId !== invoiceId)],
    }));

    return updated;
  },

  deleteInvoice: (invoiceId) => {
    const exists = get().invoices.some((q) => q.id === invoiceId);
    if (!exists) return false;
    set((s) => ({
      invoices: s.invoices.filter((q) => q.id !== invoiceId),
      invoiceItems: s.invoiceItems.filter((i) => i.invoiceId !== invoiceId),
    }));
    return true;
  },

  updateInvoiceStatus: (invoiceId, status) => {
    const existing = get().getInvoiceById(invoiceId);
    if (!existing) return null;

    const updated: InvoiceRecord = {
      ...existing,
      status,
      updatedAt: new Date().toISOString(),
    };
    set((s) => ({
      invoices: s.invoices.map((q) => (q.id === invoiceId ? updated : q)),
    }));

    const projects = useProjectStore.getState();
    const patchProject = (
      projectId: string,
      patch: Partial<{
        status: "estimate" | "ordered" | "in_progress" | "completed" | "lost";
        invoiceStatus: "not_created" | "draft" | "issued" | "sent";
        paymentStatus: "unpaid" | "paid" | "overdue";
      }>
    ) => {
      useProjectStore.setState((state) => ({
        projects: state.projects.map((p) =>
          p.id === projectId
            ? { ...p, ...patch, updatedAt: new Date().toISOString() }
            : p
        ),
      }));
    };

    if (status === "issued") {
      patchProject(updated.projectId, {
        status: "completed",
        invoiceStatus: "issued",
        paymentStatus: isOverdue(updated.dueDate) ? "overdue" : "unpaid",
      });
      projects.addHistory({
        projectId: updated.projectId,
        type: "invoice_generated",
        title: "請求書を発行済みにしました",
        description: updated.invoiceNumber,
      });
    }

    if (status === "sent") {
      patchProject(updated.projectId, { invoiceStatus: "sent" });
      projects.addHistory({
        projectId: updated.projectId,
        type: "updated",
        title: "請求書を送付済みにしました",
        description: updated.invoiceNumber,
      });
    }

    if (status === "paid") {
      patchProject(updated.projectId, {
        status: "completed",
        paymentStatus: "paid",
      });
      projects.addHistory({
        projectId: updated.projectId,
        type: "payment_received",
        title: "入金済みにしました",
        description: updated.invoiceNumber,
      });
    }

    if (status === "cancelled") {
      const derived = resolveProjectFieldsAfterInvoiceChange(
        updated.projectId,
        get().invoices.map((inv) => (inv.id === invoiceId ? updated : inv))
      );
      patchProject(updated.projectId, derived);
      projects.addHistory({
        projectId: updated.projectId,
        type: "updated",
        title: "請求書をキャンセルしました",
        description: updated.invoiceNumber,
      });
    }

    return updated;
  },

  refreshOverdueInvoices: () => {
    const now = new Date().toISOString();
    const overdueProjectIds = new Set<string>();
    set((s) => ({
      invoices: s.invoices.map((inv) => {
        if (inv.status === "paid" || inv.status === "cancelled" || inv.status === "draft") {
          return inv;
        }
        if (isOverdue(inv.dueDate) && (inv.status === "issued" || inv.status === "sent")) {
          overdueProjectIds.add(inv.projectId);
          return { ...inv, status: "overdue", updatedAt: now };
        }
        if (inv.status === "overdue") {
          overdueProjectIds.add(inv.projectId);
        }
        return inv;
      }),
    }));
    if (overdueProjectIds.size > 0) {
      useProjectStore.setState((state) => ({
        projects: state.projects.map((p) =>
          overdueProjectIds.has(p.id)
            ? { ...p, paymentStatus: "overdue", updatedAt: now }
            : p
        ),
      }));
    }
  },
}));

