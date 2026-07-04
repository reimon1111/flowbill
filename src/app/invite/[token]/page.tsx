"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import {
  acceptCompanyInvitation,
  fetchPublicInvitationByToken,
  isActiveMemberOfCompany,
} from "@/lib/services/company-membership";
import { reloadAfterCompanyJoin } from "@/lib/services/company-switch";
import { formatDate } from "@/lib/format";
import { COMPANY_INVITATION_ROLE_LABELS } from "@/lib/types/company-membership";
import { logAuthError } from "@/lib/auth/errors";

export default function InviteAcceptPage() {
  const params = useParams();
  const router = useRouter();
  const tokenRaw = typeof params.token === "string" ? params.token : "";
  const token = (() => {
    try {
      return decodeURIComponent(tokenRaw);
    } catch {
      return tokenRaw;
    }
  })();

  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState<string | null>(null);
  const [inviteRole, setInviteRole] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!token) {
        if (!cancelled) {
          setError("招待が存在しません");
          setLoading(false);
        }
        return;
      }

      try {
        if (!isSupabaseConfigured()) {
          if (!cancelled) setError("Supabase が未設定です");
          return;
        }

        const supabase = getSupabaseBrowserClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!cancelled) setIsLoggedIn(Boolean(user));

        const invitation = await fetchPublicInvitationByToken(token);
        if (!invitation) {
          if (!cancelled) setError("招待が存在しません");
          return;
        }
        if (invitation.acceptedAt) {
          if (user && (await isActiveMemberOfCompany(invitation.companyId, user.id))) {
            if (!cancelled) {
              toast.success("すでにこの会社のメンバーです");
              router.replace("/");
            }
            return;
          }
          if (!cancelled) setError("すでに承認済みです");
          return;
        }
        if (new Date(invitation.expiresAt) < new Date()) {
          if (!cancelled) setError("招待の有効期限が切れています");
          return;
        }

        if (!cancelled) {
          setCompanyName(invitation.companyName);
          setInviteEmail(invitation.email);
          setInviteRole(COMPANY_INVITATION_ROLE_LABELS[invitation.role]);
          setExpiresAt(invitation.expiresAt);
        }
      } catch (e) {
        logAuthError("InviteAcceptPage load", e);
        if (!cancelled) setError("招待情報の取得に失敗しました");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleAccept = async () => {
    try {
      setAccepting(true);
      await acceptCompanyInvitation(token);
      await reloadAfterCompanyJoin();
      toast.success("会社に参加しました");
      router.replace("/");
    } catch (e) {
      logAuthError("InviteAcceptPage accept", e);
      const message = e instanceof Error ? e.message : "参加に失敗しました";
      toast.error(message);
      setError(message);
    } finally {
      setAccepting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="size-8 animate-spin text-zinc-400" />
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-6 py-12">
      <PageHeader title="会社への招待" description="招待を確認して参加してください" />

      {error ? (
        <div className="mt-8 rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-800">
          {error}
        </div>
      ) : (
        <div className="mt-8 space-y-4 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          {companyName ? (
            <p className="text-sm text-zinc-600">
              会社: <span className="font-medium text-zinc-900">{companyName}</span>
            </p>
          ) : null}
          <p className="text-sm text-zinc-600">
            招待メール: <span className="font-medium text-zinc-900">{inviteEmail}</span>
          </p>
          <p className="text-sm text-zinc-600">
            権限: <span className="font-medium text-zinc-900">{inviteRole}</span>
          </p>
          {expiresAt ? (
            <p className="text-sm text-zinc-500">有効期限: {formatDate(expiresAt)}</p>
          ) : null}

          {!isLoggedIn ? (
            <div className="space-y-3 pt-2">
              <p className="text-sm text-zinc-600">
                参加するには、招待されたメールアドレスでログインまたは新規登録してください。
              </p>
              <Link
                href={`/login?redirect=${encodeURIComponent(`/invite/${token}`)}`}
                className="inline-flex h-10 w-full items-center justify-center rounded-xl border border-zinc-200 bg-white text-sm font-medium text-zinc-900 hover:bg-zinc-50"
              >
                ログイン
              </Link>
              <Link
                href={`/signup?invite=${encodeURIComponent(token)}`}
                className="inline-flex h-10 w-full items-center justify-center rounded-xl bg-zinc-900 text-sm font-medium text-white hover:bg-zinc-800"
              >
                新規登録（招待経由）
              </Link>
            </div>
          ) : (
            <Button
              type="button"
              className="mt-2 w-full rounded-xl bg-zinc-900 text-white hover:bg-zinc-800"
              disabled={accepting}
              onClick={() => void handleAccept()}
            >
              {accepting ? <Loader2 className="size-4 animate-spin" /> : null}
              招待を受け入れる
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
