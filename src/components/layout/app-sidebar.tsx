"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Building2,
  CalendarClock,
  CalendarRange,
  ClipboardList,
  FileText,
  FolderKanban,
  LayoutDashboard,
  LogOut,
  Package,
  Receipt,
  ScrollText,
  Stamp,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "@/lib/constants";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { signOut } from "@/lib/auth/session";
import { useAuthStore } from "@/stores/auth-store";

const iconMap: Record<string, LucideIcon> = {
  LayoutDashboard,
  FolderKanban,
  Users,
  FileText,
  Receipt,
  Wallet,
  CalendarClock,
  CalendarRange,
  Building2,
  ScrollText,
  ClipboardList,
  Package,
  Stamp,
};

export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const showAuth = isSupabaseConfigured();

  async function handleSignOut() {
    try {
      if (showAuth) {
        await signOut();
      }
      router.replace(showAuth ? "/login" : "/");
    } catch {
      toast.error("ログアウトに失敗しました");
    }
  }

  return (
    <aside className="flex h-full w-60 shrink-0 flex-col border-r border-zinc-200 bg-[#f8fafc]">
      <div className="flex h-16 items-center gap-2.5 px-6">
        <div className="flex size-8 items-center justify-center rounded-xl bg-zinc-900">
          <span className="text-sm font-bold text-white">F</span>
        </div>
        <div>
          <p className="text-sm font-semibold text-zinc-900">FlowBill</p>
          <p className="text-xs text-zinc-400">受発注管理</p>
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 px-3 py-2">
        {NAV_ITEMS.map((item) => {
          const Icon = iconMap[item.icon];
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : item.href === "/projects"
                ? pathname === "/projects" ||
                  (pathname.startsWith("/projects/") &&
                    !pathname.startsWith("/projects/schedule") &&
                    pathname !== "/projects/new")
                : pathname === item.href || pathname.startsWith(`${item.href}/`);
          const disabled = "disabled" in item && item.disabled;

          if (disabled) {
            return (
              <span
                key={item.href}
                className="flex cursor-not-allowed items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-zinc-300"
              >
                <Icon className="size-[18px]" strokeWidth={1.5} />
                {item.label}
                <span className="ml-auto text-[10px] font-medium uppercase tracking-wider text-zinc-300">
                  Soon
                </span>
              </span>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-white text-zinc-900 shadow-sm ring-1 ring-zinc-200/60"
                  : "text-zinc-600 hover:bg-white/70 hover:text-zinc-900"
              )}
            >
              <Icon
                className={cn(
                  "size-[18px]",
                  isActive ? "text-zinc-900" : "text-zinc-400"
                )}
                strokeWidth={1.5}
              />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-zinc-200 p-4">
        <div className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-zinc-200/60">
          {showAuth && user ? (
            <>
              <p className="text-xs font-medium text-zinc-500">ログイン中</p>
              <p className="mt-0.5 truncate text-sm font-medium text-zinc-900">
                {user.email?.split("@")[0] ?? "ユーザー"}
              </p>
              <p className="truncate text-xs text-zinc-400">{user.email}</p>
              <button
                type="button"
                onClick={handleSignOut}
                className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-zinc-200 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50"
              >
                <LogOut className="size-3.5" />
                ログアウト
              </button>
            </>
          ) : (
            <>
              <p className="text-xs font-medium text-zinc-500">ローカルモード</p>
              <p className="mt-0.5 text-sm text-zinc-600">デモデータで動作中</p>
            </>
          )}
        </div>
      </div>
    </aside>
  );
}
