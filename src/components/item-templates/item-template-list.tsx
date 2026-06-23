"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Star } from "lucide-react";
import { toast } from "sonner";
import { CategoryFilter } from "@/components/item-templates/category-filter";
import { ItemTemplateCard } from "@/components/item-templates/item-template-card";
import { CategoryManagerDialog } from "@/components/item-templates/category-manager-dialog";
import { DeleteConfirmDialog } from "@/components/shared/delete-confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { SearchBar } from "@/components/shared/search-bar";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  deleteItemTemplate,
  toggleItemTemplateFavorite,
} from "@/lib/services/item-templates";
import type { ItemTemplate, ItemTemplateCategory } from "@/lib/types";
import { useItemTemplateStore } from "@/stores/item-template-store";
import { cn } from "@/lib/utils";

export function ItemTemplateList() {
  const itemTemplates = useItemTemplateStore((s) => s.itemTemplates);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<ItemTemplateCategory | "all">("all");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ItemTemplate | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const t of itemTemplates) set.add(t.category);
    return Array.from(set).sort((a, b) => a.localeCompare(b, "ja"));
  }, [itemTemplates]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return itemTemplates
      .filter((t) => {
        if (category !== "all" && t.category !== category) return false;
        if (favoritesOnly && !t.isFavorite) return false;
        if (!q) return true;
        return (
          t.name.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q) ||
          t.category.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        if (a.isFavorite !== b.isFavorite) return a.isFavorite ? -1 : 1;
        return (
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        );
      });
  }, [itemTemplates, search, category, favoritesOnly]);

  const favorites = filtered.filter((t) => t.isFavorite);
  const others = filtered.filter((t) => !t.isFavorite);
  const showSplit =
    !favoritesOnly && category === "all" && !search && favorites.length > 0;

  const handleToggleFavorite = async (template: ItemTemplate) => {
    await toggleItemTemplateFavorite(template.id);
    toast.success(
      template.isFavorite
        ? "お気に入りを解除しました"
        : "お気に入りに追加しました"
    );
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteItemTemplate(deleteTarget.id);
      toast.success("請求項目テンプレを削除しました");
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-8 py-10">
      <PageHeader
        title="請求項目テンプレ"
        description={`${itemTemplates.length}件 — 見積作成時にワンクリックで明細を追加`}
        action={
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
        }
      />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder="項目名・説明・カテゴリで検索..."
          className="max-w-md flex-1"
        />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <CategoryFilter
          categories={categories}
          selectedCategory={category}
          onCategoryChange={setCategory}
          favoritesOnly={favoritesOnly}
          onFavoritesOnlyChange={setFavoritesOnly}
        />
        <Button
          type="button"
          variant="outline"
          className="h-10 rounded-xl"
          onClick={() => setCategoryOpen(true)}
        >
          カテゴリを編集
        </Button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title={
            search || category !== "all" || favoritesOnly
              ? "該当するテンプレが見つかりません"
              : "テンプレがまだ登録されていません"
          }
          description="よく使う項目を登録しておくと、見積作成が30秒で完了します"
          action={
            !search && category === "all" && !favoritesOnly && (
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
            onDelete={setDeleteTarget}
            onToggleFavorite={handleToggleFavorite}
          />
          {others.length > 0 && (
            <TemplateSection
              title="その他のテンプレ"
              items={others}
              onDelete={setDeleteTarget}
              onToggleFavorite={handleToggleFavorite}
            />
          )}
        </div>
      ) : (
        <TemplateSection
          title={favoritesOnly ? "お気に入り" : "すべて"}
          items={filtered}
          onDelete={setDeleteTarget}
          onToggleFavorite={handleToggleFavorite}
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

      <CategoryManagerDialog
        open={categoryOpen}
        onOpenChange={(nextOpen) => setCategoryOpen(nextOpen)}
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
}: {
  title: string;
  icon?: React.ReactNode;
  items: ItemTemplate[];
  onDelete: (t: ItemTemplate) => void;
  onToggleFavorite: (t: ItemTemplate) => void;
}) {
  return (
    <section className="space-y-4">
      <h2 className="flex items-center gap-2 text-base font-semibold text-zinc-900">
        {icon}
        {title}
        <span className="text-sm font-normal text-zinc-400">
          {items.length}件
        </span>
      </h2>

      <div className="hidden lg:block">
        <div className="mb-2 grid grid-cols-[minmax(140px,1fr)_80px_minmax(160px,1.2fr)_100px_80px_120px_auto] gap-4 px-5 text-xs font-medium uppercase tracking-wider text-zinc-400">
          <span>項目名</span>
          <span>カテゴリ</span>
          <span>説明</span>
          <span>単価</span>
          <span>税率</span>
          <span>更新日</span>
          <span />
        </div>
        <div className="space-y-2">
          {items.map((t) => (
            <ItemTemplateCard
              key={t.id}
              template={t}
              variant="row"
              onDelete={onDelete}
              onToggleFavorite={onToggleFavorite}
            />
          ))}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:hidden">
        {items.map((t) => (
          <ItemTemplateCard
            key={t.id}
            template={t}
            variant="card"
            onDelete={onDelete}
            onToggleFavorite={onToggleFavorite}
          />
        ))}
      </div>
    </section>
  );
}
