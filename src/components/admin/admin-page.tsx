"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Loader2, Shield } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/shared/page-header";
import {
  adminCancelAllowedSignup,
  adminCreateAllowedSignup,
  adminListAllowedSignups,
  adminListCompanies,
  adminUpdateContractStatus,
  isCurrentUserAdmin,
} from "@/lib/services/admin";
import type { AdminCompanyRow, AllowedSignupRecord } from "@/lib/types/signup-access";
import { CONTRACT_STATUS_LABELS } from "@/lib/types/signup-access";
import { formatDate } from "@/lib/format";

export function AdminPageClient() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [signups, setSignups] = useState<AllowedSignupRecord[]>([]);
  const [companies, setCompanies] = useState<AdminCompanyRow[]>([]);
  const [email, setEmail] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [lastSignupUrl, setLastSignupUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const [s, c] = await Promise.all([
      adminListAllowedSignups(),
      adminListCompanies(),
    ]);
    setSignups(s);
    setCompanies(c);
  }, []);

  useEffect(() => {
    async function check() {
      try {
        const ok = await isCurrentUserAdmin();
        if (!ok) {
          router.replace("/");
          return;
        }
        setAllowed(true);
        await refresh();
      } catch (error) {
        console.error("admin access check", error);
        router.replace("/");
      } finally {
        setChecking(false);
      }
    }
    void check();
  }, [router, refresh]);

  const handleCreateSignup = async () => {
    if (!email.trim()) return;
    try {
      setBusy(true);
      const { signupUrl } = await adminCreateAllowedSignup({
        email: email.trim(),
        companyName: companyName.trim(),
      });
      setLastSignupUrl(signupUrl);
      setEmail("");
      setCompanyName("");
      toast.success("利用許可メールを登録しました");
      await refresh();
    } catch (error) {
      console.error("handleCreateSignup", error);
      toast.error("登録に失敗しました");
    } finally {
      setBusy(false);
    }
  };

  const handleCancel = async (id: string) => {
    try {
      setBusy(true);
      await adminCancelAllowedSignup(id);
      toast.success("許可をキャンセルしました");
      await refresh();
    } catch (error) {
      console.error("handleCancel", { id, error });
      toast.error("キャンセルに失敗しました");
    } finally {
      setBusy(false);
    }
  };

  const handleContract = async (
    companyId: string,
    status: "active" | "suspended" | "canceled"
  ) => {
    try {
      setBusy(true);
      await adminUpdateContractStatus(companyId, status);
      toast.success(
        status === "active" ? "会社を再開しました" : "会社を停止しました"
      );
      await refresh();
    } catch (error) {
      console.error("handleContract", { companyId, status, error });
      toast.error("更新に失敗しました");
    } finally {
      setBusy(false);
    }
  };

  const copyUrl = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("登録URLをコピーしました");
    } catch (error) {
      console.error("copyUrl", error);
      toast.error("コピーに失敗しました");
    }
  };

  if (checking) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="size-8 animate-spin text-zinc-400" />
      </div>
    );
  }

  if (!allowed) return null;

  return (
    <div className="mx-auto max-w-6xl space-y-10 px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <PageHeader
        title="運営管理"
        description="契約済みユーザーの登録許可・会社の利用停止"
        action={
          <div className="flex items-center gap-2 text-sm text-zinc-500">
            <Shield className="size-4" />
            管理者専用
          </div>
        }
      />

      <section className="rounded-xl border border-zinc-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-zinc-900">利用許可メールを追加</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="admin-email">メールアドレス</Label>
            <Input
              id="admin-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 rounded-xl"
            />
          </div>
          <div>
            <Label htmlFor="admin-company">会社名</Label>
            <Input
              id="admin-company"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              className="mt-1 rounded-xl"
            />
          </div>
        </div>
        <Button
          type="button"
          className="mt-4 rounded-xl bg-zinc-900 text-white hover:bg-zinc-800"
          disabled={busy || !email.trim()}
          onClick={() => void handleCreateSignup()}
        >
          登録許可を追加
        </Button>
        {lastSignupUrl ? (
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm">
            <span className="min-w-0 flex-1 truncate text-emerald-900">
              {lastSignupUrl}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void copyUrl(lastSignupUrl)}
            >
              <Copy className="size-4" />
            </Button>
          </div>
        ) : null}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">登録許可一覧</h2>
        <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-zinc-50 text-left text-xs uppercase text-zinc-500">
              <tr>
                <th className="px-4 py-3">メール</th>
                <th className="px-4 py-3">会社名</th>
                <th className="px-4 py-3">状態</th>
                <th className="px-4 py-3">登録URL</th>
                <th className="px-4 py-3 text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              {signups.map((row) => {
                const url =
                  typeof window !== "undefined"
                    ? `${window.location.origin}/signup?token=${row.token}`
                    : `/signup?token=${row.token}`;
                return (
                  <tr key={row.id} className="border-t border-zinc-100">
                    <td className="px-4 py-3">{row.email}</td>
                    <td className="px-4 py-3">{row.companyName || "—"}</td>
                    <td className="px-4 py-3">{row.status}</td>
                    <td className="px-4 py-3">
                      {row.status === "pending" ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => void copyUrl(url)}
                        >
                          <Copy className="size-3.5" />
                          URL
                        </Button>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {row.status === "pending" ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-red-600"
                          disabled={busy}
                          onClick={() => void handleCancel(row.id)}
                        >
                          取消
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">会社一覧</h2>
        <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-zinc-50 text-left text-xs uppercase text-zinc-500">
              <tr>
                <th className="px-4 py-3">会社名</th>
                <th className="px-4 py-3">契約</th>
                <th className="px-4 py-3">メンバー</th>
                <th className="px-4 py-3">作成日</th>
                <th className="px-4 py-3 text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              {companies.map((c) => (
                <tr key={c.id} className="border-t border-zinc-100">
                  <td className="px-4 py-3">{c.companyName}</td>
                  <td className="px-4 py-3">
                    {CONTRACT_STATUS_LABELS[c.contractStatus]}
                  </td>
                  <td className="px-4 py-3">{c.memberCount}</td>
                  <td className="px-4 py-3 text-zinc-500">
                    {formatDate(c.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      {c.contractStatus !== "active" ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={() => void handleContract(c.id, "active")}
                        >
                          再開
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="text-red-600"
                          disabled={busy}
                          onClick={() => void handleContract(c.id, "suspended")}
                        >
                          停止
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
