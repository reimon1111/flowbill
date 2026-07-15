import type {
  Customer,
  CustomerInput,
  CustomerListItem,
  CustomerInvoiceSummary,
  CustomerProjectSummary,
} from "@/lib/types";
import type { CustomerFormValues } from "@/lib/validations/customer";
import {
  getCustomerListMeta,
  useCustomerStore,
} from "@/stores/customer-store";
import { getProjectsByCustomerId } from "@/lib/services/projects";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import {
  dbDeleteCustomer,
  dbInsertCustomer,
  dbUpdateCustomer,
} from "@/lib/db/write-customers";
import { logSupabaseError, toCustomerSaveError } from "@/lib/db/errors";
import { useInvoiceStore } from "@/stores/invoice-store";
import { getInvoicePaymentStatus } from "@/lib/invoice-state";
import { useProjectItemStore } from "@/stores/project-item-store";
import { getProjectTotalWithTax } from "@/lib/project-amount-display";
import { assertCanWriteBusinessData } from "@/lib/guards/write-access";

function toListItem(customer: Customer): CustomerListItem {
  const meta = getCustomerListMeta(customer.id);
  return {
    ...customer,
    activeProjectCount: meta.activeProjectCount,
    unpaidAmount: meta.unpaidAmount,
  };
}

export async function getCustomers(): Promise<CustomerListItem[]> {
  const customers = useCustomerStore.getState().customers;
  return customers.map(toListItem);
}

export async function getCustomerById(
  id: string
): Promise<Customer | null> {
  const customer = useCustomerStore.getState().getCustomerById(id);
  return customer ?? null;
}

export async function createCustomer(
  input: CustomerInput
): Promise<Customer> {
  assertCanWriteBusinessData();
  try {
    if (isSupabaseConfigured()) {
      const customer = await dbInsertCustomer(input);
      useCustomerStore.getState().upsertCustomer(customer);
      return customer;
    }
    return useCustomerStore.getState().addCustomer(input);
  } catch (error) {
    logSupabaseError("createCustomer", error);
    throw toCustomerSaveError(error);
  }
}

export async function updateCustomer(
  id: string,
  input: CustomerInput
): Promise<Customer | null> {
  assertCanWriteBusinessData();
  try {
    if (isSupabaseConfigured()) {
      const customer = await dbUpdateCustomer(id, input);
      if (customer) useCustomerStore.getState().upsertCustomer(customer);
      return customer;
    }
    return useCustomerStore.getState().updateCustomer(id, input);
  } catch (error) {
    logSupabaseError("updateCustomer", error);
    throw toCustomerSaveError(error);
  }
}

export async function deleteCustomer(id: string): Promise<boolean> {
  assertCanWriteBusinessData();
  try {
    if (isSupabaseConfigured()) {
      const ok = await dbDeleteCustomer(id);
      if (ok) useCustomerStore.getState().removeCustomer(id);
      return ok;
    }
    return useCustomerStore.getState().deleteCustomer(id);
  } catch (error) {
    logSupabaseError("deleteCustomer", error);
    throw toCustomerSaveError(error);
  }
}

export async function getCustomerProjects(
  customerId: string
): Promise<CustomerProjectSummary[]> {
  const customer = useCustomerStore.getState().getCustomerById(customerId);
  if (!customer) return [];

  const projects = await getProjectsByCustomerId(customerId);
  const projectItems = useProjectItemStore.getState().projectItems;
  return projects.map((p) => ({
    id: p.id,
    projectName: p.projectName,
    status: p.status,
    amount: getProjectTotalWithTax(p.id, p.amount, projectItems, p),
  }));
}

export async function getCustomerInvoices(
  customerId: string
): Promise<CustomerInvoiceSummary[]> {
  const customer = useCustomerStore.getState().getCustomerById(customerId);
  if (!customer) return [];

  return useInvoiceStore
    .getState()
    .getListItems()
    .filter((inv) => inv.customerId === customerId)
    .map((inv) => {
      const paymentStatus = getInvoicePaymentStatus(inv);
      const status =
        paymentStatus === "paid"
          ? "paid"
          : paymentStatus === "overdue"
            ? "overdue"
            : "unpaid";
      return {
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        issueDate: inv.issueDate,
        amount: inv.totalAmount,
        status,
      };
    });
}

export function customerInputFromForm(
  values: CustomerFormValues
): CustomerInput {
  return {
    customerName: values.customerName.trim(),
    contactName: values.contactName.trim(),
    email: values.email.trim(),
    phone: values.phone.trim(),
    fax: values.fax.trim(),
    postalCode: values.postalCode.trim(),
    address: values.address.trim(),
    invoiceDestination: values.invoiceDestination.trim(),
    memo: values.memo.trim(),
  };
}
