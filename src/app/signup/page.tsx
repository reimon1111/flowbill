"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { assertSignupAllowed } from "@/lib/services/signup-access";
import { signUpWithEmail } from "@/lib/auth/session";
import { bootstrapAuthenticatedSession } from "@/lib/auth/bootstrap-session";
import { profileSetupHint } from "@/lib/auth/ensure-profile";
import {
  AUTH_USER_MESSAGES,
  logAuthError,
  MIN_PASSWORD_LENGTH,
  validateSignupInput,
} from "@/lib/auth/errors";

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inviteToken = searchParams.get("invite") ?? undefined;
  const allowedToken = searchParams.get("token") ?? undefined;
  const redirectTo = searchParams.get("redirect") ?? "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [emailConfirmMessage, setEmailConfirmMessage] = useState<string | null>(
    null
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setEmailConfirmMessage(null);
    setFormError(null);

    const validationError = validateSignupInput(
      email,
      password,
      confirmPassword
    );
    if (validationError) {
      setFormError(validationError);
      toast.error(validationError);
      return;
    }

    setLoading(true);

    try {
      const allowed = await assertSignupAllowed(email.trim(), {
        inviteToken,
        allowedToken,
      });

      if (!allowed.ok) {
        setFormError(allowed.message);
        toast.error(allowed.message);
        return;
      }

      const result = await signUpWithEmail(email.trim(), password);

      if (!result.ok) {
        setFormError(result.message);
        toast.error(result.message);
        return;
      }

      const data = result.data;

      if (!data.session?.user) {
        const message =
          "メール確認が必要です。確認メールのリンクから登録を完了してください。";
        setEmailConfirmMessage(message);
        toast.info("メール確認が必要です");
        return;
      }

      try {
        await bootstrapAuthenticatedSession(data.session.user, data.session);
      } catch (err) {
        logAuthError("signup bootstrap error", { email, inviteToken, err });
        const message = "初期設定に失敗しました";
        setFormError(message);
        toast.error(message, {
          description:
            profileSetupHint(err) ||
            "しばらくしてから再度お試しください。",
        });
        return;
      }

      if (inviteToken) {
        router.replace(`/invite/${inviteToken}`);
        return;
      }

      toast.success("アカウントを作成しました");
      router.replace(redirectTo);
    } catch (err) {
      logAuthError("signup unexpected error", {
        email,
        inviteToken,
        allowedToken,
        err,
      });
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
          新規登録
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          ご契約済みのメールアドレス、または招待URLから登録できます
        </p>
      </div>

      {inviteToken ? (
        <p className="mb-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
          会社招待経由の登録です。招待メールと同じアドレスで登録してください。
        </p>
      ) : null}

      {emailConfirmMessage ? (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {emailConfirmMessage}
        </div>
      ) : null}

      <form
        onSubmit={handleSubmit}
        className="space-y-5 rounded-xl border border-zinc-200/80 bg-white p-6 shadow-sm"
      >
        {formError ? (
          <div
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 whitespace-pre-line"
          >
            {formError}
          </div>
        ) : null}

        <div className="space-y-2">
          <Label htmlFor="email">メールアドレス</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (formError) setFormError(null);
            }}
            className="h-11 rounded-xl"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">パスワード</Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (formError) setFormError(null);
            }}
            placeholder={`${MIN_PASSWORD_LENGTH}文字以上`}
            className="h-11 rounded-xl"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirmPassword">パスワード（確認）</Label>
          <Input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => {
              setConfirmPassword(e.target.value);
              if (formError) setFormError(null);
            }}
            placeholder="もう一度入力"
            className="h-11 rounded-xl"
          />
        </div>
        <Button
          type="submit"
          disabled={loading}
          className="h-11 w-full rounded-xl bg-zinc-900 text-white hover:bg-zinc-800"
        >
          {loading ? <Loader2 className="size-4 animate-spin" /> : "アカウントを作成"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-zinc-500">
        すでにアカウントをお持ちの方は{" "}
        <Link href="/login" className="font-medium text-zinc-900 hover:underline">
          ログイン
        </Link>
      </p>
    </div>
  );
}

export default function SignupPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50/30 px-6 py-12">
      <Suspense
        fallback={
          <Loader2 className="size-8 animate-spin text-zinc-400" strokeWidth={1.5} />
        }
      >
        <SignupForm />
      </Suspense>
    </div>
  );
}
