"use client";

import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ProjectActionType } from "@/lib/types";
import { cn } from "@/lib/utils";

type ProjectActionButtonProps = {
  label: string;
  action: ProjectActionType;
  onAction: (action: ProjectActionType) => Promise<void>;
  variant?: "primary" | "outline";
  loading?: boolean;
  className?: string;
};

export function ProjectActionButton({
  label,
  action,
  onAction,
  variant = "primary",
  loading,
  className,
}: ProjectActionButtonProps) {
  return (
    <Button
      type="button"
      size="sm"
      disabled={loading}
      onClick={() => onAction(action)}
      className={cn(
        "h-8 rounded-lg text-xs font-medium",
        variant === "primary"
          ? "bg-zinc-900 text-white hover:bg-zinc-800"
          : "border-zinc-200",
        className
      )}
    >
      {loading ? <Loader2 className="size-3.5 animate-spin" /> : label}
    </Button>
  );
}
