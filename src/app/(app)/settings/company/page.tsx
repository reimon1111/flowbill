"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { CompanySettingsForm } from "@/components/settings/company-settings-form";
import { DocumentPreviewCard } from "@/components/settings/document-preview-card";
import { MembersManager } from "@/components/settings/members-manager";
import { useCompanySettingsStore } from "@/stores/company-settings-store";
import { useCompanyMembershipStore } from "@/stores/company-membership-store";
import { canManageMembers } from "@/lib/types/company-membership";
import { cn } from "@/lib/utils";
import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

const TABS = [
  { id: "info", label: "会社情報" },
  { id: "members", label: "メンバー管理" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function CompanySettingsPage() {
  useCompanySettingsStore((s) => s.settings);
  const settings = useCompanySettingsStore.getState().getSettings();
  const searchParams = useSearchParams();
  const tab = (searchParams.get("tab") as TabId) || "info";
  const router = useRouter();
  const role = useCompanyMembershipStore((s) => s.currentRole);
  const canManage = canManageMembers(role);

  const visibleTabs = useMemo(() => {
    return canManage ? TABS : TABS.filter((t) => t.id !== "members");
  }, [canManage]);

  useEffect(() => {
    if (tab === "members" && !canManage) {
      toast.error("この画面にアクセスする権限がありません");
      router.replace("/settings/company?tab=info");
    }
  }, [tab, canManage, router]);

  return (
    <div className="mx-auto min-w-0 max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <PageHeader
        title="会社設定"
        description="会社情報・帳票設定・メンバー管理"
      />

      <div className="flex gap-2 border-b border-zinc-200">
        {visibleTabs.map((item) => (
          <Link
            key={item.id}
            href={`/settings/company?tab=${item.id}`}
            className={cn(
              "border-b-2 px-4 py-2 text-sm font-medium transition-colors",
              tab === item.id
                ? "border-zinc-900 text-zinc-900"
                : "border-transparent text-zinc-500 hover:text-zinc-800"
            )}
          >
            {item.label}
          </Link>
        ))}
      </div>

      {tab === "members" ? (
        <MembersManager />
      ) : (
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(280px,520px)] lg:items-start">
          <div className="rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-sm shadow-zinc-900/[0.03] sm:p-8">
            <CompanySettingsForm settings={settings} />
          </div>
          <div className="lg:sticky lg:top-20">
            <DocumentPreviewCard />
          </div>
        </div>
      )}
    </div>
  );
}
