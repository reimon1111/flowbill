import Link from "next/link";
import { cn } from "@/lib/utils";
import { useCanWriteBusinessData } from "@/hooks/use-can-write-business-data";

/** 見積・請求一覧の操作ボタン（横幅に収まるよう shrink-0） */
export function DocumentListActions({
  detailHref,
  editHref,
  className,
}: {
  detailHref: string;
  editHref: string;
  className?: string;
}) {
  const canWrite = useCanWriteBusinessData();

  return (
    <div className={cn("flex shrink-0 items-center gap-1.5", className)}>
      <Link
        href={detailHref}
        className="whitespace-nowrap rounded-lg border border-zinc-200 px-2.5 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
      >
        詳細
      </Link>
      {canWrite ? (
        <Link
          href={editHref}
          className="whitespace-nowrap rounded-lg border border-zinc-200 px-2.5 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
        >
          編集
        </Link>
      ) : null}
    </div>
  );
}

const listPageClass = "mx-auto min-w-0 w-full max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8 lg:py-10";

export function ListPageContainer({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn(listPageClass, className)}>{children}</div>;
}

/** xl 以上のテーブル見出し・行用グリッド（見積） */
export const quoteListGridClass =
  "grid grid-cols-[minmax(0,1.5fr)_auto_minmax(100px,auto)_auto] items-center gap-x-4 gap-y-1";

/** xl 以上のテーブル見出し・行用グリッド（請求） */
export const invoiceListGridClass =
  "grid grid-cols-[minmax(0,1.5fr)_auto_minmax(100px,auto)_auto] items-center gap-x-4 gap-y-1";

/** xl 以上のテーブル見出し・行用グリッド（注文書・納品書・領収書） */
export const commercialListGridClass =
  "grid grid-cols-[minmax(0,1.5fr)_minmax(100px,auto)_auto] items-center gap-x-4 gap-y-1";

export const listTableHeaderClass =
  "mb-2 hidden px-4 text-xs font-medium uppercase tracking-wider text-zinc-400 xl:grid";

export const listTableBodyClass = "hidden min-w-0 space-y-2 xl:block";

export const listCardsClass = "grid min-w-0 gap-3 sm:grid-cols-2 xl:hidden";
