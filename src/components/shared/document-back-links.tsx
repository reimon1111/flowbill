import Link from "next/link";
import { ArrowLeft, FolderKanban } from "lucide-react";
import { cn } from "@/lib/utils";

type DocumentBackLinksProps = {
  listHref: string;
  listLabel?: string;
  projectId: string;
  className?: string;
};

export function DocumentBackLinks({
  listHref,
  listLabel = "一覧へ戻る",
  projectId,
  className,
}: DocumentBackLinksProps) {
  return (
    <div className={cn("flex flex-wrap items-center gap-x-4 gap-y-2", className)}>
      <Link
        href={listHref}
        className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900"
      >
        <ArrowLeft className="size-4 shrink-0" />
        {listLabel}
      </Link>
      <Link
        href={`/projects/${projectId}`}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-zinc-700 hover:text-zinc-900"
      >
        <FolderKanban className="size-4 shrink-0 text-zinc-400" />
        案件へ戻る
      </Link>
    </div>
  );
}
