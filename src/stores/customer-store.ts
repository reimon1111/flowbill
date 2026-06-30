import { create } from "zustand";
import type { Customer, CustomerInput } from "@/lib/types";
import {
  customerListMeta,
  initialCustomers,
} from "@/lib/mock-customers";
import { initialStoreData } from "@/lib/stores/store-initial";

function generateId(): string {
  return `c${Date.now().toString(36)}`;
}

type CustomerStore = {
  customers: Customer[];
  hydrate: (customers: Customer[]) => void;
  upsertCustomer: (customer: Customer) => void;
  removeCustomer: (id: string) => void;
  addCustomer: (input: CustomerInput) => Customer;
  updateCustomer: (id: string, input: CustomerInput) => Customer | null;
  deleteCustomer: (id: string) => boolean;
  getCustomerById: (id: string) => Customer | undefined;
};

export const useCustomerStore = create<CustomerStore>((set, get) => ({
  customers: initialStoreData(initialCustomers, []),

  hydrate: (customers) => set({ customers }),

  upsertCustomer: (customer) =>
    set((state) => {
      const exists = state.customers.some((c) => c.id === customer.id);
      if (exists) {
        return {
          customers: state.customers.map((c) =>
            c.id === customer.id ? customer : c
          ),
        };
      }
      return { customers: [customer, ...state.customers] };
    }),

  removeCustomer: (id) =>
    set((state) => ({
      customers: state.customers.filter((c) => c.id !== id),
    })),

  addCustomer: (input) => {
    const now = new Date().toISOString();
    const customer: Customer = {
      id: generateId(),
      ...input,
      createdBy: null,
      updatedBy: null,
      createdAt: now,
      updatedAt: now,
    };
    set((state) => ({ customers: [customer, ...state.customers] }));
    customerListMeta[customer.id] = {
      activeProjectCount: 0,
      unpaidAmount: 0,
    };
    return customer;
  },

  updateCustomer: (id, input) => {
    let updated: Customer | null = null;
    set((state) => ({
      customers: state.customers.map((c) => {
        if (c.id !== id) return c;
        updated = {
          ...c,
          ...input,
          updatedAt: new Date().toISOString(),
        };
        return updated;
      }),
    }));
    return updated;
  },

  deleteCustomer: (id) => {
    const exists = get().customers.some((c) => c.id === id);
    if (!exists) return false;
    set((state) => ({
      customers: state.customers.filter((c) => c.id !== id),
    }));
    delete customerListMeta[id];
    return true;
  },

  getCustomerById: (id) => get().customers.find((c) => c.id === id),
}));

export function getCustomerListMeta(customerId: string) {
  return (
    customerListMeta[customerId] ?? {
      activeProjectCount: 0,
      unpaidAmount: 0,
    }
  );
}
