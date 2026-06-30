"use client";

import Link from "next/link";
import { MoreHorizontal, Pencil, Star, Trash2 } from "lucide-react";
import type { ItemTemplate } from "@/lib/types";
import { formatCurrency, formatDate, formatTaxRate } from "@/lib/format";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useCanWriteBusinessData } from "@/hooks/use-can-write-business-data";

type ItemTemplateCardProps = {
  template: ItemTemplate;
  onDelete: (template: ItemTemplate) => void;
  onToggleFavorite: (template: ItemTemplate) => void;
  variant?: "card" | "row";
  canWrite?: boolean;
};

export function ItemTemplateCard({
  template,
  onDelete,
  onToggleFavorite,
  variant = "card",
  canWrite: canWriteProp,
}: ItemTemplateCardProps) {
  const canWriteHook = useCanWriteBusinessData();
  const canWrite = canWriteProp ?? canWriteHook;

  if (variant === "row") {
    return (
      <TemplateRow
        template={template}
        onDelete={onDelete}
        onToggleFavorite={onToggleFavorite}
        canWrite={canWrite}
      />
    );
  }

  return (
    <article className="group rounded-xl border border-zinc-200/80 bg-white p-5 shadow-sm shadow-zinc-900/[0.02] transition-all hover:border-zinc-300 hover:shadow-md hover:shadow-zinc-900/[0.04]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-zinc-900">{template.name}</h3>
            <FavoriteButton
              isFavorite={template.isFavorite}
              disabled={!canWrite}
              onClick={() => onToggleFavorite(template)}
            />
          </div>
          <span className="mt-1.5 inline-block rounded-md bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600">
            {template.category}
          </span>
        </div>
        <p className="shrink-0 text-lg font-semibold tabular-nums text-zinc-900">
          {formatCurrency(template.unitPrice)}
        </p>
      </div>

      {template.description && (
        <p className="mt-3 line-clamp-2 text-sm text-zinc-500">
          {template.description}
        </p>
      )}

      <div className="mt-4 flex items-center justify-between text-sm text-zinc-400">
        <span>{formatTaxRate(template.taxRate)}</span>
        <span className="whitespace-nowrap">更新 {formatDate(template.updatedAt)}</span>
      </div>

      {canWrite ? (
        <div className="mt-4 flex gap-2 opacity-0 transition-opacity group-hover:opacity-100">
          <Link
            href={`/item-templates/${template.id}/edit`}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-zinc-200 px-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            <Pencil className="size-3.5" />
            編集
          </Link>
          <TemplateMenu
            template={template}
            onDelete={onDelete}
            onToggleFavorite={onToggleFavorite}
          />
        </div>
      ) : null}
    </article>
  );
}

function TemplateRow({
  template,
  onDelete,
  onToggleFavorite,
  canWrite = true,
}: ItemTemplateCardProps) {
  return (
    <article className="group grid grid-cols-1 gap-3 rounded-xl border border-zinc-200/80 bg-white px-5 py-4 shadow-sm shadow-zinc-900/[0.02] transition-shadow hover:shadow-md hover:shadow-zinc-900/[0.04] lg:grid-cols-[minmax(140px,1fr)_80px_minmax(160px,1.2fr)_100px_80px_120px_auto] lg:items-center lg:gap-4">
      <div className="flex min-w-0 items-center gap-2">
        <span className="truncate font-medium text-zinc-900">
          {template.name}
        </span>
        <FavoriteButton
          isFavorite={template.isFavorite}
          disabled={!canWrite}
          onClick={() => onToggleFavorite(template)}
        />
      </div>
      <span className="inline-flex w-fit rounded-md bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600 lg:w-auto">
        {template.category}
      </span>
      <p className="truncate text-sm text-zinc-500 lg:block">
        {template.description || "—"}
      </p>
      <p className="font-semibold tabular-nums text-zinc-900">
        {formatCurrency(template.unitPrice)}
      </p>
      <p className="text-sm text-zinc-500">{formatTaxRate(template.taxRate)}</p>
      <p className="text-sm text-zinc-400">
        <span className="whitespace-nowrap">{formatDate(template.updatedAt)}</span>
      </p>
      <div className="flex justify-end gap-2">
        {canWrite ? (
          <>
            <Link
              href={`/item-templates/${template.id}/edit`}
              className="hidden rounded-lg border border-zinc-200 px-2.5 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 lg:inline-flex"
            >
              編集
            </Link>
            <TemplateMenu
              template={template}
              onDelete={onDelete}
              onToggleFavorite={onToggleFavorite}
            />
          </>
        ) : null}
      </div>
    </article>
  );
}

function FavoriteButton({
  isFavorite,
  disabled = false,
  onClick,
}: {
  isFavorite: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick();
      }}
      className="shrink-0 rounded-md p-0.5 text-zinc-400 hover:text-amber-500"
      aria-label={isFavorite ? "お気に入りを解除" : "お気に入りに追加"}
    >
      <Star
        className={cn(
          "size-4",
          isFavorite && "fill-amber-400 text-amber-400"
        )}
      />
    </button>
  );
}

function TemplateMenu({
  template,
  onDelete,
  onToggleFavorite,
}: Pick<ItemTemplateCardProps, "template" | "onDelete" | "onToggleFavorite">) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex size-8 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
        aria-label="メニュー"
      >
        <MoreHorizontal className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="rounded-xl">
        <DropdownMenuItem onClick={() => onToggleFavorite(template)}>
          <Star className="size-4" />
          {template.isFavorite ? "お気に入り解除" : "お気に入りに追加"}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onClick={() => onDelete(template)}
        >
          <Trash2 className="size-4" />
          削除
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
