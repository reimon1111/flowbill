"use client";

import { useParams, useRouter } from "next/navigation";
import { useMemo } from "react";
import { CommercialDocumentDetail } from "@/components/shared/commercial-document-detail";
import { PageContentLoader } from "@/components/shared/page-content-loader";
import { resolveRouteId } from "@/lib/route-params";
import { useCustomerStore } from "@/stores/customer-store";
import { useProjectStore } from "@/stores/project-store";
import { toCommercialDocView } from "@/lib/commercial-document";
import { deleteOrder } from "@/lib/services/commercial-documents";
import { useOrderStore } from "@/stores/order-store";

export function OrderDetailClient({ orderId: orderIdProp }: { orderId?: string }) {
  const params = useParams();
  const router = useRouter();
  const orderId = orderIdProp || resolveRouteId(params.id);

  useOrderStore((s) => s.orders);
  useOrderStore((s) => s.orderItems);

  const order = useOrderStore.getState().getOrderById(orderId);
  const items = useOrderStore.getState().getOrderItems(orderId);
  const project = useProjectStore.getState().getProjectById(order?.projectId ?? "");
  const customer = useCustomerStore
    .getState()
    .getCustomerById(order?.customerId ?? "");

  const ready = useMemo(
    () => Boolean(order && project && customer),
    [order, project, customer]
  );

  if (!orderId) {
    router.replace("/orders");
    return <PageContentLoader />;
  }

  if (!ready || !order || !project || !customer) {
    return <PageContentLoader />;
  }

  const isDeleted = Boolean(order.deletedAt);

  return (
    <CommercialDocumentDetail
      kind="order"
      documentNumber={order.orderNumber}
      issueDate={order.issueDate}
      paymentTerms={order.paymentTerms}
      totalAmount={order.totalAmount}
      projectName={project.projectName}
      constructionSite={project.constructionSite}
      customer={customer}
      items={items}
      document={toCommercialDocView(order.orderNumber, order)}
      recipientName={order.recipientName ?? ""}
      audit={order}
      activityTargetType="order"
      activityTargetId={order.id}
      backHref="/orders"
      projectId={project.id}
      editHref={isDeleted ? undefined : `/orders/${order.id}/edit`}
      isDeleted={isDeleted}
      deleteConfig={
        isDeleted
          ? undefined
          : {
              confirmDescription:
                "この注文書を削除しますか？この操作は一覧から非表示になります。",
              successToast: "注文書を削除しました",
              onDelete: async () => {
                const result = await deleteOrder(order.id);
                return result.ok ? { ok: true as const } : { ok: false as const };
              },
            }
      }
    />
  );
}
