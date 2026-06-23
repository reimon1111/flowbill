"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { LoginForm } from "@/components/auth/login-form";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import {
  bootstrapAuthenticatedSession,
  logSessionCheck,
} from "@/lib/auth/bootstrap-session";
import { toDbErrorMessage } from "@/lib/db/errors";
import { toast } from "sonner";

export default function LoginPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      router.replace("/");
      return;
    }

    const supabase = getSupabaseBrowserClient();

    async function checkExistingSession() {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        logSessionCheck(session);

        if (session?.user) {
          await bootstrapAuthenticatedSession(session.user, session);
          router.replace("/");
        }
      } catch (error) {
        console.error("login page session check error", error);
        toast.error("セッションの確認に失敗しました", {
          description: toDbErrorMessage(error),
        });
      } finally {
        setChecking(false);
      }
    }

    void checkExistingSession();
  }, [router]);

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
      <LoginForm />
    </div>
  );
}
