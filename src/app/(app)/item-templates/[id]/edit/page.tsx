"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { ItemTemplateForm } from "@/components/item-templates/item-template-form";
import { PageHeader } from "@/components/shared/page-header";
import {
  getItemTemplateById,
  itemTemplateInputFromForm,
  updateItemTemplate,
} from "@/lib/services/item-templates";
import type { ItemTemplateFormValues } from "@/lib/validations/item-template";
import { useItemTemplateStore } from "@/stores/item-template-store";

export default function EditItemTemplatePage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const itemTemplates = useItemTemplateStore((s) => s.itemTemplates);

  const [defaultValues, setDefaultValues] = useState<
    ItemTemplateFormValues | undefined
  >();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const template = await getItemTemplateById(id);
      if (!template) {
        router.replace("/item-templates");
        return;
      }
      setDefaultValues({
        name: template.name,
        category: template.category,
        description: template.description,
        unitPrice: template.unitPrice,
        taxRate: template.taxRate,
        isFavorite: template.isFavorite,
      });
      setLoading(false);
    }
    load();
  }, [id, itemTemplates, router]);

  const handleSubmit = async (values: ItemTemplateFormValues) => {
    const updated = await updateItemTemplate(
      id,
      itemTemplateInputFromForm(values)
    );
    if (!updated) return;
    toast.success("テンプレを更新しました", {
      description: "見積作成時にこの項目をすぐ呼び出せます",
    });
    router.push("/item-templates");
  };

  if (loading || !defaultValues) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-zinc-500">読み込み中...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-8 py-10 pb-24">
      <Link
        href="/item-templates"
        className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900"
      >
        <ArrowLeft className="size-4" />
        テンプレ一覧に戻る
      </Link>

      <PageHeader title="テンプレを編集" description={defaultValues.name} />

      <ItemTemplateForm
        key={id}
        defaultValues={defaultValues}
        onSubmit={handleSubmit}
        submitLabel="変更を保存"
      />
    </div>
  );
}
