import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type PageHeaderProps = {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
  titleClassName?: string;
};

export function PageHeader({
  title,
  description,
  action,
  className,
  titleClassName,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between",
        className
      )}
    >
      <div className="space-y-1">
        <h1
          className={cn(
            "text-2xl font-semibold tracking-tight text-zinc-900",
            titleClassName
          )}
        >
          {title}
        </h1>
        {description &&
          (typeof description === "string" ? (
            <p className="text-base text-zinc-500">{description}</p>
          ) : (
            description
          ))}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
