"use client";

import { usePathname } from "next/navigation";
import { useCompanySettingsStore } from "@/stores/company-settings-store";
import { isContractUsable, CONTRACT_BLOCKED_MESSAGE } from "@/lib/types/signup-access";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export function ContractGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const settings = useCompanySettingsStore((s) => s.settings);

  if (pathname.startsWith("/admin")) {
    return <>{children}</>;
  }

  if (!isSupabaseConfigured()) {
    return <>{children}</>;
  }

  if (!isContractUsable(settings.contractStatus ?? "active")) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50/30 px-6">
        <div className="max-w-md rounded-xl border border-amber-200 bg-amber-50 p-8 text-center shadow-sm">
          <p className="text-lg font-semibold text-amber-950">アカウント停止中</p>
          <p className="mt-3 text-sm leading-relaxed text-amber-900">
            {CONTRACT_BLOCKED_MESSAGE}
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
