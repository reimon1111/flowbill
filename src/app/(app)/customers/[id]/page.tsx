"use client";

import { useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { CustomerDetail } from "@/components/customers/customer-detail";
import { PageContentLoader } from "@/components/shared/page-content-loader";
import { useAppDataStore } from "@/stores/app-data-store";
import { useCustomerStore } from "@/stores/customer-store";
import { useProjectStore } from "@/stores/project-store";
import { useInvoiceStore } from "@/stores/invoice-store";
import type { CustomerInvoiceSummary, CustomerProjectSummary } from "@/lib/types";
import { getInvoicePaymentStatus } from "@/lib/invoice-state";
import { useProjectItemStore } from "@/stores/project-item-store";
import { getProjectTotalWithTax } from "@/lib/project-amount-display";

export default function CustomerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const hasInitialized = useAppDataStore((s) => s.hasInitialized);

  const customer = useCustomerStore((s) => s.getCustomerById(id));
  const projectsRaw = useProjectStore((s) => s.projects);
  const projectItemsRaw = useProjectItemStore((s) => s.projectItems);
  const invoicesRaw = useInvoiceStore((s) => s.invoices);

  const projects = useMemo((): CustomerProjectSummary[] => {
    void projectsRaw;
    void projectItemsRaw;
    const projectItems = useProjectItemStore.getState().projectItems;
    return useProjectStore
      .getState()
      .getListItems()
      .filter((p) => p.customerId === id && !p.archived)
      .map((p) => ({
        id: p.id,
        projectName: p.projectName,
        status: p.status,
        amount: getProjectTotalWithTax(p.id, p.amount, projectItems, p),
      }));
  }, [id, projectsRaw, projectItemsRaw]);

  const invoices = useMemo((): CustomerInvoiceSummary[] => {
    void invoicesRaw;
    return useInvoiceStore
      .getState()
      .getListItems()
      .filter((inv) => inv.customerId === id)
      .map((inv) => {
        const paymentStatus = getInvoicePaymentStatus(inv);
        const status =
          paymentStatus === "paid"
            ? "paid"
            : paymentStatus === "overdue"
              ? "overdue"
              : "unpaid";
        return {
          id: inv.id,
          invoiceNumber: inv.invoiceNumber,
          issueDate: inv.issueDate,
          amount: inv.totalAmount,
          status,
        };
      });
  }, [id, invoicesRaw]);

  useEffect(() => {
    if (!hasInitialized) return;
    if (!customer) {
      router.replace("/customers");
    }
  }, [hasInitialized, customer, router]);

  if (!hasInitialized) {
    return <PageContentLoader />;
  }

  if (!customer) {
    return <PageContentLoader label="顧客を確認しています..." />;
  }

  return (
    <CustomerDetail
      customer={customer}
      projects={projects}
      invoices={invoices}
    />
  );
}
