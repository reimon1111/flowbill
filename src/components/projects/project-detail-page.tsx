"use client";

import { useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { ProjectDetail } from "@/components/projects/project-detail";
import { PageContentLoader } from "@/components/shared/page-content-loader";
import { useAppDataStore } from "@/stores/app-data-store";
import { useProjectStore } from "@/stores/project-store";
import { useCustomerStore } from "@/stores/customer-store";
import { getNextAction } from "@/lib/project-utils";
import type { ProjectListItem } from "@/lib/types";
import { resolveRouteId } from "@/lib/route-params";

export function ProjectDetailClient() {
  const router = useRouter();
  const params = useParams();
  const projectId = resolveRouteId(params.id);
  const hasInitialized = useAppDataStore((s) => s.hasInitialized);

  const projectRecord = useProjectStore((s) =>
    projectId ? s.projects.find((p) => p.id === projectId) : undefined
  );

  const customerName = useCustomerStore((s) => {
    if (!projectRecord) return undefined;
    return s.getCustomerById(projectRecord.customerId)?.customerName;
  });

  const allHistories = useProjectStore((s) => s.histories);

  const project = useMemo((): ProjectListItem | undefined => {
    if (!projectRecord) return undefined;
    return {
      ...projectRecord,
      customerName: customerName ?? "（削除された顧客）",
      nextAction: getNextAction({
        status: projectRecord.status,
        invoiceStatus: projectRecord.invoiceStatus,
        paymentStatus: projectRecord.paymentStatus,
      }),
    };
  }, [projectRecord, customerName]);

  const sortedHistory = useMemo(
    () =>
      allHistories
        .filter((h) => h.projectId === projectId)
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        ),
    [allHistories, projectId]
  );

  useEffect(() => {
    if (!hasInitialized || !projectId) return;
    if (!project) {
      router.replace("/projects");
    }
  }, [hasInitialized, project, projectId, router]);

  if (!projectId) {
    return null;
  }

  if (!hasInitialized) {
    return <PageContentLoader />;
  }

  if (!project) {
    return <PageContentLoader label="案件を確認しています..." />;
  }

  return <ProjectDetail project={project} history={sortedHistory} />;
}
