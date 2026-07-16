"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { CommercialDocumentForm } from "@/components/shared/commercial-document-form";
import { PageContentLoader } from "@/components/shared/page-content-loader";
import { resolveRouteId } from "@/lib/route-params";
import type { DocumentKind } from "@/components/documents/document-labels";
import { getDocumentLabels } from "@/components/documents/document-labels";
import {
  commercialDocumentInputFromForm,
  getDeliveryNoteById,
  getDeliveryNoteItems,
  getOrderById,
  getOrderItems,
  getReceiptById,
  getReceiptItems,
  orderInputFromForm,
  updateDeliveryNote,
  updateOrder,
  updateReceipt,
} from "@/lib/services/commercial-documents";
import { useCustomerStore } from "@/stores/customer-store";
import { useProjectStore } from "@/stores/project-store";
import { useOrderStore } from "@/stores/order-store";
import { useDeliveryNoteStore } from "@/stores/delivery-note-store";
import { useReceiptStore } from "@/stores/receipt-store";
import type { CommercialDocumentFormValues, OrderDocumentFormValues } from "@/lib/validations/commercial-document";
import type { QuoteItemDraft } from "@/components/quotes/quote-items-editor";
import type {
  DeliveryNoteRecord,
  OrderRecord,
  ReceiptRecord,
} from "@/lib/commercial-document";
import type { Customer } from "@/lib/types";

const EDITABLE_KINDS = ["order", "delivery_note", "receipt"] as const;
type EditableKind = (typeof EDITABLE_KINDS)[number];

type EditPayload = {
  values: CommercialDocumentFormValues | OrderDocumentFormValues;
  items: QuoteItemDraft[];
  projectName: string;
  constructionSite: string;
  documentNumber: string;
  projectId: string;
  customer: Customer;
};

function getDocumentNumber(
  doc: OrderRecord | DeliveryNoteRecord | ReceiptRecord,
  kind: EditableKind
): string {
  switch (kind) {
    case "order":
      return (doc as OrderRecord).orderNumber;
    case "delivery_note":
      return (doc as DeliveryNoteRecord).deliveryNoteNumber;
    case "receipt":
      return (doc as ReceiptRecord).receiptNumber;
  }
}

function isEditableKind(kind: DocumentKind): kind is EditableKind {
  return EDITABLE_KINDS.includes(kind as EditableKind);
}

function basePathForKind(kind: EditableKind): string {
  switch (kind) {
    case "order":
      return "/orders";
    case "delivery_note":
      return "/delivery-notes";
    case "receipt":
      return "/receipts";
  }
}

function resolveEditPayload(
  kind: EditableKind,
  documentId: string
): EditPayload | null {
  const doc =
    kind === "order"
      ? getOrderById(documentId)
      : kind === "delivery_note"
        ? getDeliveryNoteById(documentId)
        : getReceiptById(documentId);

  if (!doc) return null;
  if (doc.deletedAt) return null;

  const docItems =
    kind === "order"
      ? getOrderItems(documentId)
      : kind === "delivery_note"
        ? getDeliveryNoteItems(documentId)
        : getReceiptItems(documentId);

  const project = useProjectStore.getState().getProjectById(doc.projectId);
  const customer = useCustomerStore.getState().getCustomerById(doc.customerId);
  if (!project || !customer) return null;

  return {
    projectName: project.projectName,
    constructionSite: project.constructionSite ?? "",
    documentNumber: getDocumentNumber(doc, kind),
    projectId: doc.projectId,
    customer,
    values:
      kind === "order"
        ? {
            projectId: doc.projectId,
            customerId: doc.customerId,
            issueDate: doc.issueDate,
            paymentTerms: doc.paymentTerms,
            memo: doc.memo,
            discountLabel: doc.discountLabel ?? "",
            discountAmount: doc.discountAmount ?? 0,
            customerContactName: doc.customerContactName ?? "",
            customerDepartment: doc.customerDepartment ?? "",
            customerPosition: doc.customerPosition ?? "",
            recipientName: (doc as OrderRecord).recipientName ?? "",
            items: [],
          }
        : {
            projectId: doc.projectId,
            customerId: doc.customerId,
            issueDate: doc.issueDate,
            paymentTerms: doc.paymentTerms,
            memo: doc.memo,
            discountLabel: doc.discountLabel ?? "",
            discountAmount: doc.discountAmount ?? 0,
            customerHonorific:
              "customerHonorific" in doc && doc.customerHonorific
                ? doc.customerHonorific
                : "御中",
            customerContactName: doc.customerContactName ?? "",
            customerDepartment: doc.customerDepartment ?? "",
            customerPosition: doc.customerPosition ?? "",
            items: [],
          },
    items: docItems.map((it) => ({
      itemTemplateId: it.itemTemplateId,
      name: it.name,
      description: it.description,
      width: it.width ?? "",
      height: it.height ?? "",
      quantity: it.quantity,
      unit: it.unit,
      unitPrice: it.unitPrice,
      taxRate: it.taxRate,
      sortOrder: it.sortOrder,
    })),
  };
}

