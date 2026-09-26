"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { userDocumentEmailSchema } from "@/lib/validations/document-email";
import {
  fetchCurrentUserDocumentContact,
  updateCurrentUserDocumentContact,
} from "@/lib/services/user-profile-settings";
import { formatFieldErrorMessage } from "@/lib/form-error-message";

type UserDocumentSettingsFormProps = {
  /** viewer など書き込み不可のとき */
  readOnly?: boolean;
};

export function UserDocumentSettingsForm({
  readOnly = false,
}: UserDocumentSettingsFormProps) {
  const [documentContactName, setDocumentContactName] = useState("");
  const [documentEmail, setDocumentEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const value = await fetchCurrentUserDocumentContact();
        if (!cancelled) {
          setDocumentContactName(value.documentContactName);
          setDocumentEmail(value.documentEmail);
        }
      } catch (e) {
        if (!cancelled) {
          console.error("UserDocumentSettingsForm load", e);
          toast.error("個人設定の読み込みに失敗しました");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSave = async () => {
    if (readOnly || saving) return;

    const trimmedName = documentContactName.trim();
    if (trimmedName.length > 50) {
      setNameError("担当者名は50文字以内で入力してください");
      return;
    }

    const parsed = userDocumentEmailSchema.safeParse(documentEmail);
    if (!parsed.success) {
      setEmailError(
        parsed.error.issues[0]?.message ?? "入力内容を確認してください"
      );
      return;
    }
    setNameError(null);
    setEmailError(null);
    try {
      setSaving(true);
      await updateCurrentUserDocumentContact({
        documentContactName: trimmedName,
        documentEmail: parsed.data,
      });
      setDocumentContactName(trimmedName);
      setDocumentEmail(parsed.data);
      toast.success("個人設定を保存しました");
    } catch (e) {
      console.error("UserDocumentSettingsForm save", e);
      toast.error("個人設定の保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-zinc-500">
        <Loader2 className="size-4 animate-spin" />
        読み込み中...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="space-y-4">
        <div>
          <h3 className="text-base font-semibold text-zinc-900">
            帳票に表示する連絡先
          </h3>
          <p className="mt-1 text-sm text-zinc-500">
            新しく作成する帳票に表示する担当者情報です。
          </p>
        </div>

        <div className="space-y-2">
          <Label
            htmlFor="userDocumentContactName"
            className="text-sm font-medium text-zinc-700"
          >
            担当者名
          </Label>
          <Input
            id="userDocumentContactName"
            type="text"
            value={documentContactName}
            onChange={(e) => {
              setDocumentContactName(e.target.value);
              if (nameError) setNameError(null);
            }}
            disabled={readOnly}
            placeholder="例: 青木 玲門"
            className="h-11 rounded-xl border-zinc-200/80 text-base shadow-none focus-visible:ring-zinc-300"
          />
          <p className="text-xs text-zinc-500">
            未入力の場合は会社情報の担当者名を使用します。
          </p>
          {nameError ? (
            <p className="text-sm text-red-600">
              {formatFieldErrorMessage(nameError)}
            </p>
          ) : null}
        </div>

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
              if (emailError) setEmailError(null);
            }}
            disabled={readOnly}
            placeholder="例: reimon@example.com"
            className="h-11 rounded-xl border-zinc-200/80 text-base shadow-none focus-visible:ring-zinc-300"
          />
          <p className="text-xs text-zinc-500">
            未入力の場合は会社情報のメールアドレスを使用します。
          </p>
          {readOnly ? (
            <p className="text-sm text-amber-800">
              閲覧のみの権限のため、個人設定を変更できません。
            </p>
          ) : null}
          {emailError ? (
            <p className="text-sm text-red-600">
              {formatFieldErrorMessage(emailError)}
            </p>
          ) : null}
        </div>
      </section>

      {!readOnly ? (
        <div className="flex justify-end border-t border-zinc-200/80 pt-6">
          <Button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving}
            className="h-11 min-w-[160px] rounded-xl bg-zinc-900 hover:bg-zinc-800"
          >
            {saving ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                保存中...
              </>
            ) : (
              "個人設定を保存"
            )}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
