"use client";

import { PageHeader } from "@/components/shared/page-header";
import { CompanySettingsForm } from "@/components/settings/company-settings-form";
import { DocumentPreviewCard } from "@/components/settings/document-preview-card";
import { useCompanySettingsStore } from "@/stores/company-settings-store";

export default function CompanySettingsPage() {
  useCompanySettingsStore((s) => s.settings);
  const settings = useCompanySettingsStore.getState().getSettings();

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-8 py-10">
      <PageHeader
        title="会社設定"
        description="ロゴ・会社印・振込先を登録して、見積書/請求書に自動反映します"
      />

      <div className="grid gap-8 lg:grid-cols-[1fr_520px] lg:items-start">
        <div className="rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-sm shadow-zinc-900/[0.03] sm:p-8">
          <CompanySettingsForm settings={settings} />
        </div>
        <div className="lg:sticky lg:top-20">
          <DocumentPreviewCard />
        </div>
      </div>
    </div>
  );
}
