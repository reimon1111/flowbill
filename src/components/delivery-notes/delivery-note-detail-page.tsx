"use client";

import { useParams, useRouter } from "next/navigation";
import { useMemo } from "react";
import { CommercialDocumentDetail } from "@/components/shared/commercial-document-detail";
import { PageContentLoader } from "@/components/shared/page-content-loader";
import { resolveRouteId } from "@/lib/route-params";
import { useCustomerStore } from "@/stores/customer-store";
import { useProjectStore } from "@/stores/project-store";
import { toCommercialDocView } from "@/lib/commercial-document";
import { deleteDeliveryNote } from "@/lib/services/commercial-documents";
import { useDeliveryNoteStore } from "@/stores/delivery-note-store";

export function DeliveryNoteDetailClient({
  deliveryNoteId: idProp,
}: {
  deliveryNoteId?: string;
}) {
  const params = useParams();
  const router = useRouter();
  const id = idProp || resolveRouteId(params.id);

  useDeliveryNoteStore((s) => s.deliveryNotes);
  useDeliveryNoteStore((s) => s.deliveryNoteItems);

  const note = useDeliveryNoteStore.getState().getDeliveryNoteById(id);
  const items = useDeliveryNoteStore.getState().getItems(id);
  const project = useProjectStore.getState().getProjectById(note?.projectId ?? "");
  const customer = useCustomerStore
    .getState()
    .getCustomerById(note?.customerId ?? "");

  const ready = useMemo(
    () => Boolean(note && project && customer),
    [note, project, customer]
  );

  if (!id) {
    router.replace("/delivery-notes");
    return <PageContentLoader />;
  }

  if (!ready || !note || !project || !customer) {
    return <PageContentLoader />;
  }

  const isDeleted = Boolean(note.deletedAt);

  return (
    <CommercialDocumentDetail
      kind="delivery_note"
      documentNumber={note.deliveryNoteNumber}
      issueDate={note.issueDate}
      paymentTerms={note.paymentTerms}
      totalAmount={note.totalAmount}
      projectName={project.projectName}
      constructionSite={project.constructionSite}
      customer={customer}
      items={items}
      document={toCommercialDocView(note.deliveryNoteNumber, note)}
      audit={note}
      activityTargetType="delivery_note"
      activityTargetId={note.id}
      backHref="/delivery-notes"
      projectId={project.id}
      editHref={isDeleted ? undefined : `/delivery-notes/${note.id}/edit`}
      isDeleted={isDeleted}
      deleteConfig={
        isDeleted
          ? undefined
          : {
              confirmDescription:
                "この納品書を削除しますか？この操作は一覧から非表示になります。",
              successToast: "納品書を削除しました",
              onDelete: async () => {
                const result = await deleteDeliveryNote(note.id);
                return result.ok ? { ok: true as const } : { ok: false as const };
              },
            }
      }
    />
  );
}
