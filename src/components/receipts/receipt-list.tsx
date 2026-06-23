"use client";

import { useReceiptStore } from "@/stores/receipt-store";
import { CommercialDocumentList } from "@/components/shared/commercial-document-list";

export function ReceiptList() {
  useReceiptStore((s) => s.receipts);
  const items = useReceiptStore.getState().getListItems();

  return (
    <CommercialDocumentList
      kind="receipt"
      items={items.map((r) => ({
        id: r.id,
        documentNumber: r.receiptNumber,
        projectName: r.projectName,
        customerName: r.customerName,
        issueDate: r.issueDate,
        createdAt: r.createdAt,
        totalAmount: r.totalAmount,
      }))}
      emptyTitle="まだ領収書がありません"
      emptyDescription="請求書作成後、案件詳細から「領収書を作成」で作成できます"
    />
  );
}
