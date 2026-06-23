"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { Session, User } from "@supabase/supabase-js";
import { profileSetupHint } from "@/lib/auth/ensure-profile";
import {
  isEmailNotConfirmedError,
  toAuthErrorMessage,
} from "@/lib/auth/errors";
import {
  resendSignupConfirmation,
  signInWithEmail,
  signUpWithEmail,
} from "@/lib/auth/session";
import { bootstrapAuthenticatedSession } from "@/lib/auth/bootstrap-session";
import { toDbErrorMessage } from "@/lib/db/errors";

type Mode = "signin" | "signup";

export function LoginForm() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [emailConfirmMessage, setEmailConfirmMessage] = useState<string | null>(
    null
  );
  const [resending, setResending] = useState(false);

  const emailNotConfirmedMessage =
    "メールアドレスが未確認です。受信トレイの確認メールのリンクを開いてから、再度ログインしてください。";

  async function handleResendConfirmation() {
    const targetEmail = email.trim();
    if (!targetEmail) {
      toast.error("メールアドレスを入力してください");
      return;
    }

    setResending(true);
    try {
      await resendSignupConfirmation(targetEmail);
      setEmailConfirmMessage(
        `${emailNotConfirmedMessage}（確認メールを再送しました）`
      );
      toast.success("確認メールを再送しました", {
        description: "迷惑メールフォルダもご確認ください",
      });
    } catch (err) {
      console.error("resend confirmation error", err);
      toast.error("確認メールの再送に失敗しました", {
        description: toAuthErrorMessage(err),
      });
    } finally {
      setResending(false);
    }
  }

  async function goToApp(user: User, session: Session) {
    await bootstrapAuthenticatedSession(user, session);
    router.push("/");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setEmailConfirmMessage(null);
    setLoading(true);
    let phase: "auth" | "bootstrap" = "auth";

    try {
      if (mode === "signin") {
        const data = await signInWithEmail(email.trim(), password);

        phase = "bootstrap";

        if (!data.session?.user) {
          toast.error("セッションを取得できませんでした。再度お試しください。");
          return;
        }

        await goToApp(data.session.user, data.session);
        toast.success("ログインしました");
      } else {
        const data = await signUpWithEmail(email.trim(), password);

        phase = "bootstrap";

        if (!data.session?.user) {
          const message = "メール確認が必要です。確認メールのリンクから登録を完了してください。";
          setEmailConfirmMessage(message);
          toast.info("メール確認が必要です", {
            description: "確認メールをご確認ください",
          });
          return;
        }

        await goToApp(data.session.user, data.session);
        toast.success("アカウントを作成しました");
      }
    } catch (err) {
      const isBootstrapFailure = phase === "bootstrap";

      if (isBootstrapFailure) {
        console.error("ensureProfile / bootstrap error", err);
      } else {
        console.error(mode === "signin" ? "signIn error" : "signUp error", err);
      }

      if (isEmailNotConfirmedError(err)) {
        setEmailConfirmMessage(emailNotConfirmedMessage);
        toast.error("メール確認が必要です", {
          description: "確認メールのリンクを開いてからログインしてください",
        });
        return;
      }

      const message =
        err && typeof err === "object" && "message" in err
          ? toAuthErrorMessage(err)
          : toDbErrorMessage(err);

      const hint = isBootstrapFailure ? profileSetupHint(err) : undefined;
      toast.error(
        isBootstrapFailure ? "初期設定に失敗しました" : mode === "signin" ? "ログインに失敗しました" : "登録に失敗しました",
        { description: hint ? `${message}\n${hint}` : message }
      );
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

      <div className="mb-6 flex rounded-xl bg-zinc-100 p-1">
        <button
          type="button"
          onClick={() => {
            setMode("signin");
            setEmailConfirmMessage(null);
          }}
          className={cn(
            "flex-1 rounded-lg py-2 text-sm font-medium transition-colors",
            mode === "signin"
              ? "bg-white text-zinc-900 shadow-sm"
              : "text-zinc-500 hover:text-zinc-700"
          )}
        >
          ログイン
        </button>
        <button
          type="button"
          onClick={() => {
            setMode("signup");
            setEmailConfirmMessage(null);
          }}
          className={cn(
            "flex-1 rounded-lg py-2 text-sm font-medium transition-colors",
            mode === "signup"
              ? "bg-white text-zinc-900 shadow-sm"
              : "text-zinc-500 hover:text-zinc-700"
          )}
        >
          新規登録
        </button>
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
        <div className="space-y-2">
          <Label htmlFor="email" className="text-sm font-medium text-zinc-700">
            メールアドレス
          </Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
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
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="6文字以上"
            className="h-11 rounded-xl border-zinc-200/80"
          />
        </div>

        <Button
          type="submit"
          disabled={loading}
          className="h-11 w-full rounded-xl bg-zinc-900 text-white hover:bg-zinc-800"
        >
          {loading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : mode === "signin" ? (
            "ログイン"
          ) : (
            "アカウントを作成"
          )}
        </Button>
      </form>

      <p className="mt-6 text-center text-xs text-zinc-400">
        ログインすると、あなたの会社データのみにアクセスできます
      </p>
    </div>
  );
}
