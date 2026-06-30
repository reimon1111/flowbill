"use client";

import { useMemo, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { BankAccountForm } from "@/components/settings/bank-account-form";
import type { BankAccountInput } from "@/lib/commercial-document";
import { formatSupabaseError } from "@/lib/db/errors";
import {
  addBankAccount,
  deleteBankAccount,
  formatBankAccountOptionLabel,
  updateBankAccount,
} from "@/lib/services/bank-accounts";
import { useBankAccountStore } from "@/stores/bank-account-store";

const emptyInput = (): BankAccountInput => ({
  label: "",
  bankName: "",
  bankBranch: "",
  bankAccountType: "普通",
  bankAccountNumber: "",
  bankAccountHolder: "",
  sortOrder: 0,
});

export function BankAccountsManager({ readOnly }: { readOnly?: boolean }) {
  const bankAccounts = useBankAccountStore((s) => s.bankAccounts);
  const sorted = useMemo(
    () =>
      [...bankAccounts].sort(
        (a, b) =>
          a.createdAt.localeCompare(b.createdAt) ||
          a.bankName.localeCompare(b.bankName, "ja")
      ),
    [bankAccounts]
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<BankAccountInput>(emptyInput());
  const [saving, setSaving] = useState(false);

  const startAdd = () => {
    if (readOnly) {
      toast.error("会社情報を変更する権限がありません");
      return;
    }
    setEditingId("new");
    setDraft({
      ...emptyInput(),
      sortOrder: sorted.length,
    });
  };

  const startEdit = (id: string) => {
    if (readOnly) {
      toast.error("会社情報を変更する権限がありません");
      return;
    }
    const account = useBankAccountStore.getState().getById(id);
    if (!account) return;
    setEditingId(id);
    setDraft({
      label: "",
      bankName: account.bankName,
      bankBranch: account.bankBranch,
      bankAccountType: account.bankAccountType,
      bankAccountNumber: account.bankAccountNumber,
      bankAccountHolder: account.bankAccountHolder,
      sortOrder: account.sortOrder,
    });
  };

  const cancel = () => {
    setEditingId(null);
    setDraft(emptyInput());
  };

  const save = async () => {
    if (readOnly) {
      toast.error("会社情報を変更する権限がありません");
      return;
    }
    if (!draft.bankName.trim()) {
      toast.error("銀行名を入力してください");
      return;
    }
    const input: BankAccountInput = {
      label: "",
      bankName: draft.bankName.trim(),
      bankBranch: draft.bankBranch.trim(),
      bankAccountType: draft.bankAccountType.trim() || "普通",
      bankAccountNumber: draft.bankAccountNumber.trim(),
      bankAccountHolder: draft.bankAccountHolder.trim(),
      sortOrder: draft.sortOrder,
    };

    setSaving(true);
    try {
      if (editingId === "new") {
        await addBankAccount(input);
        toast.success("口座を追加しました");
      } else if (editingId) {
        const updated = await updateBankAccount(editingId, input);
        if (!updated) {
          toast.error("口座が見つかりません");
          return;
        }
        toast.success("口座を更新しました");
      }
      cancel();
    } catch (error) {
      toast.error(formatSupabaseError(error));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (readOnly) {
      toast.error("会社情報を変更する権限がありません");
      return;
    }
    setSaving(true);
    try {
      const ok = await deleteBankAccount(id);
      if (!ok) return;
      toast.success("口座を削除しました");
      if (editingId === id) cancel();
    } catch (error) {
      toast.error(formatSupabaseError(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {sorted.length === 0 && editingId !== "new" ? (
        <p className="text-sm text-zinc-500">
          まだ口座が登録されていません。請求書作成時に選択できるよう、口座を追加してください。
        </p>
      ) : (
        <ul className="space-y-2">
          {sorted.map((account) => (
            <li
              key={account.id}
              className="flex items-start justify-between gap-3 rounded-xl border border-zinc-200/80 bg-white px-4 py-3"
            >
              <div className="min-w-0">
                <p className="font-medium text-zinc-900">
                  {formatBankAccountOptionLabel(account)}
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8 rounded-lg"
                  disabled={saving || readOnly}
                  onClick={() => startEdit(account.id)}
                >
                  <Pencil className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8 rounded-lg text-red-600 hover:bg-red-50 hover:text-red-700"
                  disabled={saving || readOnly}
                  onClick={() => remove(account.id)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {editingId ? (
        <div className="rounded-xl border border-zinc-200/80 bg-zinc-50/50 p-5">
          <p className="mb-4 text-sm font-medium text-zinc-900">
            {editingId === "new" ? "口座を追加" : "口座を編集"}
          </p>
          <BankAccountForm
            values={draft}
            onChange={(patch) => setDraft((d) => ({ ...d, ...patch }))}
          />
          <div className="mt-4 flex gap-2">
            <Button
              type="button"
              className="h-9 rounded-xl bg-zinc-900 hover:bg-zinc-800"
              disabled={saving || readOnly}
              onClick={() => void save()}
            >
              保存
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-9 rounded-xl"
              disabled={saving}
              onClick={cancel}
            >
              キャンセル
            </Button>
          </div>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          className="h-9 gap-2 rounded-xl"
          disabled={saving || readOnly}
          onClick={startAdd}
        >
          <Plus className="size-4" />
          口座を追加
        </Button>
      )}
    </div>
  );
}
