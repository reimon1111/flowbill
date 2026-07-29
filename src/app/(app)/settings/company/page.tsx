"use client";

import Link from "next/link";
import { useEffect, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { CompanySettingsForm } from "@/components/settings/company-settings-form";
import { DocumentPreviewCard } from "@/components/settings/document-preview-card";
import { MembersManager } from "@/components/settings/members-manager";
import { UserDocumentSettingsForm } from "@/components/settings/user-document-settings-form";
import { useCompanySettingsStore } from "@/stores/company-settings-store";
import { useCompanyMembershipStore } from "@/stores/company-membership-store";
import {
  canManageMembers,
  canWriteBusinessData,
} from "@/lib/types/company-membership";
import { cn } from "@/lib/utils";

type TabId = "company" | "personal" | "members";

function normalizeTabParam(raw: string | null): TabId | "info" | null {
  if (!raw) return null;
  if (raw === "info" || raw === "company" || raw === "personal" || raw === "members") {
    return raw;
  }
  return null;
}

export default function CompanySettingsPage() {
  useCompanySettingsStore((s) => s.settings);
  const settings = useCompanySettingsStore.getState().getSettings();
  const searchParams = useSearchParams();
  const router = useRouter();
  const role = useCompanyMembershipStore((s) => s.currentRole);
  const canManage = canManageMembers(role);
  const canWritePersonal = canWriteBusinessData(role);

  const rawTab = normalizeTabParam(searchParams.get("tab"));

  const activeTab: TabId = useMemo(() => {
    if (!canManage) return "personal";
    if (rawTab === "info" || rawTab === "company") return "company";
    if (rawTab === "personal") return "personal";
    if (rawTab === "members") return "members";
    return "company";
  }, [canManage, rawTab]);

  const manageTabs = useMemo(
    () =>
      [
        { id: "company" as const, label: "会社情報" },
        { id: "personal" as const, label: "個人設定" },
        { id: "members" as const, label: "メンバー管理" },
      ] as const,
    []
  );

  useEffect(() => {
    if (!canManage) {
      // member / viewer: 会社情報・メンバー管理へ直接アクセスしても個人設定へ
      if (rawTab === "company" || rawTab === "info" || rawTab === "members") {
        toast.error("この画面にアクセスする権限がありません");
        router.replace("/settings/company?tab=personal");
        return;
      }
      if (rawTab == null) {
        router.replace("/settings/company?tab=personal");
      }
      return;
    }

    // owner / admin: 旧 ?tab=info を company へ正規化
    if (rawTab === "info") {
      router.replace("/settings/company?tab=company");
      return;
    }
    if (rawTab == null) {
      router.replace("/settings/company?tab=company");
    }
  }, [canManage, rawTab, router]);

  const pageDescription = canManage
    ? "会社情報・個人設定・メンバー管理"
    : "帳票に表示する連絡先など";

  return (
    <div className="mx-auto min-w-0 max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <PageHeader title="設定" description={pageDescription} />

      {canManage ? (
        <div className="flex gap-2 border-b border-zinc-200">
          {manageTabs.map((item) => (
            <Link
              key={item.id}
              href={`/settings/company?tab=${item.id}`}
              className={cn(
                "border-b-2 px-4 py-2 text-sm font-medium transition-colors",
                activeTab === item.id
                  ? "border-zinc-900 text-zinc-900"
                  : "border-transparent text-zinc-500 hover:text-zinc-800"
              )}
            >
              {item.label}
            </Link>
          ))}
        </div>
      ) : null}

      {activeTab === "members" && canManage ? (
        <MembersManager />
      ) : null}

      {activeTab === "company" && canManage ? (
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(280px,520px)] lg:items-start">
          <div className="rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-sm shadow-zinc-900/[0.03] sm:p-8">
            <h2 className="mb-6 text-lg font-semibold text-zinc-900">会社情報</h2>
            <CompanySettingsForm settings={settings} />
          </div>
          <div className="lg:sticky lg:top-20">
            <DocumentPreviewCard />
          </div>
        </div>
      ) : null}

      {activeTab === "personal" ? (
        <div className="mx-auto max-w-3xl">
          <div className="rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-sm shadow-zinc-900/[0.03] sm:p-8">
            <h2 className="mb-2 text-lg font-semibold text-zinc-900">個人設定</h2>
            <p className="mb-6 text-sm text-zinc-500">
              ログイン中のあなたに紐づく設定です。会社情報とは別に保存されます。
            </p>
            <UserDocumentSettingsForm readOnly={!canWritePersonal} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
