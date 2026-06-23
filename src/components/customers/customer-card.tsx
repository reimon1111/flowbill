"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Mail,
  MapPin,
  MoreHorizontal,
  Pencil,
  Phone,
  Trash2,
  FolderPlus,
} from "lucide-react";
import type { CustomerListItem } from "@/lib/types";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type CustomerCardProps = {
  customer: CustomerListItem;
  onDelete: (customer: CustomerListItem) => void;
  onCreateProject: (customer: CustomerListItem) => void;
  variant?: "card" | "row";
};

export function CustomerCard({
  customer,
  onDelete,
  onCreateProject,
  variant = "card",
}: CustomerCardProps) {
  if (variant === "row") {
    return (
      <CustomerRow
        customer={customer}
        onDelete={onDelete}
        onCreateProject={onCreateProject}
      />
    );
  }

  return (
    <article className="flex flex-col rounded-xl border border-zinc-200/80 bg-white p-5 shadow-sm shadow-zinc-900/[0.02]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            href={`/customers/${customer.id}`}
            className="truncate text-lg font-semibold text-zinc-900 hover:underline"
          >
            {customer.customerName}
          </Link>
          {customer.contactName && (
            <p className="mt-0.5 text-sm text-zinc-500">
              {customer.contactName}
            </p>
          )}
        </div>
        <CustomerActions
          customer={customer}
          onDelete={onDelete}
          onCreateProject={onCreateProject}
        />
      </div>

      <div className="mt-4 space-y-2 text-sm text-zinc-600">
        {customer.email && (
          <Row icon={Mail} text={customer.email} />
        )}
        {customer.phone && (
          <Row icon={Phone} text={customer.phone} />
        )}
        {customer.address && (
          <Row icon={MapPin} text={customer.address} />
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-zinc-100 pt-4 text-sm">
        <Stat label="進行中" value={`${customer.activeProjectCount}件`} />
        <Stat
          label="未入金"
          value={formatCurrency(customer.unpaidAmount)}
          highlight={customer.unpaidAmount > 0}
        />
        <span className="ml-auto text-zinc-400">
          更新 {formatDateTime(customer.updatedAt)}
        </span>
      </div>

      <div className="mt-4 flex gap-2">
        <Button
          variant="outline"
          size="sm"
          className="flex-1 rounded-lg"
          onClick={() => onCreateProject(customer)}
        >
          <FolderPlus className="size-3.5" />
          案件を作成
        </Button>
        <Link
          href={`/customers/${customer.id}/edit`}
          className="inline-flex h-7 items-center justify-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
        >
          <Pencil className="size-3.5" />
          編集
        </Link>
      </div>
    </article>
  );
}

function CustomerRow({
  customer,
  onDelete,
  onCreateProject,
}: CustomerCardProps) {
  return (
    <article className="group grid grid-cols-1 gap-4 rounded-xl border border-zinc-200/80 bg-white px-5 py-4 shadow-sm shadow-zinc-900/[0.02] transition-shadow hover:shadow-md hover:shadow-zinc-900/[0.04] lg:grid-cols-[minmax(180px,1.2fr)_minmax(100px,0.8fr)_minmax(140px,1fr)_minmax(110px,0.7fr)_minmax(160px,1fr)_minmax(80px,0.5fr)_minmax(90px,0.6fr)_minmax(100px,0.6fr)_auto] lg:items-center lg:gap-3">
      <div className="min-w-0">
        <Link
          href={`/customers/${customer.id}`}
          className="font-medium text-zinc-900 hover:underline"
        >
          {customer.customerName}
        </Link>
        <p className="truncate text-sm text-zinc-500 lg:hidden">
          {customer.contactName || "—"}
        </p>
      </div>
      <p className="hidden truncate text-sm text-zinc-600 lg:block">
        {customer.contactName || "—"}
      </p>
      <p className="hidden truncate text-sm text-zinc-600 lg:block">
        {customer.email || "—"}
      </p>
      <p className="hidden text-sm text-zinc-600 lg:block">
        {customer.phone || "—"}
      </p>
      <p className="hidden truncate text-sm text-zinc-600 lg:block">
        {customer.address || "—"}
      </p>
      <p className="hidden text-sm tabular-nums text-zinc-600 lg:block">
        {customer.activeProjectCount}件
      </p>
      <p
        className={cn(
          "hidden text-sm tabular-nums lg:block",
          customer.unpaidAmount > 0
            ? "font-medium text-amber-700"
            : "text-zinc-600"
        )}
      >
        {formatCurrency(customer.unpaidAmount)}
      </p>
      <p className="hidden text-sm text-zinc-400 lg:block">
        {formatDateTime(customer.updatedAt)}
      </p>
      <div className="flex items-center gap-2 lg:justify-end">
        <Button
          variant="outline"
          size="sm"
          className="hidden rounded-lg lg:inline-flex"
          onClick={() => onCreateProject(customer)}
        >
          案件作成
        </Button>
        <CustomerActions
          customer={customer}
          onDelete={onDelete}
          onCreateProject={onCreateProject}
        />
      </div>
    </article>
  );
}

function CustomerActions({
  customer,
  onDelete,
  onCreateProject,
}: Pick<CustomerCardProps, "customer" | "onDelete" | "onCreateProject">) {
  const router = useRouter();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex size-8 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
        aria-label="メニュー"
      >
        <MoreHorizontal className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="rounded-xl">
        <DropdownMenuItem
          className="lg:hidden"
          onClick={() => onCreateProject(customer)}
        >
          <FolderPlus className="size-4" />
          案件を作成
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => router.push(`/customers/${customer.id}`)}
        >
          詳細を見る
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => router.push(`/customers/${customer.id}/edit`)}
        >
          <Pencil className="size-4" />
          編集
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onClick={() => onDelete(customer)}
        >
          <Trash2 className="size-4" />
          削除
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Row({
  icon: Icon,
  text,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  text: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="size-4 shrink-0 text-zinc-400" strokeWidth={1.5} />
      <span className="truncate">{text}</span>
    </div>
  );
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div>
      <p className="text-xs text-zinc-400">{label}</p>
      <p
        className={cn(
          "font-medium tabular-nums",
          highlight ? "text-amber-700" : "text-zinc-700"
        )}
      >
        {value}
      </p>
    </div>
  );
}
