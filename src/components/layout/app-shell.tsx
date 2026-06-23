"use client";

import { memo } from "react";
import { AppHeader } from "@/components/layout/app-header";
import { AppSidebar } from "@/components/layout/app-sidebar";

const StableSidebar = memo(function StableSidebar() {
  return <AppSidebar />;
});

const StableHeader = memo(function StableHeader() {
  return <AppHeader />;
});

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-[#f6f7f9]">
      <StableSidebar />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <StableHeader />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
