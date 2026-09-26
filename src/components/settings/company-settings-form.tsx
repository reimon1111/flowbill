"use client";

import { useEffect } from "react";
import { useForm, useWatch, type FieldErrors } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Building2, CalendarClock, CreditCard, FileText, GitBranch, ImageIcon, PanelLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { BankAccountsManager } from "@/components/settings/bank-accounts-manager";
import { ImageUploadField } from "@/components/settings/image-upload-field";
import type { CompanySettings } from "@/lib/types";
import { useCompanyMembershipStore } from "@/stores/company-membership-store";
import { canManageMembers } from "@/lib/types/company-membership";
import {
  companySettingsSchema,
  type CompanySettingsFormValues,
} from "@/lib/validations/company-settings";
import { updateCompanySettings } from "@/lib/services/company-settings";
import { formatSupabaseError, logSupabaseError } from "@/lib/db/errors";
import {
  firstFormErrorMessage,
  formatFieldErrorMessage,
} from "@/lib/form-error-message";
import {
  DEFAULT_QUOTE_EXPIRY_TYPE,
  QUOTE_EXPIRY_PERIOD_OPTIONS,
} from "@/lib/quote-expiry";
import {
  DEFAULT_WORKFLOW_MODE,
  WORKFLOW_MODE_OPTIONS,
  WORKFLOW_MODE_SETTINGS_HINT,
  normalizeWorkflowMode,
} from "@/lib/workflow-mode";

