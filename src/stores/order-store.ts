"use client";

import { create } from "zustand";
import type {
  OrderInput,
  OrderItemRecord,
  OrderListItem,
  OrderRecord,
} from "@/lib/commercial-document";
import {
  buildCommercialHeader,
  buildCommercialItemRecords,
  nextCommercialNumber,
} from "@/lib/create-commercial-store";
import { useCustomerStore } from "@/stores/customer-store";
import { useProjectStore } from "@/stores/project-store";
import {
  resolveProjectNameFromStore,
  UNKNOWN_CUSTOMER_LABEL,
} from "@/lib/project-display";

function isActiveDocument<T extends { deletedAt: string | null }>(doc: T): boolean {
  return !doc.deletedAt;
}

type OrderStore = {
  orders: OrderRecord[];
  orderItems: OrderItemRecord[];
  hydrate: (data: { orders: OrderRecord[]; orderItems: OrderItemRecord[] }) => void;
  getOrders: () => OrderRecord[];
  getOrderById: (id: string) => OrderRecord | undefined;
  getOrdersByProjectId: (projectId: string) => OrderRecord[];
  getOrderItems: (orderId: string) => OrderItemRecord[];
  getListItems: () => OrderListItem[];
  createOrder: (input: OrderInput) => OrderRecord;
  updateOrder: (orderId: string, input: OrderInput) => OrderRecord | null;
  softDeleteOrder: (orderId: string) => OrderRecord | null;
  removeOrder: (orderId: string) => void;
  upsertOrder: (order: OrderRecord, items: OrderItemRecord[]) => void;
};

export const useOrderStore = create<OrderStore>((set, get) => ({
  orders: [],
  orderItems: [],

  hydrate: ({ orders, orderItems }) => set({ orders, orderItems }),

  getOrders: () => get().orders.filter(isActiveDocument),

  getOrderById: (id) => get().orders.find((o) => o.id === id),

  getOrdersByProjectId: (projectId) =>
    get().orders.filter((o) => o.projectId === projectId && isActiveDocument(o)),

  getOrderItems: (orderId) =>
    get()
      .orderItems.filter((i) => i.orderId === orderId)
      .sort((a, b) => a.sortOrder - b.sortOrder),

  getListItems: () => {
    const projects = useProjectStore.getState().projects;
    const customers = useCustomerStore.getState().customers;
    return get()
      .orders.filter(isActiveDocument)
      .map((o) => ({
        ...o,
        projectName: resolveProjectNameFromStore(o.projectId, projects, {
          documentType: "order",
          documentId: o.id,
        }),
        customerName:
          customers.find((c) => c.id === o.customerId)?.customerName ??
          UNKNOWN_CUSTOMER_LABEL,
      }));
  },

  createOrder: (input) => {
    const now = new Date().toISOString();
    const orderId = `ord_${Date.now().toString(36)}`;
    const items = buildCommercialItemRecords<OrderItemRecord>(
      orderId,
      "orderId",
      input.items,
      "oi_"
    );
    const header = buildCommercialHeader(input, input.items);
    const { customerHonorific: _honorific, ...orderHeader } = header;
    void _honorific;
    const order: OrderRecord = {
      id: orderId,
      quoteId: input.quoteId ?? "",
      orderNumber: nextCommercialNumber(
        "OR",
        input.issueDate,
        get().orders.map((o) => o.orderNumber)
      ),
      status: "draft",
      recipientName: input.recipientName ?? "",
      deletedAt: null,
      createdBy: null,
      updatedBy: null,
      createdAt: now,
      updatedAt: now,
      ...orderHeader,
    };
    set((s) => ({
      orders: [order, ...s.orders],
      orderItems: [...items, ...s.orderItems],
    }));
    return order;
  },

  updateOrder: (orderId, input) => {
    const existing = get().getOrderById(orderId);
    if (!existing) return null;

    const now = new Date().toISOString();
    const items = buildCommercialItemRecords<OrderItemRecord>(
      orderId,
      "orderId",
      input.items,
      "oi_"
    );
    const header = buildCommercialHeader(input, input.items);
    const { customerHonorific: _honorific, ...orderHeader } = header;
    void _honorific;
    const updated: OrderRecord = {
      ...existing,
      ...orderHeader,
      quoteId: existing.quoteId,
      recipientName: input.recipientName ?? existing.recipientName ?? "",
      updatedAt: now,
    };

    set((s) => ({
      orders: s.orders.map((o) => (o.id === orderId ? updated : o)),
      orderItems: [
        ...items,
        ...s.orderItems.filter((i) => i.orderId !== orderId),
      ],
    }));
    return updated;
  },

  softDeleteOrder: (orderId) => {
    const existing = get().getOrderById(orderId);
    if (!existing || existing.deletedAt) return null;

    const now = new Date().toISOString();
    const updated: OrderRecord = {
      ...existing,
      deletedAt: now,
      updatedAt: now,
    };

    set((s) => ({
      orders: s.orders.map((o) => (o.id === orderId ? updated : o)),
    }));
    return updated;
  },

  removeOrder: (orderId) =>
    set((s) => ({
      orders: s.orders.filter((o) => o.id !== orderId),
      orderItems: s.orderItems.filter((i) => i.orderId !== orderId),
    })),

  upsertOrder: (order, items) =>
    set((s) => {
      const exists = s.orders.some((o) => o.id === order.id);
      return {
        orders: exists
          ? s.orders.map((o) => (o.id === order.id ? order : o))
          : [order, ...s.orders],
        orderItems: [
          ...items,
          ...s.orderItems.filter((i) => i.orderId !== order.id),
        ],
      };
    }),
}));
