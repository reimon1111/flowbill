"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { formatSupabaseError } from "@/lib/db/errors";
import { createItemTemplateCategory, getMergedCategoryOptions } from "@/lib/services/item-template-categories";

export function CategorySelect({
  value,
  onChange,
  disabled,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
}) {
  void value;
  const options = getMergedCategoryOptions();
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center gap-2">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="flex h-11 w-full rounded-xl border border-zinc-200/80 bg-white px-3 text-base text-zinc-900 outline-none focus-visible:border-zinc-400 focus-visible:ring-2 focus-visible:ring-zinc-200"
        >
          {options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
        <Button
          type="button"
          variant="outline"
          className="h-11 shrink-0 rounded-xl"
          disabled={disabled}
          onClick={() => setAdding((v) => !v)}
        >
          <Plus className="size-4" />
          <span className="hidden sm:inline">カテゴリ追加</span>
        </Button>
      </div>

      {adding && (
        <div className="flex items-center gap-2">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="新しいカテゴリ名"
            className="h-10 rounded-xl"
            disabled={disabled}
          />
          <Button
            type="button"
            className="h-10 rounded-xl bg-zinc-900 text-white hover:bg-zinc-800"
            disabled={disabled || newName.trim() === ""}
            onClick={() => {
              const name = newName.trim();
              if (!name) return;
              void createItemTemplateCategory(name)
                .then((created) => {
                  if (created) {
                    onChange(created.name);
                    setNewName("");
                    setAdding(false);
                  }
                })
                .catch((error) => {
                  toast.error("カテゴリの追加に失敗しました", {
                    description: formatSupabaseError(error),
                  });
                });
            }}
          >
            追加
          </Button>
        </div>
      )}
    </div>
  );
}

