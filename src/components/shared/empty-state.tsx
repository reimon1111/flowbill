import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type EmptyStateProps = {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
};

export function EmptyState({
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-200 bg-zinc-50/30 px-6 py-16 text-center",
        className
      )}
    >
      <p className="text-base font-medium text-zinc-700">{title}</p>
      {description && (
        <p className="mt-2 max-w-sm text-sm text-zinc-500">{description}</p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
