"use client";

import { useEffect, useMemo, useState } from "react";
import { Pencil, Plus, Trash2, ArrowDown, ArrowUp, Check, X } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DeleteConfirmDialog } from "@/components/shared/delete-confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatSupabaseError } from "@/lib/db/errors";
import type { ItemTemplateCategoryRecord } from "@/lib/types";
import { useItemTemplateCategoryStore } from "@/stores/item-template-category-store";
import { useItemTemplateStore } from "@/stores/item-template-store";
import {
  countTemplatesByCategoryName,
  createItemTemplateCategory,
  deleteItemTemplateCategory,
  fetchItemTemplateCategories,
  getCategoryCandidatesFromTemplates,
  getItemTemplateCategories,
  renameItemTemplateCategory,
  reorderItemTemplateCategories,
} from "@/lib/services/item-template-categories";

function showCategoryError(message: string, error: unknown) {
  toast.error(message, {
    description: formatSupabaseError(error),
  });
}

export function CategoryManagerDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [newName, setNewName] = useState("");
  const [confirm, setConfirm] = useState<{
    categoryId: string;
    name: string;
    usedCount: number;
  } | null>(null);

  useItemTemplateCategoryStore((s) => s.categories);
  useItemTemplateStore((s) => s.itemTemplates);

  const categories = getItemTemplateCategories();
  const derivedCandidates = getCategoryCandidatesFromTemplates();
  const missingCandidates = useMemo(
    () => derivedCandidates.filter((n) => !categories.some((c) => c.name === n)),
    [derivedCandidates, categories]
  );

  useEffect(() => {
    if (!open) return;
    void fetchItemTemplateCategories().catch((error) => {
      showCategoryError("カテゴリの読み込みに失敗しました", error);
    });
  }, [open]);

  const handleAdd = async () => {
    const name = newName.trim();
    if (!name) {
      toast.error("カテゴリ名を入力してください");
      return;
    }
    setLoading(true);
    try {
      const created = await createItemTemplateCategory(name);
      if (created) {
        toast.success("カテゴリを追加しました");
        setNewName("");
      }
    } catch (error) {
      showCategoryError("カテゴリの追加に失敗しました", error);
    } finally {
      setLoading(false);
    }
  };

  const handleRename = async (
    cat: ItemTemplateCategoryRecord,
    name: string
  ): Promise<boolean> => {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("カテゴリ名を入力してください");
      return false;
    }
    if (trimmed === cat.name) return true;

    setLoading(true);
    try {
      const updated = await renameItemTemplateCategory(cat.id, trimmed);
      if (updated) {
        toast.success("カテゴリ名を更新しました");
        return true;
      }
      toast.error("カテゴリ名の更新に失敗しました");
      return false;
    } catch (error) {
      showCategoryError("カテゴリ名の更新に失敗しました", error);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (cat: ItemTemplateCategoryRecord) => {
    const usedCount = countTemplatesByCategoryName(cat.name);
    if (usedCount > 0) {
      setConfirm({ categoryId: cat.id, name: cat.name, usedCount });
      return;
    }
    setLoading(true);
    try {
      const ok = await deleteItemTemplateCategory(cat.id, {
        replaceInTemplatesWithOther: false,
      });
      if (ok) toast.success("カテゴリを削除しました");
    } catch (error) {
      showCategoryError("カテゴリの削除に失敗しました", error);
    } finally {
      setLoading(false);
    }
  };

  const handleMove = async (catId: string, dir: -1 | 1) => {
    const idx = categories.findIndex((c) => c.id === catId);
    if (idx < 0) return;
    const next = categories.slice();
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= next.length) return;
    const tmp = next[idx];
    next[idx] = next[swapIdx];
    next[swapIdx] = tmp;
    setLoading(true);
    try {
      await reorderItemTemplateCategories(next.map((c) => c.id));
    } catch (error) {
      showCategoryError("並び順の更新に失敗しました", error);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!confirm) return;
    setLoading(true);
    try {
      await deleteItemTemplateCategory(confirm.categoryId, {
        replaceInTemplatesWithOther: true,
      });
      toast.success("カテゴリを削除しました");
      setConfirm(null);
    } catch (error) {
      showCategoryError("カテゴリの削除に失敗しました", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(nextOpen) => onOpenChange(nextOpen)}>
        <DialogContent className="rounded-xl sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>カテゴリを編集</DialogTitle>
            <DialogDescription>
              よく使う分類を登録しておくと、テンプレを探しやすくなります。
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <p className="mb-2 text-sm font-medium text-zinc-700">新規カテゴリ</p>
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="例）デザイン"
                  className="h-11 rounded-xl"
                  disabled={loading}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void handleAdd();
                    }
                  }}
                />
              </div>
              <Button
                type="button"
                className="h-11 rounded-xl bg-zinc-900 hover:bg-zinc-800"
                disabled={loading || newName.trim() === ""}
                onClick={() => void handleAdd()}
              >
                <Plus className="size-4" />
                追加
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-11 rounded-xl"
                disabled={loading}
                onClick={() => {
                  setLoading(true);
                  void fetchItemTemplateCategories()
                    .catch((error) => {
                      showCategoryError("カテゴリの読み込みに失敗しました", error);
                    })
                    .finally(() => setLoading(false));
                }}
              >
                更新
              </Button>
            </div>

            {missingCandidates.length > 0 && (
              <div className="rounded-xl border border-amber-200/70 bg-amber-50/30 p-4 text-sm text-amber-800">
                <p className="font-medium">未登録のカテゴリ候補があります</p>
                <p className="mt-1 text-xs text-amber-800/80">
                  既存テンプレで使われています。必要なら上の入力欄から追加してください。
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {missingCandidates.slice(0, 12).map((n) => (
                    <button
                      key={n}
                      type="button"
                      className="rounded-lg border border-amber-200 bg-white px-2.5 py-1 text-xs font-medium hover:bg-amber-50"
                      onClick={() => setNewName(n)}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-medium text-zinc-700">現在のカテゴリ</p>
                <p className="text-xs text-zinc-500">{categories.length}件</p>
              </div>
              {categories.length === 0 ? (
                <p className="rounded-xl border border-dashed border-zinc-200 px-4 py-6 text-center text-sm text-zinc-500">
                  カテゴリがまだありません。上の入力欄から追加してください。
                </p>
              ) : (
                <div className="space-y-2">
                  {categories.map((cat) => (
                    <CategoryRow
                      key={cat.id}
                      category={cat}
                      disabled={loading}
                      onRename={handleRename}
                      onDelete={handleDelete}
                      onMoveUp={() => void handleMove(cat.id, -1)}
                      onMoveDown={() => void handleMove(cat.id, 1)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              onClick={() => onOpenChange(false)}
            >
              閉じる
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DeleteConfirmDialog
        open={!!confirm}
        onOpenChange={(nextOpen) => !nextOpen && setConfirm(null)}
        title="カテゴリを削除しますか？"
        description={`「${confirm?.name ?? ""}」は ${confirm?.usedCount ?? 0} 件のテンプレで使用中です。削除すると、該当テンプレのカテゴリは「その他」に変更されます。`}
        onConfirm={() => void handleConfirmDelete()}
        loading={loading}
      />
    </>
  );
}

function CategoryRow({
  category,
  disabled,
  onRename,
  onDelete,
  onMoveUp,
  onMoveDown,
}: {
  category: ItemTemplateCategoryRecord;
  disabled?: boolean;
  onRename: (cat: ItemTemplateCategoryRecord, name: string) => Promise<boolean>;
  onDelete: (cat: ItemTemplateCategoryRecord) => Promise<void>;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(category.name);
  const usedCount = countTemplatesByCategoryName(category.name);

  const cancelEdit = () => {
    setEditing(false);
    setName(category.name);
  };

  const saveEdit = () => {
    void onRename(category, name).then((ok) => {
      if (ok) setEditing(false);
    });
  };

  return (
    <div className="flex items-center gap-2 rounded-xl border border-zinc-200/80 bg-white px-3 py-2.5">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        {editing ? (
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-9 rounded-lg"
            disabled={disabled}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                saveEdit();
              }
              if (e.key === "Escape") {
                e.preventDefault();
                cancelEdit();
              }
            }}
          />
        ) : (
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-zinc-900">{category.name}</p>
            <p className="text-xs text-zinc-500">使用中 {usedCount}件</p>
          </div>
        )}
      </div>

      <div className="flex items-center gap-1">
        {editing ? (
          <>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="rounded-lg text-emerald-700 hover:text-emerald-800"
              disabled={disabled}
              onClick={saveEdit}
              aria-label="保存"
            >
              <Check className="size-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="rounded-lg"
              disabled={disabled}
              onClick={cancelEdit}
              aria-label="キャンセル"
            >
              <X className="size-4" />
            </Button>
          </>
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="rounded-lg"
            disabled={disabled}
            onClick={() => {
              setEditing(true);
              setName(category.name);
            }}
            aria-label="カテゴリ名を編集"
          >
            <Pencil className="size-4" />
          </Button>
        )}
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="rounded-lg"
          disabled={disabled || editing}
          onClick={onMoveUp}
          aria-label="上へ移動"
        >
          <ArrowUp className="size-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="rounded-lg"
          disabled={disabled || editing}
          onClick={onMoveDown}
          aria-label="下へ移動"
        >
          <ArrowDown className="size-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="rounded-lg text-red-600 hover:text-red-700"
          disabled={disabled || editing}
          onClick={() => void onDelete(category)}
          aria-label="削除"
        >
          <Trash2 className="size-4" />
        </Button>
      </div>
    </div>
  );
}
