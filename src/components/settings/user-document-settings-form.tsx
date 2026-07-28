"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useState,
} from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { userDocumentEmailSchema } from "@/lib/validations/document-email";
import {
  fetchCurrentUserDocumentEmail,
  updateCurrentUserDocumentEmail,
} from "@/lib/services/user-profile-settings";
import { formatFieldErrorMessage } from "@/lib/form-error-message";
import type { SettingsSectionHandle } from "@/components/settings/settings-section-handle";

export const UserDocumentSettingsForm = forwardRef<SettingsSectionHandle>(
  function UserDocumentSettingsForm(_props, ref) {
    const [documentEmail, setDocumentEmail] = useState("");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
      let cancelled = false;
      (async () => {
        try {
          const value = await fetchCurrentUserDocumentEmail();
          if (!cancelled) setDocumentEmail(value);
        } catch (e) {
          if (!cancelled) {
            console.error("UserDocumentSettingsForm load", e);
            toast.error("担当者設定の読み込みに失敗しました");
          }
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, []);

    useImperativeHandle(ref, () => ({
      save: async () => {
        const parsed = userDocumentEmailSchema.safeParse(documentEmail);
        if (!parsed.success) {
          const message =
            parsed.error.issues[0]?.message ?? "入力内容を確認してください";
          setError(message);
          return { ok: false, reason: "validation", message };
        }
        setError(null);
        try {
          await updateCurrentUserDocumentEmail(parsed.data);
          return { ok: true };
        } catch (e) {
          console.error("UserDocumentSettingsForm save", e);
          return {
            ok: false,
            reason: "error",
            message: "担当者設定の保存に失敗しました",
          };
        }
      },
    }));

    if (loading) {
      return (
        <div className="flex items-center gap-2 text-sm text-zinc-500">
          <Loader2 className="size-4 animate-spin" />
          読み込み中...
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <Label
            htmlFor="userDocumentEmail"
            className="text-sm font-medium text-zinc-700"
          >
            帳票用メールアドレス
          </Label>
          <Input
            id="userDocumentEmail"
            type="email"
            value={documentEmail}
            onChange={(e) => {
              setDocumentEmail(e.target.value);
              if (error) setError(null);
            }}
            placeholder="例: tanaka@example.com"
            className="h-11 rounded-xl border-zinc-200/80 text-base shadow-none focus-visible:ring-zinc-300"
          />
          <p className="text-xs text-zinc-500">
            未入力の場合は会社設定のメールアドレスを使用します。
          </p>
          {error ? (
            <p className="text-sm text-red-600">
              {formatFieldErrorMessage(error)}
            </p>
          ) : null}
        </div>
      </div>
    );
  }
);
