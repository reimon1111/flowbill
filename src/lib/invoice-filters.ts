/** @deprecated src/lib/invoice-state.ts を使用してください */
export {
  isDeletedInvoice,
  isDeletedInvoice as isInvoiceDeleted,
  isCanceledInvoice,
  isCanceledInvoice as isInvoiceCancelled,
  isActiveInvoice,
  isActiveInvoice as isInvoiceActiveForProject,
  isBillableInvoice,
  isBillableInvoice as isInvoiceBillable,
  isInvoiceInDefaultList,
  filterVisibleInvoices,
  filterBillableInvoices,
  filterProjectInvoices,
  getActiveInvoicesForProject,
  getPrimaryProjectInvoice,
  hasActiveInvoiceForProject,
  isInvoiceInDefaultList as isInvoiceVisibleInLists,
} from "@/lib/invoice-state";
