"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Star } from "lucide-react";
import { toast } from "sonner";
import { ItemTemplateCard } from "@/components/item-templates/item-template-card";
import { DeleteConfirmDialog } from "@/components/shared/delete-confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { SearchBar } from "@/components/shared/search-bar";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  deleteItemTemplate,
  toggleItemTemplateFavorite,
} from "@/lib/services/item-templates";
import type { ItemTemplate } from "@/lib/types";
import { useItemTemplateStore } from "@/stores/item-template-store";
import { useCanWriteBusinessData } from "@/hooks/use-can-write-business-data";
import { cn } from "@/lib/utils";

export function ItemTemplateList() {
  const canWrite = useCanWriteBusinessData();
  const itemTemplates = useItemTemplateStore((s) => s.itemTemplates);
  const [search, setSearch] = useState("");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ItemTemplate | null>(null);
  const [deleting, setDeleting] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return itemTemplates
      .filter((t) => {
        if (favoritesOnly && !t.isFavorite) return false;
        if (!q) return true;
        return t.name.toLowerCase().includes(q);
      })
      .sort((a, b) => {
        if (a.isFavorite !== b.isFavorite) return a.isFavorite ? -1 : 1;
        return (
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        );
      });
  }, [itemTemplates, search, favoritesOnly]);

  const favorites = filtered.filter((t) => t.isFavorite);
  const others = filtered.filter((t) => !t.isFavorite);
  const showSplit = !favoritesOnly && !search && favorites.length > 0;

  const handleToggleFavorite = async (template: ItemTemplate) => {
    try {
      await toggleItemTemplateFavorite(template.id);
      toast.success(
        template.isFavorite
          ? "お気に入りを解除しました"
          : "お気に入りに追加しました"
      );
    } catch {
      toast.error("操作に失敗しました");
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteItemTemplate(deleteTarget.id);
      toast.success("請求項目テンプレを削除しました");
      setDeleteTarget(null);
    } catch {
      toast.error("削除に失敗しました");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="mx-auto min-w-0 max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <PageHeader
        title="請求項目テンプレ"
        description={`${itemTemplates.length}件 — 見積作成時にワンクリックで明細を追加`}
        action={
          canWrite ? (
            <Link
              href="/item-templates/new"
              className={cn(
                buttonVariants({ size: "lg" }),
                "h-10 gap-2 rounded-xl bg-zinc-900 text-white hover:bg-zinc-800"
              )}
            >
              <Plus className="size-4" strokeWidth={1.5} />
              テンプレを追加
            </Link>
          ) : undefined
        }
      />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder="項目名で検索..."
          className="max-w-md flex-1"
        />
        <Button
          type="button"
          variant={favoritesOnly ? "default" : "outline"}
          className="h-10 rounded-xl"
          onClick={() => setFavoritesOnly((v) => !v)}
        >
          <Star
            className={cn(
              "size-4",
              favoritesOnly && "fill-amber-400 text-amber-400"
            )}
          />
          お気に入りのみ
        </Button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title={
            search || favoritesOnly
              ? "該当するテンプレが見つかりません"
              : "テンプレがまだ登録されていません"
          }
          description="よく使う項目を登録しておくと、見積作成が30秒で完了します"
          action={
            canWrite && !search && !favoritesOnly && (
              <Link
                href="/item-templates/new"
                className={cn(
                  buttonVariants(),
                  "rounded-xl bg-zinc-900 text-white hover:bg-zinc-800"
                )}
              >
                <Plus className="size-4" />
                最初のテンプレを登録
              </Link>
            )
          }
        />
      ) : showSplit ? (
        <div className="space-y-10">
          <TemplateSection
            title="よく使う項目"
            icon={<Star className="size-4 fill-amber-400 text-amber-400" />}
            items={favorites}
            onDelete={canWrite ? setDeleteTarget : () => {}}
            onToggleFavorite={canWrite ? handleToggleFavorite : () => {}}
            canWrite={canWrite}
          />
          {others.length > 0 && (
            <TemplateSection
              title="その他のテンプレ"
              items={others}
              onDelete={canWrite ? setDeleteTarget : () => {}}
              onToggleFavorite={canWrite ? handleToggleFavorite : () => {}}
              canWrite={canWrite}
            />
          )}
        </div>
      ) : (
        <TemplateSection
          title={favoritesOnly ? "お気に入り" : "すべて"}
          items={filtered}
          onDelete={canWrite ? setDeleteTarget : () => {}}
          onToggleFavorite={canWrite ? handleToggleFavorite : () => {}}
          canWrite={canWrite}
        />
      )}

      <DeleteConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="テンプレを削除しますか？"
        description={`「${deleteTarget?.name}」を削除します。過去の見積・請求には影響しません。`}
        onConfirm={handleDelete}
        loading={deleting}
      />
    </div>
  );
}

function TemplateSection({
  title,
  icon,
  items,
  onDelete,
  onToggleFavorite,
  canWrite,
}: {
  title: string;
  icon?: React.ReactNode;
  items: ItemTemplate[];
  onDelete: (template: ItemTemplate) => void;
  onToggleFavorite: (template: ItemTemplate) => void;
  canWrite: boolean;
}) {
  return (
    <section className="space-y-4">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-700">
        {icon}
        {title}
        <span className="font-normal text-zinc-400">({items.length})</span>
      </h2>
      <div className="hidden lg:block">
        <div className="mb-2 grid grid-cols-[minmax(140px,1fr)_100px_80px_120px_auto] gap-4 px-5 text-xs font-medium uppercase tracking-wider text-zinc-400">
          <span>項目名</span>
          <span>単価</span>
          <span>税率</span>
          <span>更新日</span>
          <span className="text-right">操作</span>
        </div>
        <ul className="space-y-2">
          {items.map((t) => (
            <li key={t.id}>
              <ItemTemplateCard
                template={t}
                variant="row"
                onDelete={onDelete}
                onToggleFavorite={onToggleFavorite}
                canWrite={canWrite}
              />
            </li>
          ))}
        </ul>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:hidden">
        {items.map((t) => (
          <ItemTemplateCard
            key={t.id}
            template={t}
            onDelete={onDelete}
            onToggleFavorite={onToggleFavorite}
            canWrite={canWrite}
          />
        ))}
      </div>
    </section>
  );
}
