"use client";

import { memo, useCallback, useEffect, useState } from "react";
import { AppHeader } from "@/components/layout/app-header";
import { AppSidebar } from "@/components/layout/app-sidebar";

const StableSidebar = memo(function StableSidebar({
  className,
  onNavigate,
}: {
  className?: string;
  onNavigate?: () => void;
}) {
  return <AppSidebar className={className} onNavigate={onNavigate} />;
});

const StableHeader = memo(function StableHeader({
  onMenuClick,
}: {
  onMenuClick: () => void;
}) {
  return <AppHeader onMenuClick={onMenuClick} />;
});

export function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const openMobileNav = useCallback(() => setMobileNavOpen(true), []);
  const closeMobileNav = useCallback(() => setMobileNavOpen(false), []);

  useEffect(() => {
    if (!mobileNavOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileNavOpen]);

  return (
    <div className="flex h-screen overflow-hidden bg-[#f6f7f9]">
      <StableSidebar className="hidden lg:flex" />

      {mobileNavOpen ? (
        <>
          <button
            type="button"
            aria-label="メニューを閉じる"
            className="fixed inset-0 z-40 bg-black/40 lg:hidden"
            onClick={closeMobileNav}
          />
          <StableSidebar
            className="fixed inset-y-0 left-0 z-50 flex w-72 max-w-[min(85vw,18rem)] shadow-xl lg:hidden"
            onNavigate={closeMobileNav}
          />
        </>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <StableHeader onMenuClick={openMobileNav} />
        <main className="flex-1 overflow-y-auto overflow-x-hidden">{children}</main>
      </div>
    </div>
  );
}
