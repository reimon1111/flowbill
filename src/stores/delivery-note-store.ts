"use client";

import { create } from "zustand";
import type {
  DeliveryNoteInput,
  DeliveryNoteItemRecord,
  DeliveryNoteListItem,
  DeliveryNoteRecord,
} from "@/lib/commercial-document";
import {
  buildCommercialHeader,
  buildCommercialItemRecords,
  nextCommercialNumber,
} from "@/lib/create-commercial-store";
import { useCustomerStore } from "@/stores/customer-store";
import { useProjectStore } from "@/stores/project-store";

type DeliveryNoteStore = {
  deliveryNotes: DeliveryNoteRecord[];
  deliveryNoteItems: DeliveryNoteItemRecord[];
  hydrate: (data: {
    deliveryNotes: DeliveryNoteRecord[];
    deliveryNoteItems: DeliveryNoteItemRecord[];
  }) => void;
  getDeliveryNoteById: (id: string) => DeliveryNoteRecord | undefined;
  getByProjectId: (projectId: string) => DeliveryNoteRecord[];
  getItems: (deliveryNoteId: string) => DeliveryNoteItemRecord[];
  getListItems: () => DeliveryNoteListItem[];
  createDeliveryNote: (input: DeliveryNoteInput) => DeliveryNoteRecord;
  updateDeliveryNote: (
    deliveryNoteId: string,
    input: DeliveryNoteInput
  ) => DeliveryNoteRecord | null;
  upsertDeliveryNote: (
    note: DeliveryNoteRecord,
    items: DeliveryNoteItemRecord[]
  ) => void;
};

export const useDeliveryNoteStore = create<DeliveryNoteStore>((set, get) => ({
  deliveryNotes: [],
  deliveryNoteItems: [],

  hydrate: ({ deliveryNotes, deliveryNoteItems }) =>
    set({ deliveryNotes, deliveryNoteItems }),

  getDeliveryNoteById: (id) => get().deliveryNotes.find((d) => d.id === id),

  getByProjectId: (projectId) =>
    get().deliveryNotes.filter((d) => d.projectId === projectId),

  getItems: (deliveryNoteId) =>
    get()
      .deliveryNoteItems.filter((i) => i.deliveryNoteId === deliveryNoteId)
      .sort((a, b) => a.sortOrder - b.sortOrder),

  getListItems: () => {
    const projects = useProjectStore.getState().projects;
    const customers = useCustomerStore.getState().customers;
    return get().deliveryNotes.map((d) => ({
      ...d,
      projectName:
        projects.find((p) => p.id === d.projectId)?.projectName ??
        "（不明な案件）",
      customerName:
        customers.find((c) => c.id === d.customerId)?.customerName ??
        "（不明な顧客）",
    }));
  },

  createDeliveryNote: (input) => {
    const now = new Date().toISOString();
    const id = `dn_${Date.now().toString(36)}`;
    const items = buildCommercialItemRecords<DeliveryNoteItemRecord>(
      id,
      "deliveryNoteId",
      input.items,
      "dni_"
    );
    const header = buildCommercialHeader(input, input.items);
    const note: DeliveryNoteRecord = {
      id,
      orderId: input.orderId ?? "",
      deliveryNoteNumber: nextCommercialNumber(
        "DN",
        input.issueDate,
        get().deliveryNotes.map((d) => d.deliveryNoteNumber)
      ),
      status: "issued",
      createdAt: now,
      updatedAt: now,
      ...header,
    };
    set((s) => ({
      deliveryNotes: [note, ...s.deliveryNotes],
      deliveryNoteItems: [...items, ...s.deliveryNoteItems],
    }));
    return note;
  },

  updateDeliveryNote: (deliveryNoteId, input) => {
    const existing = get().getDeliveryNoteById(deliveryNoteId);
    if (!existing) return null;

    const now = new Date().toISOString();
    const items = buildCommercialItemRecords<DeliveryNoteItemRecord>(
      deliveryNoteId,
      "deliveryNoteId",
      input.items,
      "dni_"
    );
    const header = buildCommercialHeader(input, input.items);
    const updated: DeliveryNoteRecord = {
      ...existing,
      ...header,
      orderId: existing.orderId,
      updatedAt: now,
    };

    set((s) => ({
      deliveryNotes: s.deliveryNotes.map((d) =>
        d.id === deliveryNoteId ? updated : d
      ),
      deliveryNoteItems: [
        ...items,
        ...s.deliveryNoteItems.filter((i) => i.deliveryNoteId !== deliveryNoteId),
      ],
    }));
    return updated;
  },

  upsertDeliveryNote: (note, items) =>
    set((s) => {
      const exists = s.deliveryNotes.some((d) => d.id === note.id);
      return {
        deliveryNotes: exists
          ? s.deliveryNotes.map((d) => (d.id === note.id ? note : d))
          : [note, ...s.deliveryNotes],
        deliveryNoteItems: [
          ...items,
          ...s.deliveryNoteItems.filter((i) => i.deliveryNoteId !== note.id),
        ],
      };
    }),
}));
