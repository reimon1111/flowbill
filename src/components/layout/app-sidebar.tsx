"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  Building2,
  CalendarClock,
  CalendarRange,
  ChevronDown,
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
import { useCompanyMembershipStore } from "@/stores/company-membership-store";
import { canManageMembers } from "@/lib/types/company-membership";

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

type NavItem = (typeof NAV_ITEMS)[number];

function isActiveNavItem(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  if (href === "/projects") {
    return (
      pathname === "/projects" ||
      (pathname.startsWith("/projects/") &&
        !pathname.startsWith("/projects/schedule") &&
        pathname !== "/projects/new")
    );
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLink({
  item,
  pathname,
  className,
  onNavigate,
}: {
  item: NavItem;
  pathname: string;
  className?: string;
  onNavigate?: () => void;
}) {
  const Icon = iconMap[item.icon];
  const isActive = isActiveNavItem(pathname, item.href);
  const disabled = "disabled" in item && item.disabled;

  if (disabled) {
    return (
      <span
        key={item.href}
        className={cn(
          "flex cursor-not-allowed items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-zinc-300",
          className
        )}
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
      onClick={onNavigate}
      className={cn(
        "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
        isActive
          ? "bg-white text-zinc-900 shadow-sm ring-1 ring-zinc-200/60"
          : "text-zinc-600 hover:bg-white/70 hover:text-zinc-900",
        className
      )}
    >
      <Icon
        className={cn("size-[18px]", isActive ? "text-zinc-900" : "text-zinc-400")}
        strokeWidth={1.5}
      />
      {item.label}
    </Link>
  );
}

function SectionLabel({ children }: { children: string }) {
  return (
    <p className="px-3 pb-1 pt-3 text-[11px] font-semibold tracking-wide text-zinc-400">
      {children}
    </p>
  );
}

function CollapsibleGroup({
  label,
  open,
  onToggle,
  children,
}: {
  label: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          "flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-semibold text-zinc-500 transition-colors",
          "hover:bg-white/70 hover:text-zinc-700"
        )}
        aria-expanded={open}
      >
        <span>{label}</span>
        <ChevronDown
          className={cn(
            "size-4 text-zinc-400 transition-transform",
            open ? "rotate-0" : "-rotate-90"
          )}
        />
      </button>
      {open ? <div className="space-y-0.5 pl-2">{children}</div> : null}
    </div>
  );
}

export function AppSidebar({
  className,
  onNavigate,
}: {
  className?: string;
  onNavigate?: () => void;
} = {}) {
  const pathname = usePathname();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const showAuth = isSupabaseConfigured();
  const role = useCompanyMembershipStore((s) => s.currentRole);
  const canManage = canManageMembers(role);

  const docsGroupActive = useMemo(() => {
    return (
      isActiveNavItem(pathname, "/quotes") ||
      isActiveNavItem(pathname, "/orders") ||
      isActiveNavItem(pathname, "/delivery-notes") ||
      isActiveNavItem(pathname, "/invoices") ||
      isActiveNavItem(pathname, "/receipts")
    );
  }, [pathname]);

  const settingsGroupActive = useMemo(() => {
    return (
      isActiveNavItem(pathname, "/customers") ||
      isActiveNavItem(pathname, "/item-templates") ||
      isActiveNavItem(pathname, "/settings/company")
    );
  }, [pathname]);

  const [docsOpen, setDocsOpen] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return localStorage.getItem("flowbill.sidebar.docsOpen") === "1";
    } catch {
      return false;
    }
  });

  const [settingsOpen, setSettingsOpen] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return localStorage.getItem("flowbill.sidebar.settingsOpen") === "1";
    } catch {
      return false;
    }
  });

  // 現在ページがグループ配下なら自動で開く（ユーザーの迷い防止を優先）
  const effectiveDocsOpen = docsGroupActive ? true : docsOpen;
  const effectiveSettingsOpen = settingsGroupActive ? true : settingsOpen;

  useEffect(() => {
    try {
      localStorage.setItem("flowbill.sidebar.docsOpen", docsOpen ? "1" : "0");
    } catch {
      // ignore
    }
  }, [docsOpen]);

  useEffect(() => {
    try {
      localStorage.setItem(
        "flowbill.sidebar.settingsOpen",
        settingsOpen ? "1" : "0"
      );
    } catch {
      // ignore
    }
  }, [settingsOpen]);

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
    <aside
      className={cn(
        "flex h-full w-60 shrink-0 flex-col border-r border-zinc-200 bg-[#f8fafc]",
        className
      )}
    >
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
        {/* メイン */}
        <NavLink item={NAV_ITEMS[0]} pathname={pathname} onNavigate={onNavigate} />

        {/* 案件管理 */}
        <SectionLabel>案件管理</SectionLabel>
        <NavLink item={NAV_ITEMS[1]} pathname={pathname} onNavigate={onNavigate} />
        <NavLink item={NAV_ITEMS[2]} pathname={pathname} onNavigate={onNavigate} />

        {/* 入金 */}
        <SectionLabel>入金</SectionLabel>
        <NavLink item={NAV_ITEMS[8]} pathname={pathname} onNavigate={onNavigate} />

        {/* 書類管理 */}
        <SectionLabel>書類管理</SectionLabel>
        <CollapsibleGroup
          label="書類管理"
        open={effectiveDocsOpen}
          onToggle={() => setDocsOpen((v) => !v)}
        >
          <NavLink item={NAV_ITEMS[3]} pathname={pathname} className="pl-3" onNavigate={onNavigate} />
          <NavLink item={NAV_ITEMS[4]} pathname={pathname} className="pl-3" onNavigate={onNavigate} />
          <NavLink item={NAV_ITEMS[5]} pathname={pathname} className="pl-3" onNavigate={onNavigate} />
          <NavLink item={NAV_ITEMS[6]} pathname={pathname} className="pl-3" onNavigate={onNavigate} />
          <NavLink item={NAV_ITEMS[7]} pathname={pathname} className="pl-3" onNavigate={onNavigate} />
        </CollapsibleGroup>

        {/* 設定 */}
        <SectionLabel>設定</SectionLabel>
        <CollapsibleGroup
          label="設定"
        open={effectiveSettingsOpen}
          onToggle={() => setSettingsOpen((v) => !v)}
        >
          <NavLink item={NAV_ITEMS[9]} pathname={pathname} className="pl-3" onNavigate={onNavigate} />
          <NavLink item={NAV_ITEMS[10]} pathname={pathname} className="pl-3" onNavigate={onNavigate} />
          {canManage ? (
            <NavLink item={NAV_ITEMS[11]} pathname={pathname} className="pl-3" onNavigate={onNavigate} />
          ) : null}
        </CollapsibleGroup>
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