export function CompanySettingsForm({
  settings,
}: {
  settings: CompanySettings;
}) {
  const currentRole = useCompanyMembershipStore((s) => s.currentRole);
  const canEdit = canManageMembers(currentRole);

  const form = useForm<CompanySettingsFormValues>({
    resolver: zodResolver(companySettingsSchema),
    defaultValues: {
      companyName: settings.companyName,
      postalCode: settings.postalCode,
      address: settings.address,
      phone: settings.phone,
      fax: settings.fax ?? "",
      contactName: settings.contactName ?? "",
      email: settings.email,
      invoiceNumber: settings.invoiceNumber ?? "",
      bankName: settings.bankName,
      bankBranch: settings.bankBranch,
      bankAccountType: settings.bankAccountType,
      bankAccountNumber: settings.bankAccountNumber,
      bankAccountHolder: settings.bankAccountHolder,
      logoUrl: settings.logoUrl,
      stampUrl: settings.stampUrl,
      signatureUrl: settings.signatureUrl,
      quoteDefaultExpiryType:
        settings.quoteDefaultExpiryType ?? DEFAULT_QUOTE_EXPIRY_TYPE,
      paymentTerms: settings.paymentTerms ?? "",
      quoteMemoTemplate: settings.quoteMemoTemplate ?? "",
      invoiceMemoTemplate: settings.invoiceMemoTemplate ?? "",
      orderMemoTemplate: settings.orderMemoTemplate ?? "",
      deliveryNoteMemoTemplate: settings.deliveryNoteMemoTemplate ?? "",
      receiptMemoTemplate: settings.receiptMemoTemplate ?? "",
      showDocumentManagement: settings.showDocumentManagement !== false,
      workflowMode: normalizeWorkflowMode(
        settings.workflowMode ?? DEFAULT_WORKFLOW_MODE
      ),
    },
  });

  useEffect(() => {
    form.reset({
      companyName: settings.companyName,
      postalCode: settings.postalCode,
      address: settings.address,
      phone: settings.phone,
      fax: settings.fax ?? "",
      contactName: settings.contactName ?? "",
      email: settings.email,
      invoiceNumber: settings.invoiceNumber ?? "",
      bankName: settings.bankName,
      bankBranch: settings.bankBranch,
      bankAccountType: settings.bankAccountType,
      bankAccountNumber: settings.bankAccountNumber,
      bankAccountHolder: settings.bankAccountHolder,
      logoUrl: settings.logoUrl,
      stampUrl: settings.stampUrl,
      signatureUrl: settings.signatureUrl,
      quoteDefaultExpiryType:
        settings.quoteDefaultExpiryType ?? DEFAULT_QUOTE_EXPIRY_TYPE,
      paymentTerms: settings.paymentTerms ?? "",
      quoteMemoTemplate: settings.quoteMemoTemplate ?? "",
      invoiceMemoTemplate: settings.invoiceMemoTemplate ?? "",
      orderMemoTemplate: settings.orderMemoTemplate ?? "",
      deliveryNoteMemoTemplate: settings.deliveryNoteMemoTemplate ?? "",
      receiptMemoTemplate: settings.receiptMemoTemplate ?? "",
      showDocumentManagement: settings.showDocumentManagement !== false,
      workflowMode: normalizeWorkflowMode(
        settings.workflowMode ?? DEFAULT_WORKFLOW_MODE
      ),
    });
  }, [settings, form]);

  const onSubmit = async (values: CompanySettingsFormValues) => {
    if (!canEdit) {
      toast.error("会社情報を変更する権限がありません");
      return;
    }
    try {
      await updateCompanySettings(values);
      toast.success("会社情報を保存しました");
    } catch (error) {
      logSupabaseError("updateCompanySettings", error);
      const description =
        error instanceof Error
          ? error.message
          : formatSupabaseError(error);
      toast.error("会社情報の保存に失敗しました", {
        description: description || formatSupabaseError(error),
      });
    }
  };

  const onInvalid = (errors: FieldErrors<CompanySettingsFormValues>) => {
    toast.error("入力内容を確認してください", {
      description: firstFormErrorMessage(errors),
    });
  };

  const values = useWatch({ control: form.control }) ?? form.getValues();

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit, onInvalid)}
      className="space-y-8"
    >
      <p className="text-sm text-zinc-500">
        見積書・請求書のプレビューに自動反映されます
      </p>

      <Section
        icon={Building2}
        title="基本情報"
        description="書類のヘッダーに表示されます"
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="会社名 *" className="sm:col-span-2">
            <Input
              {...form.register("companyName")}
              className="h-11 rounded-xl text-base"
              disabled={!canEdit}
            />
            {form.formState.errors.companyName?.message && (
              <p className="mt-2 text-sm text-red-600">
                {formatFieldErrorMessage(form.formState.errors.companyName.message)}
              </p>
            )}
          </Field>
          <Field label="郵便番号">
            <Input
              {...form.register("postalCode")}
              className="h-11 rounded-xl text-base"
              disabled={!canEdit}
            />
          </Field>
          <Field label="住所" className="sm:col-span-2">
            <Input
              {...form.register("address")}
              className="h-11 rounded-xl text-base"
              disabled={!canEdit}
            />
          </Field>
          <Field label="電話番号">
            <Input
              {...form.register("phone")}
              className="h-11 rounded-xl text-base"
              disabled={!canEdit}
            />
          </Field>
          <Field label="FAX">
            <Input
              {...form.register("fax")}
              className="h-11 rounded-xl text-base"
              disabled={!canEdit}
            />
          </Field>
          <Field label="担当者名">
            <Input
              {...form.register("contactName")}
              placeholder="帳票に表示する担当者名"
              className="h-11 rounded-xl text-base"
              disabled={!canEdit}
            />
          </Field>
          <Field label="メール">
            <Input
              {...form.register("email")}
              type="email"
              className="h-11 rounded-xl text-base"
              disabled={!canEdit}
            />
            {form.formState.errors.email?.message && (
              <p className="mt-2 text-sm text-red-600">
                {formatFieldErrorMessage(form.formState.errors.email.message)}
              </p>
            )}
          </Field>
          <Field label="インボイス登録番号（任意）" className="sm:col-span-2">
            <Input
              {...form.register("invoiceNumber")}
              placeholder="T1234567890123"
              className="h-11 rounded-xl text-base"
              disabled={!canEdit}
            />
          </Field>
        </div>
      </Section>

      <Separator className="bg-zinc-200/80" />

      <Section
        icon={CalendarClock}
        title="見積のデフォルト"
        description="見積作成時の有効期限の初期値です（作成画面で変更できます）"
      >
        <Field label="見積書のデフォルト有効期限">
          <select
            {...form.register("quoteDefaultExpiryType")}
            className="h-11 w-full max-w-xs rounded-xl border border-zinc-200 bg-white px-3 text-base text-zinc-800 shadow-sm focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-200/80"
            disabled={!canEdit}
          >
            {QUOTE_EXPIRY_PERIOD_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <p className="mt-2 text-xs text-zinc-500">
            見積作成時の有効期限の初期値です（作成画面で変更できます）
          </p>
          {form.formState.errors.quoteDefaultExpiryType?.message && (
            <p className="mt-2 text-sm text-red-600">
              {formatFieldErrorMessage(
                form.formState.errors.quoteDefaultExpiryType.message
              )}
            </p>
          )}
        </Field>
      </Section>

      <Separator className="bg-zinc-200/80" />

      <Section
        icon={CreditCard}
        title="支払い条件"
        description="各書類作成時のデフォルト値になります（書類ごとに個別編集できます）"
      >
        <Field label="支払い条件（デフォルト）">
          <Input
            {...form.register("paymentTerms")}
            placeholder="例: 請求書発行後14日以内"
            className="h-11 max-w-xl rounded-xl text-base"
            disabled={!canEdit}
          />
        </Field>
      </Section>

      <Separator className="bg-zinc-200/80" />

      <Section
        icon={FileText}
        title="備考テンプレート"
        description="書類を新規作成したときの備考欄の初期値になります（各書類で編集できます）"
      >
        <div className="grid gap-5">
          <Field label="見積書の備考（デフォルト）">
            <Textarea
              {...form.register("quoteMemoTemplate")}
              rows={3}
              className="min-h-[80px] rounded-xl border-zinc-200/80 text-base"
              disabled={!canEdit}
            />
          </Field>
          <Field label="注文書の備考（デフォルト）">
            <Textarea
              {...form.register("orderMemoTemplate")}
              rows={3}
              className="min-h-[80px] rounded-xl border-zinc-200/80 text-base"
              disabled={!canEdit}
            />
          </Field>
          <Field label="納品書の備考（デフォルト）">
            <Textarea
              {...form.register("deliveryNoteMemoTemplate")}
              rows={3}
              className="min-h-[80px] rounded-xl border-zinc-200/80 text-base"
              disabled={!canEdit}
            />
          </Field>
          <Field label="請求書の備考（デフォルト）">
            <Textarea
              {...form.register("invoiceMemoTemplate")}
              rows={3}
              placeholder="例: お振込手数料はご負担願います。"
              className="min-h-[80px] rounded-xl border-zinc-200/80 text-base"
              disabled={!canEdit}
            />
          </Field>
          <Field label="領収書の備考（デフォルト）">
            <Textarea
              {...form.register("receiptMemoTemplate")}
              rows={3}
              className="min-h-[80px] rounded-xl border-zinc-200/80 text-base"
              disabled={!canEdit}
            />
          </Field>
        </div>
      </Section>

      <Separator className="bg-zinc-200/80" />

      <Section
        icon={GitBranch}
        title="業務フロー"
        description="新しく作成する案件のデフォルト業務フローを選びます"
      >
        <fieldset className="space-y-3" disabled={!canEdit}>
          <legend className="sr-only">業務フロー</legend>
          {WORKFLOW_MODE_OPTIONS.map((option) => (
            <label
              key={option.value}
              className="flex cursor-pointer items-start gap-3 rounded-xl border border-zinc-200/80 bg-white px-4 py-3 has-[:checked]:border-zinc-400 has-[:checked]:ring-1 has-[:checked]:ring-zinc-200"
            >
              <input
                type="radio"
                className="mt-1 size-4 accent-zinc-900"
                checked={
                  (values.workflowMode ?? DEFAULT_WORKFLOW_MODE) ===
                  option.value
                }
                onChange={() =>
                  form.setValue("workflowMode", option.value, {
                    shouldDirty: true,
                    shouldValidate: true,
                  })
                }
                disabled={!canEdit}
              />
              <span>
                <span className="block text-sm font-medium text-zinc-900">
                  {option.label}
                </span>
                <span className="mt-0.5 block text-xs text-zinc-500">
                  {option.description}
                </span>
              </span>
            </label>
          ))}
          <p className="text-xs text-zinc-500">{WORKFLOW_MODE_SETTINGS_HINT}</p>
        </fieldset>
      </Section>

      <Separator className="bg-zinc-200/80" />

      <Section
        icon={PanelLeft}
        title="書類管理メニュー"
        description="案件詳細だけで帳票管理を行う場合、左メニューの「書類管理」を非表示にできます"
      >
        <fieldset className="space-y-3" disabled={!canEdit}>
          <legend className="sr-only">書類管理メニューの表示</legend>
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-zinc-200/80 bg-white px-4 py-3 has-[:checked]:border-zinc-400 has-[:checked]:ring-1 has-[:checked]:ring-zinc-200">
            <input
              type="radio"
              className="mt-1 size-4 accent-zinc-900"
              checked={values.showDocumentManagement !== false}
              onChange={() =>
                form.setValue("showDocumentManagement", true, {
                  shouldDirty: true,
                  shouldValidate: true,
                })
              }
              disabled={!canEdit}
            />
            <span>
              <span className="block text-sm font-medium text-zinc-900">
                表示する
              </span>
              <span className="mt-0.5 block text-xs text-zinc-500">
                左サイドバーに見積・注文・納品・請求・領収を表示します
              </span>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-zinc-200/80 bg-white px-4 py-3 has-[:checked]:border-zinc-400 has-[:checked]:ring-1 has-[:checked]:ring-zinc-200">
            <input
              type="radio"
              className="mt-1 size-4 accent-zinc-900"
              checked={values.showDocumentManagement === false}
              onChange={() =>
                form.setValue("showDocumentManagement", false, {
                  shouldDirty: true,
                  shouldValidate: true,
                })
              }
              disabled={!canEdit}
            />
            <span>
              <span className="block text-sm font-medium text-zinc-900">
                表示しない
              </span>
              <span className="mt-0.5 block text-xs text-zinc-500">
                サイドバーから隠します。案件詳細や URL
                直アクセスからの操作はこれまでどおり使えます
              </span>
            </span>
          </label>
        </fieldset>
      </Section>

      <Separator className="bg-zinc-200/80" />

      <Section
        icon={CreditCard}
        title="振込口座"
        description="複数登録できます。請求書作成時に表示する口座を選択できます"
      >
        <BankAccountsManager readOnly={!canEdit} />
      </Section>

      <Separator className="bg-zinc-200/80" />

      <Section
        icon={ImageIcon}
        title="画像"
        description="アップロード後すぐプレビューできます。会社印は帳票右側の自社情報付近に表示されます"
      >
        <div className="grid gap-5 sm:grid-cols-3">
          <ImageUploadField
            label="ロゴ"
            description="横長ロゴ想定（書類左上）"
            recommended="横600px × 縦200px"
            value={values.logoUrl ?? null}
            onChange={(next) => form.setValue("logoUrl", next, { shouldDirty: true })}
            disabled={!canEdit}
          />
          <ImageUploadField
            label="会社印"
            description="自社情報エリアに重ねて表示"
            recommended="500px × 500px（PNG透過推奨）"
            highlight
            value={values.stampUrl ?? null}
            onChange={(next) => form.setValue("stampUrl", next, { shouldDirty: true })}
            disabled={!canEdit}
          />
          <ImageUploadField
            label="署名"
            description="必要な人だけ（未登録OK）"
            value={values.signatureUrl ?? null}
            onChange={(next) =>
              form.setValue("signatureUrl", next, { shouldDirty: true })
            }
            disabled={!canEdit}
          />
        </div>
      </Section>

      <div className="flex justify-end border-t border-zinc-200/80 pt-6">
        <Button
          type="submit"
          className="h-11 min-w-[160px] rounded-xl bg-zinc-900 hover:bg-zinc-800"
          disabled={form.formState.isSubmitting || !canEdit}
        >
          {form.formState.isSubmitting ? "保存中..." : "会社情報を保存"}
        </Button>
      </div>
    </form>
  );
}

function Section({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-6">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex size-9 items-center justify-center rounded-xl bg-zinc-100 text-zinc-500">
          <Icon className="size-4.5" strokeWidth={1.5} />
        </div>
        <div>
          <h3 className="text-base font-semibold text-zinc-900">{title}</h3>
          <p className="mt-0.5 text-sm text-zinc-500">{description}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <Label className="mb-2 block text-sm font-medium text-zinc-700">
        {label}
      </Label>
      {children}
    </div>
  );
}

