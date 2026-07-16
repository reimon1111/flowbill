"use client";

import { useEffect, useMemo } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { PageContentLoader } from "@/components/shared/page-content-loader";
import { ProjectForm } from "@/components/projects/project-form";
import {
  projectInputFromForm,
  syncCustomerProjectCounts,
  updateProject,
} from "@/lib/services/projects";
import type { ProjectFormValues } from "@/lib/validations/project";
import { useCustomerStore } from "@/stores/customer-store";
import { useItemTemplateStore } from "@/stores/item-template-store";
import { useProjectStore } from "@/stores/project-store";
import { useProjectItemStore } from "@/stores/project-item-store";
import { useAppDataStore } from "@/stores/app-data-store";
import { resolveRouteId } from "@/lib/route-params";
import { getProjectTitleHeadline } from "@/lib/project-title";
import { formatSupabaseError } from "@/lib/db/errors";

export function EditProjectClient() {
  const router = useRouter();
  const params = useParams();
  const projectId = resolveRouteId(params.id);
  const hasInitialized = useAppDataStore((s) => s.hasInitialized);
  const customers = useCustomerStore((s) => s.customers);
  const itemTemplates = useItemTemplateStore((s) => s.itemTemplates);
  const project = useProjectStore((s) =>
    projectId ? s.getProjectById(projectId) : undefined
  );
  const allProjectItems = useProjectItemStore((s) => s.projectItems);

  const projectItemsForProject = useMemo(
    () =>
      projectId
        ? allProjectItems.filter((i) => i.projectId === projectId)
        : [],
    [allProjectItems, projectId]
  );

  const defaultValues = useMemo((): ProjectFormValues | undefined => {
    if (!project) return undefined;
    const items = [...projectItemsForProject]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((it) => ({
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
      }));

    return {
      customerId: project.customerId,
      projectName: project.projectName,
      constructionSite: project.constructionSite ?? "",
      status: project.status,
      amount: project.amount,
      discountLabel: project.discountLabel ?? "",
      discountAmount: project.discountAmount ?? 0,
      customerHonorific: project.customerHonorific ?? "御中",
      customerContactName: project.customerContactName ?? "",
      customerDepartment: project.customerDepartment ?? "",
      customerPosition: project.customerPosition ?? "",
      dueDate: project.dueDate,
      startDate: project.startDate ?? "",
      endDate: project.endDate ?? "",
      assigneeName: project.assigneeName ?? "",
      memo: project.memo,
      items,
    };
  }, [project, projectItemsForProject]);

  useEffect(() => {
    if (!hasInitialized || !projectId) return;
    if (!project) {
      router.replace("/projects");
    }
  }, [hasInitialized, project, projectId, router]);

  const handleSubmit = async (values: ProjectFormValues) => {
    if (!projectId) return;
    let updated;
    try {
      updated = await updateProject(projectId, projectInputFromForm(values));
    } catch (error) {
      toast.error("案件の保存に失敗しました", {
        description: formatSupabaseError(error),
      });
      return;
    }
    if (!updated) return;
    syncCustomerProjectCounts();
    toast.success("案件情報を更新しました");
    router.push(`/projects/${projectId}`);
  };

  if (!projectId) {
    return null;
  }

  if (!hasInitialized || !defaultValues) {
    return <PageContentLoader />;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-8 pb-24 sm:px-6 lg:px-8 lg:py-10">
      <Link
        href={`/projects/${projectId}`}
        className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900"
      >
        <ArrowLeft className="size-4" />
        案件詳細に戻る
      </Link>

      <PageHeader
        title="案件を編集"
        description={getProjectTitleHeadline(defaultValues.projectName)}
      />

      <ProjectForm
        customers={customers}
        itemTemplates={itemTemplates}
        projectId={projectId}
        defaultValues={defaultValues}
        onSubmit={handleSubmit}
        submitLabel="保存する"
      />
    </div>
  );
}
