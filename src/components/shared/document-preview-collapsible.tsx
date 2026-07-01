"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, FileText } from "lucide-react";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { cn } from "@/lib/utils";

type DocumentPreviewCollapsibleProps = {
  children: React.ReactNode;
  className?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export function DocumentPreviewCollapsible({
  children,
  className,
  open: controlledOpen,
  onOpenChange,
}: DocumentPreviewCollapsibleProps) {
  const isMobile = useIsMobile();
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;

  if (!isMobile) {
    return <div className={className}>{children}</div>;
  }

  return (
    <div className={cn("space-y-3", className)}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex min-h-11 w-full items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-left text-sm font-medium text-zinc-900 shadow-sm"
      >
        <span className="inline-flex items-center gap-2">
          <FileText className="size-4 text-zinc-500" />
          {open ? "プレビューを閉じる" : "プレビューを見る"}
        </span>
        {open ? (
          <ChevronUp className="size-4 shrink-0 text-zinc-400" />
        ) : (
          <ChevronDown className="size-4 shrink-0 text-zinc-400" />
        )}
      </button>
      {open ? children : null}
    </div>
  );
}
