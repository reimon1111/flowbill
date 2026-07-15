"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  FolderPlus,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Receipt,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { BillingStatusBadge } from "@/components/billing/billing-status-badge";
import { ProjectStatusBadge } from "@/components/projects/project-status-badge";
import { paymentStatusToBilling } from "@/lib/billing-status-theme";
import { Button, buttonVariants } from "@/components/ui/button";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/format";
import type {
  Customer,
  CustomerInvoiceSummary,
  CustomerProjectSummary,
} from "@/lib/types";
import { cn } from "@/lib/utils";
import { getCustomerListMeta } from "@/stores/customer-store";
import { AuditTrailPanel } from "@/components/shared/audit-trail-panel";
import { ActivityLogPanel } from "@/components/shared/activity-log-panel";
import { useCanWriteBusinessData } from "@/hooks/use-can-write-business-data";

type CustomerDetailProps = {
  customer: Customer;
  projects: CustomerProjectSummary[];
  invoices: CustomerInvoiceSummary[];
};

export function CustomerDetail({
  customer,
  projects,
  invoices,
}: CustomerDetailProps) {
  const router = useRouter();
  const canWrite = useCanWriteBusinessData();
  const meta = getCustomerListMeta(customer.id);

  return (
    <div className="mx-auto min-w-0 max-w-4xl space-y-8 px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="rounded-lg text-zinc-500"
          onClick={() => router.push("/customers")}
        >
          <ArrowLeft className="size-4" />
          戻る
        </Button>
      </div>

      <PageHeader
        title={customer.customerName}
        description={
          customer.contactName
            ? `担当: ${customer.contactName}`
            : undefined
        }
        action={
          canWrite ? (
            <div className="flex gap-2">
              <Link
                href={`/projects/new?customerId=${customer.id}`}
                className={cn(
                  buttonVariants({ variant: "outline" }),
                  "h-9 gap-2 rounded-xl"
                )}
              >
                <FolderPlus className="size-4" />
                案件を作成
              </Link>
              <Link
                href={`/customers/${customer.id}/edit`}
                className={cn(
                  buttonVariants(),
                  "h-9 gap-2 rounded-xl bg-zinc-900 text-white hover:bg-zinc-800"
                )}
              >
                <Pencil className="size-4" />
                編集
              </Link>
            </div>
          ) : undefined
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <SummaryCard label="進行中案件" value={`${meta.activeProjectCount}件`} />
        <SummaryCard
          label="未入金額"
          value={formatCurrency(meta.unpaidAmount)}
          highlight={meta.unpaidAmount > 0}
        />
        <SummaryCard
          label="最終更新"
          value={formatDateTime(customer.updatedAt)}
        />
      </div>

      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
        <h2 className="mb-6 text-lg font-semibold text-zinc-900">基本情報</h2>
        <dl className="grid gap-5 sm:grid-cols-2">
          <DetailItem icon={Building2} label="会社名" value={customer.customerName} />
          <DetailItem label="担当者" value={customer.contactName || "—"} />
          <DetailItem icon={Mail} label="メール" value={customer.email || "—"} />
          <DetailItem icon={Phone} label="電話" value={customer.phone || "—"} />
          <DetailItem
            icon={MapPin}
            label="住所"
            value={
              customer.postalCode
                ? `〒${customer.postalCode} ${customer.address}`
                : customer.address || "—"
            }
            className="sm:col-span-2"
          />
          <DetailItem
            label="請求先"
            value={customer.invoiceDestination || customer.customerName}
            className="sm:col-span-2"
          />
          {customer.memo && (
            <DetailItem
              label="メモ"
              value={customer.memo}
              className="sm:col-span-2"
            />
          )}
        </dl>

        <AuditTrailPanel audit={customer} className="mt-6" />
        <ActivityLogPanel
          targetType="customer"
          targetId={customer.id}
          className="mt-4"
        />
      </section>

      <section className="rounded-xl border border-zinc-200/80 bg-white shadow-sm shadow-zinc-900/[0.02]">
        <div className="border-b border-zinc-100 px-6 py-4">
          <h2 className="font-semibold text-zinc-900">案件一覧</h2>
          <p className="text-sm text-zinc-500">{projects.length}件</p>
        </div>
        {projects.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-zinc-500">
            案件がありません
          </div>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {projects.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/projects/${p.id}`}
                  className="flex items-center justify-between gap-4 px-6 py-4 transition-colors hover:bg-zinc-50/80"
                >
                  <div>
                    <p className="font-medium text-zinc-900">{p.projectName}</p>
                    <ProjectStatusBadge status={p.status} className="mt-2" />
                  </div>
                  <p className="text-base font-semibold tabular-nums text-zinc-900">
                    {formatCurrency(p.amount)}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-zinc-200/80 bg-white shadow-sm shadow-zinc-900/[0.02]">
        <div className="border-b border-zinc-100 px-6 py-4">
          <h2 className="font-semibold text-zinc-900">請求履歴</h2>
          <p className="text-sm text-zinc-500">{invoices.length}件</p>
        </div>
        {invoices.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-zinc-500">
            請求履歴がありません
          </div>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {invoices.map((inv) => (
              <li key={inv.id}>
                <Link
                  href={`/invoices/${inv.id}`}
                  className="flex items-center justify-between gap-4 px-6 py-4 transition-colors hover:bg-zinc-50/80"
                >
                  <div className="flex items-center gap-3">
                    <Receipt className="size-4 text-zinc-400" />
                    <div>
                      <p className="font-medium text-zinc-900">
                        {inv.invoiceNumber}
                      </p>
                      <p className="text-sm text-zinc-500">
                        {formatDate(inv.issueDate)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold tabular-nums text-zinc-900">
                      {formatCurrency(inv.amount)}
                    </p>
                    <BillingStatusBadge status={paymentStatusToBilling(inv.status)} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-xl border border-zinc-200/80 bg-white p-5 shadow-sm shadow-zinc-900/[0.02]">
      <p className="text-sm text-zinc-500">{label}</p>
      <p
        className={cn(
          "mt-1 text-xl font-semibold tabular-nums",
          highlight ? "text-amber-700" : "text-zinc-900"
        )}
      >
        {value}
      </p>
    </div>
  );
}

function DetailItem({
  icon: Icon,
  label,
  value,
  className,
}: {
  icon?: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <dt className="flex items-center gap-1.5 text-sm text-zinc-500">
        {Icon && <Icon className="size-3.5" strokeWidth={1.5} />}
        {label}
      </dt>
      <dd className="mt-1 text-base text-zinc-900">{value}</dd>
    </div>
  );
}
