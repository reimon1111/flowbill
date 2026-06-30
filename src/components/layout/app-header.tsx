"use client";

import { Menu, Plus, Search, Wallet } from "lucide-react";
import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCanWriteBusinessData } from "@/hooks/use-can-write-business-data";

type AppHeaderProps = {
  title?: string;
  onMenuClick?: () => void;
};

export function AppHeader({ title, onMenuClick }: AppHeaderProps) {
  const router = useRouter();
  const canWrite = useCanWriteBusinessData();
  const searchParams = useSearchParams();
  const initial = useMemo(() => searchParams.get("search") ?? "", [searchParams]);
  const [search, setSearch] = useState(initial);

  const runSearch = () => {
    const q = search.trim();
    if (!q) return;
    toast.message("案件一覧で検索します", { description: q });
    router.push(`/projects?search=${encodeURIComponent(q)}`);
  };

  return (
    <header className="app-header print-hidden flex h-14 shrink-0 items-center justify-between gap-3 border-b border-zinc-200 bg-white/90 px-4 backdrop-blur-sm sm:h-16 sm:gap-4 sm:px-6 lg:px-8">
      <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-4">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-10 shrink-0 rounded-xl text-zinc-600 lg:hidden"
          onClick={onMenuClick}
          aria-label="メニューを開く"
        >
          <Menu className="size-5" strokeWidth={1.5} />
        </Button>
        {title ? (
          <h2 className="hidden truncate text-sm font-medium text-zinc-500 lg:block">
            {title}
          </h2>
        ) : null}
        <div className="relative hidden min-w-0 max-w-md flex-1 md:block">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                runSearch();
              }
            }}
            placeholder="案件・顧客を検索..."
            className="h-10 rounded-xl border-zinc-200 bg-white/70 pl-10 text-base shadow-none hover:bg-white focus-visible:bg-white"
          />
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="size-10 rounded-xl text-zinc-500 hover:text-zinc-900"
          onClick={() => router.push("/payments")}
          aria-label="入金管理"
        >
          <Wallet className="size-[18px]" strokeWidth={1.5} />
        </Button>
        {canWrite ? (
          <Button
            className="h-10 gap-2 rounded-xl bg-zinc-900 px-3 text-sm font-medium text-white hover:bg-zinc-800 sm:px-4"
            onClick={() => router.push("/projects/new")}
          >
            <Plus className="size-4" strokeWidth={1.5} />
            <span className="hidden sm:inline">新規案件</span>
          </Button>
        ) : null}
      </div>
    </header>
  );
}
