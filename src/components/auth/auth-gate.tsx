"use client";

import { useCallback, useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import type { Session } from "@supabase/supabase-js";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import {
  bootstrapAuthenticatedSession,
  isUserAlreadyBootstrapped,
  logSessionCheck,
} from "@/lib/auth/bootstrap-session";
import { readBrowserSession } from "@/lib/auth/browser-session";
import { clearCompanyContext } from "@/lib/db/company-context";
import { clearAllBusinessStores } from "@/lib/stores/clear-business-stores";
import { toDbErrorMessage } from "@/lib/db/errors";
import { useAppDataStore } from "@/stores/app-data-store";
import { useAuthStore } from "@/stores/auth-store";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const supabaseEnabled = isSupabaseConfigured();
  const isLoading = useAuthStore((s) => s.isLoading);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const sessionChecked = useAuthStore((s) => s.sessionChecked);
  const profileError = useAuthStore((s) => s.profileError);
  const user = useAuthStore((s) => s.user);
  const handlingRef = useRef(false);

  const handleSession = useCallback(
    async (session: Session | null, options?: { silent?: boolean }) => {
      const silent = options?.silent ?? false;

      if (!session?.user) {
        useAuthStore.getState().setUser(null);
        useAuthStore.getState().setBootstrappedUserId(null);
        useAuthStore.getState().setSessionChecked(true);
        useAuthStore.getState().setLoading(false);
        if (pathname !== "/login") {
          router.replace("/login");
        }
        return;
      }

      const alreadyBootstrapped = isUserAlreadyBootstrapped(session.user.id);

      if (alreadyBootstrapped) {
        useAuthStore.getState().setUser(session.user);
        useAuthStore.getState().setSessionChecked(true);
        useAuthStore.getState().setLoading(false);
        return;
      }

      if (handlingRef.current) return;
      handlingRef.current = true;

      if (!silent) {
        useAuthStore.getState().setLoading(true);
      }
      logSessionCheck(session);

      try {
        await bootstrapAuthenticatedSession(session.user, session);
      } catch (error) {
        toast.error("初期設定に失敗しました", {
          description: toDbErrorMessage(error),
        });
      } finally {
        useAuthStore.getState().setSessionChecked(true);
        useAuthStore.getState().setLoading(false);
        handlingRef.current = false;
      }
    },
    [pathname, router]
  );

  const retryBootstrap = useCallback(async () => {
    if (!user) return;
    useAuthStore.getState().setProfileError(null);
    useAuthStore.getState().setBootstrappedUserId(null);
    useAuthStore.getState().setLoading(true);
    try {
      await bootstrapAuthenticatedSession(user);
      toast.success("初期設定が完了しました");
    } catch (error) {
      toast.error("再試行に失敗しました", {
        description: toDbErrorMessage(error),
      });
    } finally {
      useAuthStore.getState().setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!supabaseEnabled) {
      useAuthStore.getState().setSessionChecked(true);
      useAuthStore.getState().setLoading(false);
      return;
    }

    const supabase = getSupabaseBrowserClient();

    void readBrowserSession().then((session) => {
      void handleSession(session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "INITIAL_SESSION") return;

      if (event === "SIGNED_OUT") {
        clearCompanyContext();
        clearAllBusinessStores();
        useAppDataStore.getState().resetForInit();
        useAuthStore.getState().reset();
        router.replace("/login");
        return;
      }

      if (event === "TOKEN_REFRESHED" && session?.user) {
        if (isUserAlreadyBootstrapped(session.user.id)) {
          useAuthStore.getState().setUser(session.user);
          return;
        }
        void handleSession(session, { silent: true });
        return;
      }

      if (session?.user && event === "SIGNED_IN") {
        const prevUserId = useAuthStore.getState().user?.id;
        if (prevUserId && prevUserId !== session.user.id) {
          clearAllBusinessStores();
          useAppDataStore.getState().resetForInit();
          useAuthStore.getState().setBootstrappedUserId(null);
        }
        void handleSession(session);
      }
    });

    return () => subscription.unsubscribe();
  }, [supabaseEnabled, handleSession, router]);

  if (!supabaseEnabled) {
    return <>{children}</>;
  }

  if (profileError) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-50/30 p-6">
        <div className="max-w-md rounded-xl border border-red-200 bg-white p-6 shadow-sm">
          <p className="font-semibold text-red-700">初期設定に失敗しました</p>
          <p className="mt-2 text-sm text-zinc-600">{profileError}</p>
          <p className="mt-3 text-xs text-zinc-500">
            新規環境: <code className="text-zinc-700">supabase/schema-full.sql</code>
            <br />
            既存環境の更新: README の「既存環境をアップデートする場合」を参照
          </p>
          <button
            type="button"
            onClick={retryBootstrap}
            className="mt-4 w-full rounded-xl bg-zinc-900 py-2.5 text-sm font-medium text-white hover:bg-zinc-800"
          >
            再試行
          </button>
        </div>
      </div>
    );
  }

  const showInitialAuthLoader =
    !sessionChecked || (isLoading && !isAuthenticated);

  if (showInitialAuthLoader) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-50/30">
        <Loader2 className="size-8 animate-spin text-zinc-400" strokeWidth={1.5} />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-50/30">
        <Loader2 className="size-8 animate-spin text-zinc-400" strokeWidth={1.5} />
      </div>
    );
  }

  return <>{children}</>;
}
