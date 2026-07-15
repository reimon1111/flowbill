"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { ProjectForm } from "@/components/projects/project-form";
import { createProject, projectInputFromForm, syncCustomerProjectCounts } from "@/lib/services/projects";
import type { ProjectFormValues } from "@/lib/validations/project";
import { useCustomerStore } from "@/stores/customer-store";
import { useItemTemplateStore } from "@/stores/item-template-store";
import { useQuoteStore } from "@/stores/quote-store";
import { formatSupabaseError } from "@/lib/db/errors";

export function NewProjectClient({ initialCustomerId }: { initialCustomerId?: string }) {
  const router = useRouter();
  const customers = useCustomerStore((s) => s.customers);
  const itemTemplates = useItemTemplateStore((s) => s.itemTemplates);

  const handleSubmit = async (values: ProjectFormValues) => {
    let result;
    try {
      result = await createProject(projectInputFromForm(values));
    } catch (error) {
      toast.error("案件の保存に失敗しました", {
        description: formatSupabaseError(error),
      });
      return;
    }

    const { project, quoteDraftFailed } = result;
    syncCustomerProjectCounts();

    if (quoteDraftFailed) {
      toast.error("見積下書きの作成に失敗しました", {
        description: "案件詳細から見積を手動で作成できます",
      });
    }

    const hasDraftQuote =
      !quoteDraftFailed &&
      useQuoteStore.getState().getQuotesByProjectId(project.id).length > 0;

    toast.success("案件を作成しました", {
      description: hasDraftQuote
        ? "見積の下書きも作成しました"
        : quoteDraftFailed
          ? "見積は案件詳細から作成してください"
          : "次にやることが一覧に表示されます",
    });
    router.push(`/projects/${project.id}`);
  };

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-8 pb-24 sm:px-6 lg:px-8 lg:py-10">
      <Link
        href="/projects"
        className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900"
      >
        <ArrowLeft className="size-4" />
        案件一覧に戻る
      </Link>

      <PageHeader
        title="案件を作成"
        description="顧客を選ぶだけで、今後の見積・請求がスムーズになります"
      />

      <ProjectForm
        customers={customers}
        itemTemplates={itemTemplates}
        defaultValues={{ customerId: initialCustomerId ?? "" }}
        onSubmit={handleSubmit}
        submitLabel="作成する"
      />
    </div>
  );
}
