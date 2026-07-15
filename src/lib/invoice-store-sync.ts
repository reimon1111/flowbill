import type { InvoiceRecord } from "@/lib/types";
import { resolveProjectFieldsAfterInvoiceChange } from "@/lib/invoice-state";
import { useInvoiceStore } from "@/stores/invoice-store";
import { useProjectStore } from "@/stores/project-store";

/** 請求書ステータス変更後に invoice / project store を即時同期 */
export function syncStoresAfterInvoiceChange(updatedInvoice: InvoiceRecord): void {
  useInvoiceStore.setState((state) => ({
    invoices: state.invoices.some((inv) => inv.id === updatedInvoice.id)
      ? state.invoices.map((inv) =>
          inv.id === updatedInvoice.id ? updatedInvoice : inv
        )
      : [updatedInvoice, ...state.invoices],
  }));

  const derived = resolveProjectFieldsAfterInvoiceChange(
    updatedInvoice.projectId,
    useInvoiceStore.getState().invoices
  );

  const proj = useProjectStore.getState().getProjectById(updatedInvoice.projectId);
  if (!proj) return;

  useProjectStore.getState().upsertProject({
    ...proj,
    ...derived,
    ...(updatedInvoice.status === "paid" || updatedInvoice.status === "issued"
      ? { status: "completed" as const }
      : {}),
    updatedAt: new Date().toISOString(),
  });
}
