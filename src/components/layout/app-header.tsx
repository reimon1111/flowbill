"use client";

import { Bell, Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

type AppHeaderProps = {
  title?: string;
};

export function AppHeader({ title }: AppHeaderProps) {
  const router = useRouter();
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
    <header className="app-header print-hidden flex h-16 shrink-0 items-center justify-between gap-6 border-b border-zinc-200 bg-white/90 px-8 backdrop-blur-sm">
      <div className="flex flex-1 items-center gap-6">
        {title && (
          <h2 className="hidden text-sm font-medium text-zinc-500 lg:block">
            {title}
          </h2>
        )}
        <div className="relative max-w-md flex-1">
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

      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="size-10 rounded-xl text-zinc-500 hover:text-zinc-900"
          onClick={() => router.push("/payments")}
        >
          <Bell className="size-[18px]" strokeWidth={1.5} />
        </Button>
        <Button
          className="h-10 gap-2 rounded-xl bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800"
          onClick={() => router.push("/projects/new")}
        >
          <Plus className="size-4" strokeWidth={1.5} />
          新規案件
        </Button>
      </div>
    </header>
  );
}
