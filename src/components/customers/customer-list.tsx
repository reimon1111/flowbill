"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { CustomerCard } from "@/components/customers/customer-card";
import { DeleteConfirmDialog } from "@/components/shared/delete-confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { SearchBar } from "@/components/shared/search-bar";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { deleteCustomer } from "@/lib/services/customers";
import type { CustomerListItem } from "@/lib/types";
import { useCanWriteBusinessData } from "@/hooks/use-can-write-business-data";
import { VIEWER_WRITE_DENIED_MESSAGE } from "@/lib/guards/write-access";
import { getCustomerListMeta, useCustomerStore } from "@/stores/customer-store";

function toListItems(customers: ReturnType<typeof useCustomerStore.getState>["customers"]): CustomerListItem[] {
  return customers.map((c) => {
    const meta = getCustomerListMeta(c.id);
    return { ...c, ...meta };
  });
}

export function CustomerList() {
  const router = useRouter();
  const canWrite = useCanWriteBusinessData();
  const searchParams = useSearchParams();
  const customers = useCustomerStore((s) => s.customers);
  const [search, setSearch] = useState(searchParams.get("search") ?? "");
  const [deleteTarget, setDeleteTarget] = useState<CustomerListItem | null>(
    null
  );
  const [deleting, setDeleting] = useState(false);

  const listItems = useMemo(() => toListItems(customers), [customers]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return listItems;
    return listItems.filter(
      (c) =>
        c.customerName.toLowerCase().includes(q) ||
        c.contactName.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q)
    );
  }, [listItems, search]);

  const handleCreateProject = (customer: CustomerListItem) => {
    router.push(`/projects/new?customerId=${customer.id}`);
    toast.message("案件作成画面を開きます", { description: customer.customerName });
  };

  const handleDelete = async () => {
    if (!canWrite) {
      toast.error(VIEWER_WRITE_DENIED_MESSAGE);
      return;
    }
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteCustomer(deleteTarget.id);
      toast.success("顧客を削除しました");
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="mx-auto min-w-0 max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <PageHeader
        title="顧客"
        description={`${listItems.length}社 — 案件・見積作成時に情報が自動入力されます`}
        action={
          canWrite ? (
            <Link
              href="/customers/new"
              className={cn(
                buttonVariants({ size: "lg" }),
                "h-10 gap-2 rounded-xl bg-zinc-900 text-white hover:bg-zinc-800"
              )}
            >
              <Plus className="size-4" strokeWidth={1.5} />
              新規顧客
            </Link>
          ) : undefined
        }
      />

      <SearchBar
        value={search}
        onChange={setSearch}
        placeholder="会社名・担当者・メールで検索..."
        className="max-w-md"
      />

      {filtered.length > 0 && (
        <>
          <div className="hidden lg:block">
            <div className="mb-2 grid grid-cols-[minmax(180px,1.2fr)_minmax(100px,0.8fr)_minmax(140px,1fr)_minmax(110px,0.7fr)_minmax(160px,1fr)_minmax(80px,0.5fr)_minmax(90px,0.6fr)_minmax(100px,0.6fr)_auto] gap-3 px-5 text-xs font-medium uppercase tracking-wider text-zinc-400">
              <span>会社名</span>
              <span>担当者</span>
              <span>メール</span>
              <span>電話</span>
              <span>住所</span>
              <span>進行中</span>
              <span>未入金</span>
              <span>更新日</span>
              <span />
            </div>
            <div className="space-y-2">
              {filtered.map((customer) => (
                <CustomerCard
                  key={customer.id}
                  customer={customer}
                  variant="row"
                  onDelete={setDeleteTarget}
                  onCreateProject={handleCreateProject}
                />
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:hidden">
            {filtered.map((customer) => (
              <CustomerCard
                key={customer.id}
                customer={customer}
                variant="card"
                onDelete={setDeleteTarget}
                onCreateProject={handleCreateProject}
              />
            ))}
          </div>
        </>
      )}

      {filtered.length === 0 && (
        <EmptyState
          title={search ? "該当する顧客が見つかりません" : "顧客がまだ登録されていません"}
          description={
            search
              ? "検索条件を変えてお試しください"
              : "顧客を登録すると、案件・見積作成時に情報が自動入力されます"
          }
          action={
            !search && (
              <Link
                href="/customers/new"
                className={cn(
                  buttonVariants(),
                  "rounded-xl bg-zinc-900 text-white hover:bg-zinc-800"
                )}
              >
                <Plus className="size-4" />
                最初の顧客を登録
              </Link>
            )
          }
        />
      )}

      <DeleteConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="顧客を削除しますか？"
        description={`「${deleteTarget?.customerName}」を削除します。この操作は取り消せません。`}
        onConfirm={handleDelete}
        loading={deleting}
      />
    </div>
  );
}
