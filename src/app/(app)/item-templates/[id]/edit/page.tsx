"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { ItemTemplateForm } from "@/components/item-templates/item-template-form";
import { PageHeader } from "@/components/shared/page-header";
import { AuditTrailPanel } from "@/components/shared/audit-trail-panel";
import { WriteAccessGate } from "@/components/auth/write-access-gate";
import {
  getItemTemplateById,
  itemTemplateInputFromForm,
  updateItemTemplate,
} from "@/lib/services/item-templates";
import type { ItemTemplateFormValues } from "@/lib/validations/item-template";
import type { ItemTemplate } from "@/lib/types";
import { useItemTemplateStore } from "@/stores/item-template-store";
import {
  formatSupabaseError,
  ITEM_TEMPLATE_SAVE_FAILED_MESSAGE,
} from "@/lib/db/errors";

export default function EditItemTemplatePage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const itemTemplates = useItemTemplateStore((s) => s.itemTemplates);

  const [defaultValues, setDefaultValues] = useState<
    ItemTemplateFormValues | undefined
  >();
  const [template, setTemplate] = useState<ItemTemplate | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const loaded = await getItemTemplateById(id);
      if (!loaded) {
        router.replace("/item-templates");
        return;
      }
      setTemplate(loaded);
      setDefaultValues({
        name: loaded.name,
        unitPrice: loaded.unitPrice,
        taxRate: loaded.taxRate,
        isFavorite: loaded.isFavorite,
      });
      setLoading(false);
    }
    load();
  }, [id, itemTemplates, router]);

  const handleSubmit = async (values: ItemTemplateFormValues) => {
    try {
      const updated = await updateItemTemplate(
        id,
        itemTemplateInputFromForm(values)
      );
      if (!updated) {
        toast.error(ITEM_TEMPLATE_SAVE_FAILED_MESSAGE);
        return;
      }
      toast.success("テンプレを更新しました", {
        description: "見積作成時にこの項目をすぐ呼び出せます",
      });
      router.push("/item-templates");
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("updateItemTemplate", {
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

  if (loading || !defaultValues) {
    return (
      <WriteAccessGate>
        <div className="flex min-h-[40vh] items-center justify-center">
          <p className="text-zinc-500">読み込み中...</p>
        </div>
      </WriteAccessGate>
    );
  }

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

      <PageHeader title="テンプレを編集" description={defaultValues.name} />

      {template ? <AuditTrailPanel audit={template} className="mb-2" /> : null}

      <ItemTemplateForm
        key={id}
        defaultValues={defaultValues}
        onSubmit={handleSubmit}
        submitLabel="変更を保存"
      />
      </div>
    </WriteAccessGate>
  );
}
