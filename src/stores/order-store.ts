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
  removeOrder: (orderId: string) => void;
  upsertOrder: (order: OrderRecord, items: OrderItemRecord[]) => void;
};

export const useOrderStore = create<OrderStore>((set, get) => ({
  orders: [],
  orderItems: [],

  hydrate: ({ orders, orderItems }) => set({ orders, orderItems }),

  getOrders: () => get().orders,

  getOrderById: (id) => get().orders.find((o) => o.id === id),

  getOrdersByProjectId: (projectId) =>
    get().orders.filter((o) => o.projectId === projectId),

  getOrderItems: (orderId) =>
    get()
      .orderItems.filter((i) => i.orderId === orderId)
      .sort((a, b) => a.sortOrder - b.sortOrder),

  getListItems: () => {
    const projects = useProjectStore.getState().projects;
    const customers = useCustomerStore.getState().customers;
    return get().orders.map((o) => ({
      ...o,
      projectName:
        projects.find((p) => p.id === o.projectId)?.projectName ??
        "（不明な案件）",
      customerName:
        customers.find((c) => c.id === o.customerId)?.customerName ??
        "（不明な顧客）",
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
    const order: OrderRecord = {
      id: orderId,
      quoteId: input.quoteId ?? "",
      orderNumber: nextCommercialNumber(
        "OR",
        input.issueDate,
        get().orders.map((o) => o.orderNumber)
      ),
      status: "issued",
      recipientName: input.recipientName ?? "",
      createdAt: now,
      updatedAt: now,
      ...header,
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
    const updated: OrderRecord = {
      ...existing,
      ...header,
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