export function CommercialDocumentEditClient({
  kind,
  documentId: documentIdProp,
}: {
  kind: EditableKind;
  documentId?: string;
}) {
  const router = useRouter();
  const params = useParams();
  const documentId = documentIdProp || resolveRouteId(params.id);
  const labels = getDocumentLabels(kind);

  useOrderStore((s) => s.orders);
  useOrderStore((s) => s.orderItems);
  useDeliveryNoteStore((s) => s.deliveryNotes);
  useDeliveryNoteStore((s) => s.deliveryNoteItems);
  useReceiptStore((s) => s.receipts);
  useReceiptStore((s) => s.receiptItems);
  useProjectStore((s) => s.projects);
  useCustomerStore((s) => s.customers);

  const invalidRoute = !documentId || !isEditableKind(kind);

  const editPayload =
    invalidRoute || !documentId ? null : resolveEditPayload(kind, documentId);

  useEffect(() => {
    if (invalidRoute) {
      router.replace(basePathForKind(kind));
      return;
    }
    if (editPayload === null) {
      router.replace(basePathForKind(kind));
    }
  }, [invalidRoute, editPayload, kind, router]);

  const handleSave = async (
    v: CommercialDocumentFormValues | OrderDocumentFormValues
  ) => {
    if (!editPayload || !documentId) return;

    const input =
      kind === "order"
        ? orderInputFromForm(v as OrderDocumentFormValues)
        : commercialDocumentInputFromForm(v as CommercialDocumentFormValues);
    const updated =
      kind === "order"
        ? await updateOrder(documentId, input)
        : kind === "delivery_note"
          ? await updateDeliveryNote(documentId, input)
          : await updateReceipt(documentId, input);

    if (!updated) return;
    toast.success(`${labels.title}を更新しました`, {
      description: editPayload.documentNumber,
    });
    router.push(`${basePathForKind(kind)}/${documentId}`);
  };

  if (invalidRoute || !editPayload) {
    return <PageContentLoader />;
  }

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 pb-24 sm:px-6 lg:px-8 lg:py-10">
      <Link
        href={`${basePathForKind(kind)}/${documentId}`}
        className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900"
      >
        <ArrowLeft className="size-4" />
        {labels.title}詳細に戻る
      </Link>

      <PageHeader
        title={`${labels.title}を編集`}
        description={`${editPayload.documentNumber} / ${editPayload.projectName}`}
      />

      <CommercialDocumentForm
        kind={kind}
        projectId={editPayload.projectId}
        customer={editPayload.customer}
        projectName={editPayload.projectName}
        constructionSite={editPayload.constructionSite}
        documentNumber={editPayload.documentNumber}
        defaultValues={editPayload.values}
        defaultItems={editPayload.items}
        onSubmit={handleSave}
        submitLabel="変更を保存"
      />
    </div>
  );
}
