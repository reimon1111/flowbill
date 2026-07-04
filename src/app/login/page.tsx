"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { LoginForm } from "@/components/auth/login-form";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { readBrowserSession } from "@/lib/auth/browser-session";
import {
  bootstrapAuthenticatedSession,
  logSessionCheck,
} from "@/lib/auth/bootstrap-session";
import {
  extractInviteTokenFromRedirect,
  setPendingInviteToken,
} from "@/lib/auth/pending-invite-token";
import { AUTH_USER_MESSAGES, logAuthError, mapAuthErrorToUserMessage } from "@/lib/auth/errors";
import { toast } from "sonner";

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-zinc-50/30">
          <Loader2 className="size-8 animate-spin text-zinc-400" strokeWidth={1.5} />
        </div>
      }
    >
      <LoginPageContent />
    </Suspense>
  );
}

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") || "/";
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      router.replace("/");
      return;
    }

    async function checkExistingSession() {
      try {
        const session = await readBrowserSession();
        logSessionCheck(session);

        if (session?.user) {
          const inviteToken = extractInviteTokenFromRedirect(redirectTo);
          if (inviteToken) {
            setPendingInviteToken(inviteToken);
          }
          await bootstrapAuthenticatedSession(session.user, session);
          router.replace(inviteToken ? "/" : redirectTo);
        }
      } catch (error) {
        logAuthError("login page session check error", error);
        toast.error(AUTH_USER_MESSAGES.genericLoginFailed, {
          description: mapAuthErrorToUserMessage(error, "login"),
        });
      } finally {
        setChecking(false);
      }
    }

    void checkExistingSession();
  }, [router, redirectTo]);

  if (!isSupabaseConfigured()) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="size-8 animate-spin text-zinc-400" />
      </div>
    );
  }

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50/30">
        <Loader2 className="size-8 animate-spin text-zinc-400" strokeWidth={1.5} />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50/30 px-6 py-12">
      <LoginForm redirectTo={redirectTo} />
    </div>
  );
}
