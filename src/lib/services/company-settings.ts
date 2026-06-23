import type { CompanySettings } from "@/lib/types";
import type { CompanySettingsFormValues } from "@/lib/validations/company-settings";
import { useCompanySettingsStore } from "@/stores/company-settings-store";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { dbUpdateCompanySettings } from "@/lib/db/write-company";
import { fetchCompanySettings } from "@/lib/db/company-context";

export async function getCompanySettings(): Promise<CompanySettings> {
  if (isSupabaseConfigured()) {
    const settings = await fetchCompanySettings();
    useCompanySettingsStore.getState().hydrate(settings);
    return settings;
  }
  return useCompanySettingsStore.getState().getSettings();
}

export async function updateCompanySettings(
  values: CompanySettingsFormValues
): Promise<CompanySettings> {
  if (isSupabaseConfigured()) {
    const updated = await dbUpdateCompanySettings(values);
    useCompanySettingsStore.getState().hydrate(updated);
    return updated;
  }
  return useCompanySettingsStore.getState().updateSettings({
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
    paymentTerms: (values.paymentTerms ?? "").trim(),
    quoteMemoTemplate: (values.quoteMemoTemplate ?? "").trim(),
    invoiceMemoTemplate: (values.invoiceMemoTemplate ?? "").trim(),
    orderMemoTemplate: (values.orderMemoTemplate ?? "").trim(),
    deliveryNoteMemoTemplate: (values.deliveryNoteMemoTemplate ?? "").trim(),
    receiptMemoTemplate: (values.receiptMemoTemplate ?? "").trim(),
  });
}
