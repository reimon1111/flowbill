import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type FormSectionProps = {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
};

export function FormSection({
  title,
  description,
  children,
  className,
}: FormSectionProps) {
  return (
    <section
      className={cn(
        "rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8",
        className
      )}
    >
      <div className="mb-6 space-y-1">
        <h2 className="text-lg font-semibold text-zinc-900">{title}</h2>
        {description && (
          <p className="text-sm text-zinc-500">{description}</p>
        )}
      </div>
      <div className="space-y-5">{children}</div>
    </section>
  );
}
