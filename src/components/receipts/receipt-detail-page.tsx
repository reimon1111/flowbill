"use client";

import { useParams, useRouter } from "next/navigation";
import { useMemo } from "react";
import { CommercialDocumentDetail } from "@/components/shared/commercial-document-detail";
import { PageContentLoader } from "@/components/shared/page-content-loader";
import { resolveRouteId } from "@/lib/route-params";
import { useCustomerStore } from "@/stores/customer-store";
import { useProjectStore } from "@/stores/project-store";
import { toCommercialDocView } from "@/lib/commercial-document";
import { useReceiptStore } from "@/stores/receipt-store";

export function ReceiptDetailClient({ receiptId: idProp }: { receiptId?: string }) {
  const params = useParams();
  const router = useRouter();
  const id = idProp || resolveRouteId(params.id);

  useReceiptStore((s) => s.receipts);
  useReceiptStore((s) => s.receiptItems);

  const receipt = useReceiptStore.getState().getReceiptById(id);
  const items = useReceiptStore.getState().getItems(id);
  const project = useProjectStore.getState().getProjectById(receipt?.projectId ?? "");
  const customer = useCustomerStore
    .getState()
    .getCustomerById(receipt?.customerId ?? "");

  const ready = useMemo(
    () => Boolean(receipt && project && customer),
    [receipt, project, customer]
  );

  if (!id) {
    router.replace("/receipts");
    return <PageContentLoader />;
  }

  if (!ready || !receipt || !project || !customer) {
    return <PageContentLoader />;
  }

  return (
    <CommercialDocumentDetail
      kind="receipt"
      documentNumber={receipt.receiptNumber}
      issueDate={receipt.issueDate}
      paymentTerms={receipt.paymentTerms}
      totalAmount={receipt.totalAmount}
      projectName={project.projectName}
      constructionSite={project.constructionSite}
      customer={customer}
      items={items}
      document={toCommercialDocView(receipt.receiptNumber, receipt)}
      backHref="/receipts"
      editHref={`/receipts/${receipt.id}/edit`}
    />
  );
}
