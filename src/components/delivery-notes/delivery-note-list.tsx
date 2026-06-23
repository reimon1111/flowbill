"use client";

import { useDeliveryNoteStore } from "@/stores/delivery-note-store";
import { CommercialDocumentList } from "@/components/shared/commercial-document-list";

export function DeliveryNoteList() {
  useDeliveryNoteStore((s) => s.deliveryNotes);
  const items = useDeliveryNoteStore.getState().getListItems();

  return (
    <CommercialDocumentList
      kind="delivery_note"
      items={items.map((d) => ({
        id: d.id,
        documentNumber: d.deliveryNoteNumber,
        projectName: d.projectName,
        customerName: d.customerName,
        issueDate: d.issueDate,
        createdAt: d.createdAt,
        totalAmount: d.totalAmount,
      }))}
      emptyTitle="まだ納品書がありません"
      emptyDescription="案件詳細から「納品書を作成」で作成できます"
    />
  );
}
