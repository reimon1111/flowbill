import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/** ページ本文エリアのみの軽いローディング（全画面白飛びを避ける） */
export function PageContentLoader({
  className,
  label = "読み込み中...",
}: {
  className?: string;
  label?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-h-[200px] flex-col items-center justify-center gap-2 py-16",
        className
      )}
    >
      <Loader2 className="size-6 animate-spin text-zinc-400" strokeWidth={1.5} />
      {label ? <p className="text-sm text-zinc-500">{label}</p> : null}
    </div>
  );
}
