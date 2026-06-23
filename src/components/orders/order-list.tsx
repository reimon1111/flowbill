"use client";

import { useOrderStore } from "@/stores/order-store";
import { CommercialDocumentList } from "@/components/shared/commercial-document-list";

export function OrderList() {
  useOrderStore((s) => s.orders);
  const items = useOrderStore.getState().getListItems();

  return (
    <CommercialDocumentList
      kind="order"
      items={items.map((o) => ({
        id: o.id,
        documentNumber: o.orderNumber,
        projectName: o.projectName,
        customerName: o.customerName,
        issueDate: o.issueDate,
        createdAt: o.createdAt,
        totalAmount: o.totalAmount,
      }))}
      emptyTitle="まだ注文書がありません"
      emptyDescription="案件詳細から「注文書を作成」で作成できます"
    />
  );
}
