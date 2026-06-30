"use client";

import { useState } from "react";
import { Copy, Loader2, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  COMPANY_INVITATION_ROLE_LABELS,
  COMPANY_MEMBER_ROLE_LABELS,
  canManageMembers,
  type CompanyInvitationRole,
  type CompanyMemberRole,
} from "@/lib/types/company-membership";
import {
  cancelCompanyInvitation,
  createCompanyInvitation,
  fetchCompanyMembers,
  fetchPendingInvitations,
  removeCompanyMember,
  updateCompanyMemberRole,
} from "@/lib/services/company-membership";
import { useCompanyMembershipStore } from "@/stores/company-membership-store";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { formatDate } from "@/lib/format";

const INVITE_ROLES: CompanyInvitationRole[] = ["admin", "member", "viewer"];
const EDITABLE_ROLES: CompanyMemberRole[] = ["admin", "member", "viewer"];

export function MembersManager() {
  const members = useCompanyMembershipStore((s) => s.members);
  const pendingInvitations = useCompanyMembershipStore((s) => s.pendingInvitations);
  const currentRole = useCompanyMembershipStore((s) => s.currentRole);
  const canManage = canManageMembers(currentRole);

  const [email, setEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<CompanyInvitationRole>("member");
  const [inviting, setInviting] = useState(false);
  const [lastInviteUrl, setLastInviteUrl] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = async () => {
    const [nextMembers, nextInvites] = await Promise.all([
      fetchCompanyMembers(),
      fetchPendingInvitations(),
    ]);
    const supabase = getSupabaseBrowserClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    useCompanyMembershipStore.getState().hydrate({
      companies: useCompanyMembershipStore.getState().companies,
      members: nextMembers,
      pendingInvitations: nextInvites,
      currentRole:
        nextMembers.find((m) => m.userId === user?.id)?.role ?? currentRole,
    });
  };

  const handleInvite = async () => {
    const trimmed = email.trim();
    if (!trimmed) return;
    try {
      setInviting(true);
      const { inviteUrl } = await createCompanyInvitation({
        email: trimmed,
        role: inviteRole,
      });
      setLastInviteUrl(inviteUrl);
      setEmail("");
      toast.success("招待しました");
      await refresh();
    } catch (error) {
      console.error("handleInvite", { email: trimmed, error });
      toast.error("招待に失敗しました");
    } finally {
      setInviting(false);
    }
  };

  const handleRoleChange = async (memberId: string, role: CompanyMemberRole) => {
    try {
      setBusyId(memberId);
      await updateCompanyMemberRole(memberId, role);
      toast.success("メンバーを更新しました");
      await refresh();
    } catch (error) {
      console.error("handleRoleChange", { memberId, role, error });
      toast.error("メンバー更新に失敗しました");
    } finally {
      setBusyId(null);
    }
  };

  const handleRemove = async (memberId: string) => {
    try {
      setBusyId(memberId);
      await removeCompanyMember(memberId);
      toast.success("メンバーを削除しました");
      await refresh();
    } catch (error) {
      console.error("handleRemove", { memberId, error });
      toast.error("メンバー削除に失敗しました");
    } finally {
      setBusyId(null);
    }
  };

  const handleCancelInvite = async (invitationId: string) => {
    try {
      setBusyId(invitationId);
      await cancelCompanyInvitation(invitationId);
      toast.success("招待をキャンセルしました");
      await refresh();
    } catch (error) {
      console.error("handleCancelInvite", { invitationId, error });
      toast.error("招待のキャンセルに失敗しました");
    } finally {
      setBusyId(null);
    }
  };

  const copyInviteUrl = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("招待URLをコピーしました");
    } catch (error) {
      console.error("copyInviteUrl", error);
      toast.error("コピーに失敗しました");
    }
  };

  if (!canManage) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-6 text-sm text-zinc-600">
        メンバー管理はオーナーまたは管理者のみ利用できます。
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section className="rounded-xl border border-zinc-200/80 bg-white p-6">
        <h3 className="text-lg font-semibold text-zinc-900">メンバーを招待</h3>
        <p className="mt-1 text-sm text-zinc-500">
          メールアドレスを入力して招待URLを発行します（メール送信は未実装のためURLをコピーして共有してください）
        </p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <Input
            type="email"
            placeholder="example@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-xl"
          />
          <Select
            value={inviteRole}
            onValueChange={(v) => setInviteRole(v as CompanyInvitationRole)}
          >
            <SelectTrigger className="w-full rounded-xl sm:w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {INVITE_ROLES.map((role) => (
                <SelectItem key={role} value={role}>
                  {COMPANY_INVITATION_ROLE_LABELS[role]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            onClick={() => void handleInvite()}
            disabled={inviting || !email.trim()}
            className="rounded-xl bg-zinc-900 text-white hover:bg-zinc-800"
          >
            {inviting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <UserPlus className="size-4" />
            )}
            招待する
          </Button>
        </div>
        {lastInviteUrl ? (
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm">
            <span className="min-w-0 flex-1 truncate text-emerald-900">
              {lastInviteUrl}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0 rounded-lg"
              onClick={() => void copyInviteUrl(lastInviteUrl)}
            >
              <Copy className="size-4" />
              コピー
            </Button>
          </div>
        ) : null}
      </section>

      <section>
        <h3 className="mb-3 text-lg font-semibold text-zinc-900">メンバー一覧</h3>
        <div className="overflow-x-auto rounded-xl border border-zinc-200/80 bg-white">
          <table className="min-w-[640px] w-full text-sm">
            <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wider text-zinc-500">
              <tr>
                <th className="px-4 py-3">メール</th>
                <th className="px-4 py-3">権限</th>
                <th className="px-4 py-3">参加日</th>
                <th className="px-4 py-3 text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              {members.map((member) => (
                <tr key={member.id} className="border-t border-zinc-100">
                  <td className="px-4 py-3">{member.email || member.userId}</td>
                  <td className="px-4 py-3">
                    {member.role === "owner" ? (
                      COMPANY_MEMBER_ROLE_LABELS.owner
                    ) : (
                      <Select
                        value={member.role}
                        onValueChange={(v) =>
                          void handleRoleChange(member.id, v as CompanyMemberRole)
                        }
                        disabled={busyId === member.id}
                      >
                        <SelectTrigger className="h-8 w-32 rounded-lg">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {EDITABLE_ROLES.map((role) => (
                            <SelectItem key={role} value={role}>
                              {COMPANY_MEMBER_ROLE_LABELS[role]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </td>
                  <td className="px-4 py-3 text-zinc-500">
                    {formatDate(member.joinedAt)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {member.role !== "owner" ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-red-600 hover:bg-red-50 hover:text-red-700"
                        disabled={busyId === member.id}
                        onClick={() => void handleRemove(member.id)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {pendingInvitations.length > 0 ? (
        <section>
          <h3 className="mb-3 text-lg font-semibold text-zinc-900">招待中</h3>
          <div className="space-y-2">
            {pendingInvitations.map((invite) => (
              <div
                key={invite.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-200/80 bg-white px-4 py-3"
              >
                <div>
                  <p className="font-medium text-zinc-900">{invite.email}</p>
                  <p className="text-xs text-zinc-500">
                    {COMPANY_INVITATION_ROLE_LABELS[invite.role]} / 期限{" "}
                    {formatDate(invite.expiresAt)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-lg"
                    onClick={() =>
                      void copyInviteUrl(
                        `${window.location.origin}/invite/${invite.token}`
                      )
                    }
                  >
                    <Copy className="size-4" />
                    URL
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-red-600"
                    disabled={busyId === invite.id}
                    onClick={() => void handleCancelInvite(invite.id)}
                  >
                    キャンセル
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
