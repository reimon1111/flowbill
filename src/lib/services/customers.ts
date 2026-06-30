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
import { useInvoiceStore } from "@/stores/invoice-store";
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
  if (isSupabaseConfigured()) {
    const customer = await dbInsertCustomer(input);
    useCustomerStore.getState().upsertCustomer(customer);
    return customer;
  }
  return useCustomerStore.getState().addCustomer(input);
}

export async function updateCustomer(
  id: string,
  input: CustomerInput
): Promise<Customer | null> {
  assertCanWriteBusinessData();
  if (isSupabaseConfigured()) {
    const customer = await dbUpdateCustomer(id, input);
    if (customer) useCustomerStore.getState().upsertCustomer(customer);
    return customer;
  }
  return useCustomerStore.getState().updateCustomer(id, input);
}

export async function deleteCustomer(id: string): Promise<boolean> {
  assertCanWriteBusinessData();
  if (isSupabaseConfigured()) {
    const ok = await dbDeleteCustomer(id);
    if (ok) useCustomerStore.getState().removeCustomer(id);
    return ok;
  }
  return useCustomerStore.getState().deleteCustomer(id);
}

export async function getCustomerProjects(
  customerId: string
): Promise<CustomerProjectSummary[]> {
  const customer = useCustomerStore.getState().getCustomerById(customerId);
  if (!customer) return [];

  const projects = await getProjectsByCustomerId(customerId);
  return projects.map((p) => ({
    id: p.id,
    projectName: p.projectName,
    status: p.status,
    amount: p.amount,
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
    .map((inv) => ({
      id: inv.id,
      invoiceNumber: inv.invoiceNumber,
      issueDate: inv.issueDate,
      amount: inv.totalAmount,
      status:
        inv.status === "paid"
          ? "paid"
          : inv.status === "overdue"
            ? "overdue"
            : "unpaid",
    }));
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
