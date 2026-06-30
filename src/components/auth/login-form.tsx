"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Session, User } from "@supabase/supabase-js";
import { profileSetupHint } from "@/lib/auth/ensure-profile";
import {
  AUTH_USER_MESSAGES,
  isEmailNotConfirmedError,
  logAuthError,
  validateLoginInput,
} from "@/lib/auth/errors";
import {
  resendSignupConfirmation,
  signInWithEmail,
} from "@/lib/auth/session";
import { bootstrapAuthenticatedSession } from "@/lib/auth/bootstrap-session";

export function LoginForm({ redirectTo = "/" }: { redirectTo?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [emailConfirmMessage, setEmailConfirmMessage] = useState<string | null>(
    null
  );
  const [resending, setResending] = useState(false);

  async function handleResendConfirmation() {
    const targetEmail = email.trim();
    if (!targetEmail) {
      setFormError(AUTH_USER_MESSAGES.emailRequired);
      toast.error(AUTH_USER_MESSAGES.emailRequired);
      return;
    }

    setResending(true);
    setFormError(null);

    try {
      const result = await resendSignupConfirmation(targetEmail);
      if (!result.ok) {
        setFormError(result.message);
        toast.error("確認メールの再送に失敗しました", {
          description: result.message,
        });
        return;
      }

      setEmailConfirmMessage(
        `${AUTH_USER_MESSAGES.emailNotConfirmed}（確認メールを再送しました）`
      );
      toast.success("確認メールを再送しました", {
        description: "迷惑メールフォルダもご確認ください",
      });
    } catch (err) {
      logAuthError("resend confirmation unexpected error", err);
      setFormError(AUTH_USER_MESSAGES.networkError);
      toast.error(AUTH_USER_MESSAGES.networkError);
    } finally {
      setResending(false);
    }
  }

  async function goToApp(user: User, session: Session) {
    await bootstrapAuthenticatedSession(user, session);
    router.push(redirectTo);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setEmailConfirmMessage(null);
    setFormError(null);

    const validationError = validateLoginInput(email, password);
    if (validationError) {
      setFormError(validationError);
      toast.error(validationError);
      return;
    }

    setLoading(true);

    try {
      const result = await signInWithEmail(email.trim(), password);

      if (!result.ok) {
        if (isEmailNotConfirmedError(result.rawError)) {
          setEmailConfirmMessage(AUTH_USER_MESSAGES.emailNotConfirmed);
          toast.error("メール確認が必要です", {
            description:
              "確認メールのリンクを開いてからログインしてください。",
          });
          return;
        }

        setFormError(result.message);
        toast.error(result.message);
        return;
      }

      if (!result.data.session?.user) {
        setFormError(AUTH_USER_MESSAGES.sessionMissing);
        toast.error(AUTH_USER_MESSAGES.sessionMissing);
        return;
      }

      try {
        await goToApp(result.data.session.user, result.data.session);
        toast.success("ログインしました");
      } catch (err) {
        logAuthError("ensureProfile / bootstrap error", err);
        const message = "初期設定に失敗しました";
        setFormError(message);
        toast.error(message, {
          description:
            profileSetupHint(err) ||
            "しばらくしてから再度お試しください。",
        });
      }
    } catch (err) {
      logAuthError("login unexpected error", err);
      setFormError(AUTH_USER_MESSAGES.networkError);
      toast.error(AUTH_USER_MESSAGES.networkError);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-sm">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl bg-zinc-900">
          <span className="text-lg font-bold text-white">F</span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
          FlowBill
        </h1>
        <p className="mt-1 text-sm text-zinc-500">受発注・見積・請求管理</p>
      </div>

      {emailConfirmMessage && (
        <div className="mb-4 space-y-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p>{emailConfirmMessage}</p>
          <Button
            type="button"
            variant="outline"
            disabled={resending || !email.trim()}
            onClick={handleResendConfirmation}
            className="h-9 w-full rounded-lg border-amber-300 bg-white text-amber-950 hover:bg-amber-100"
          >
            {resending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              "確認メールを再送"
            )}
          </Button>
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="space-y-5 rounded-xl border border-zinc-200/80 bg-white p-6 shadow-sm shadow-zinc-900/[0.03]"
      >
        {formError ? (
          <div
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          >
            {formError}
          </div>
        ) : null}

        <div className="space-y-2">
          <Label htmlFor="email" className="text-sm font-medium text-zinc-700">
            メールアドレス
          </Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (formError) setFormError(null);
            }}
            placeholder="you@example.com"
            className="h-11 rounded-xl border-zinc-200/80"
          />
        </div>

        <div className="space-y-2">
          <Label
            htmlFor="password"
            className="text-sm font-medium text-zinc-700"
          >
            パスワード
          </Label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (formError) setFormError(null);
            }}
            placeholder="パスワード"
            className="h-11 rounded-xl border-zinc-200/80"
          />
        </div>

        <Button
          type="submit"
          disabled={loading}
          className="h-11 w-full rounded-xl bg-zinc-900 text-white hover:bg-zinc-800"
        >
          {loading ? <Loader2 className="size-4 animate-spin" /> : "ログイン"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-zinc-500">
        初めてご利用の方は{" "}
        <Link href="/signup" className="font-medium text-zinc-900 hover:underline">
          新規登録
        </Link>
      </p>

      <p className="mt-3 text-center text-xs text-zinc-400">
        ログインすると、あなたの会社データのみにアクセスできます
      </p>
    </div>
  );
}
