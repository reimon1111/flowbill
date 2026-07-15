"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { ItemTemplateForm } from "@/components/item-templates/item-template-form";
import { WriteAccessGate } from "@/components/auth/write-access-gate";
import { PageHeader } from "@/components/shared/page-header";
import {
  createItemTemplate,
  itemTemplateInputFromForm,
} from "@/lib/services/item-templates";
import type { ItemTemplateFormValues } from "@/lib/validations/item-template";
import { formatSupabaseError, ITEM_TEMPLATE_SAVE_FAILED_MESSAGE } from "@/lib/db/errors";

export default function NewItemTemplatePage() {
  const router = useRouter();

  const handleSubmit = async (values: ItemTemplateFormValues) => {
    try {
      await createItemTemplate(itemTemplateInputFromForm(values));
      toast.success("請求項目テンプレを登録しました", {
        description: "見積作成時にこの項目をすぐ呼び出せます",
      });
      router.push("/item-templates");
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("createItemTemplate", {
          message: error instanceof Error ? error.message : error,
          error,
          payload: itemTemplateInputFromForm(values),
        });
      }
      toast.error(
        error instanceof Error && error.message !== ITEM_TEMPLATE_SAVE_FAILED_MESSAGE
          ? error.message
          : ITEM_TEMPLATE_SAVE_FAILED_MESSAGE,
        {
          description:
            process.env.NODE_ENV === "development"
              ? formatSupabaseError(error)
              : undefined,
        }
      );
    }
  };

  return (
    <WriteAccessGate>
      <div className="mx-auto max-w-3xl space-y-8 px-4 py-8 pb-24 sm:px-6 lg:px-8 lg:py-10">
        <Link
          href="/item-templates"
          className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900"
        >
          <ArrowLeft className="size-4" />
          テンプレ一覧に戻る
        </Link>

        <PageHeader
          title="請求項目テンプレを登録"
          description="見積・請求の明細をワンクリックで追加できるようにします"
        />

        <ItemTemplateForm onSubmit={handleSubmit} submitLabel="登録する" />
      </div>
    </WriteAccessGate>
  );
}
