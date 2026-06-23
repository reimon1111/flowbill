import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

type StatCardProps = {
  label: string;
  value: string;
  sublabel?: string;
  icon?: LucideIcon;
  variant?: "default" | "warning" | "danger";
  className?: string;
};

export function StatCard({
  label,
  value,
  sublabel,
  icon: Icon,
  variant = "default",
  className,
}: StatCardProps) {
  const variantStyles = {
    default: "text-foreground",
    warning: "text-amber-700",
    danger: "text-red-600",
  };

  return (
    <div
      className={cn(
        "rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm",
        className
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <p className="text-sm font-medium text-zinc-500">{label}</p>
          <p
            className={cn(
              "text-3xl font-bold tracking-tight",
              variantStyles[variant]
            )}
          >
            {value}
          </p>
          {sublabel && (
            <p className="text-sm text-zinc-400">{sublabel}</p>
          )}
        </div>
        {Icon && (
          <div className="flex size-10 items-center justify-center rounded-xl bg-[#f3f4f6] text-zinc-500">
            <Icon className="size-5" strokeWidth={1.5} />
          </div>
        )}
      </div>
    </div>
  );
}
