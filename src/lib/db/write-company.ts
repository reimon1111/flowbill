import type { CompanySettings } from "@/lib/types";
import type { CompanySettingsFormValues } from "@/lib/validations/company-settings";
import { getSupabaseClient } from "@/lib/supabase/client";
import { fetchCompanySettings, resolveCompanyId } from "@/lib/db/company-context";
import {
  companyFromRow,
  companyToUpdateRow,
  type CompanyRow,
} from "@/lib/db/mappers";
import {
  isMissingCompanyDocumentSettingsColumns,
  isMissingCompanyFaxContactColumns,
  isMissingQuoteDefaultExpiryTypeColumn,
  logSupabaseError,
  toUserFacingDbError,
} from "@/lib/db/errors";
import { expiryTypeToLegacyDays } from "@/lib/quote-expiry";

const MAX_IMAGE_DATA_URL_CHARS = 800_000;

function assertImageDataUrlSize(url: string | null, label: string) {
  if (!url?.startsWith("data:")) return;
  if (url.length > MAX_IMAGE_DATA_URL_CHARS) {
    throw new Error(
      `${label}の画像が大きすぎます（600KB程度以下に圧縮してから再度アップロードしてください）。`
    );
  }
}

export async function dbUpdateCompanySettings(
  values: CompanySettingsFormValues
): Promise<CompanySettings> {
  assertImageDataUrlSize(values.logoUrl, "ロゴ");
  assertImageDataUrlSize(values.stampUrl, "会社印");
  assertImageDataUrlSize(values.signatureUrl, "署名");

  const current = await fetchCompanySettings();
  const now = new Date().toISOString();
  const updated: CompanySettings = {
    ...current,
    companyName: values.companyName.trim(),
    postalCode: values.postalCode.trim(),
    address: values.address.trim(),
    phone: values.phone.trim(),
    fax: values.fax.trim(),
    contactName: values.contactName.trim(),
    email: values.email.trim(),
    invoiceNumber: values.invoiceNumber?.trim() ?? "",
    bankName: values.bankName.trim(),
    bankBranch: values.bankBranch.trim(),
    bankAccountType: values.bankAccountType.trim(),
    bankAccountNumber: values.bankAccountNumber.trim(),
    bankAccountHolder: values.bankAccountHolder.trim(),
    logoUrl: values.logoUrl,
    stampUrl: values.stampUrl,
    signatureUrl: values.signatureUrl,
    quoteDefaultExpiryType: values.quoteDefaultExpiryType,
    quoteValidityDays: expiryTypeToLegacyDays(values.quoteDefaultExpiryType),
    paymentTerms: (values.paymentTerms ?? "").trim(),
    quoteMemoTemplate: (values.quoteMemoTemplate ?? "").trim(),
    invoiceMemoTemplate: (values.invoiceMemoTemplate ?? "").trim(),
    orderMemoTemplate: (values.orderMemoTemplate ?? "").trim(),
    deliveryNoteMemoTemplate: (values.deliveryNoteMemoTemplate ?? "").trim(),
    receiptMemoTemplate: (values.receiptMemoTemplate ?? "").trim(),
    updatedAt: now,
  };

  await resolveCompanyId();
  const supabase = getSupabaseClient();
  const payload = companyToUpdateRow(updated);

  let { data, error } = await supabase
    .from("companies")
    .update(payload)
    .eq("id", updated.id)
    .select()
    .single();

  let skippedFaxContactColumns = false;
  let skippedDocumentSettingsColumns = false;

  if (error && isMissingCompanyFaxContactColumns(error)) {
    const legacyPayload = { ...payload };
    delete legacyPayload.fax;
    delete legacyPayload.contact_name;
    const retry = await supabase
      .from("companies")
      .update(legacyPayload)
      .eq("id", updated.id)
      .select()
      .single();
    data = retry.data;
    error = retry.error;
    skippedFaxContactColumns = !error;
    if (skippedFaxContactColumns) {
      console.warn(
        "companies.fax / contact_name が未作成のため、FAX・担当者名以外を保存しました。supabase/patch-company-settings.sql を実行してください。"
      );
    }
  }

  if (error && isMissingQuoteDefaultExpiryTypeColumn(error)) {
    const legacyPayload = { ...payload };
    delete legacyPayload.quote_default_expiry_type;
    const retry = await supabase
      .from("companies")
      .update(legacyPayload)
      .eq("id", updated.id)
      .select()
      .single();
    data = retry.data;
    error = retry.error;
    if (!error) {
      console.warn(
        "companies.quote_default_expiry_type が未作成のため、日数互換列のみ保存しました。supabase/patch-company-settings.sql を実行してください。"
      );
    }
  }

  if (error && isMissingCompanyDocumentSettingsColumns(error)) {
    const legacyPayload = { ...payload };
    delete legacyPayload.payment_terms;
    delete legacyPayload.order_memo_template;
    delete legacyPayload.delivery_note_memo_template;
    delete legacyPayload.receipt_memo_template;
    const retry = await supabase
      .from("companies")
      .update(legacyPayload)
      .eq("id", updated.id)
      .select()
      .single();
    data = retry.data;
    error = retry.error;
    skippedDocumentSettingsColumns = !error;
    if (skippedDocumentSettingsColumns) {
      console.warn(
        "companies の支払条件・書類備考列が未作成のため、それ以外を保存しました。supabase/patch-company-settings.sql を実行してください。"
      );
    }
  }

  if (error) {
    logSupabaseError("dbUpdateCompanySettings", error);
    throw toUserFacingDbError(error);
  }
  if (!data) {
    throw new Error(
      "会社設定を更新できませんでした。一度ログアウトしてから再度ログインしてください。"
    );
  }

  const saved = companyFromRow(data as CompanyRow);
  if (!skippedFaxContactColumns && !skippedDocumentSettingsColumns) {
    return saved;
  }
  return {
    ...saved,
    fax: skippedFaxContactColumns ? updated.fax : saved.fax,
    contactName: skippedFaxContactColumns ? updated.contactName : saved.contactName,
    paymentTerms: skippedDocumentSettingsColumns
      ? updated.paymentTerms
      : saved.paymentTerms,
    orderMemoTemplate: skippedDocumentSettingsColumns
      ? updated.orderMemoTemplate
      : saved.orderMemoTemplate,
    deliveryNoteMemoTemplate: skippedDocumentSettingsColumns
      ? updated.deliveryNoteMemoTemplate
      : saved.deliveryNoteMemoTemplate,
    receiptMemoTemplate: skippedDocumentSettingsColumns
      ? updated.receiptMemoTemplate
      : saved.receiptMemoTemplate,
  };
}
