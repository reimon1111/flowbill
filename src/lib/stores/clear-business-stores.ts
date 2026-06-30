import {
  emptyCompanySettings,
  initialCompanySettings,
} from "@/lib/mock-company-settings";
import { initialCustomers } from "@/lib/mock-customers";
import { initialInvoiceItems, initialInvoices } from "@/lib/mock-invoices";
import { initialItemTemplates } from "@/lib/mock-item-templates";
import { initialProjectHistories, initialProjects } from "@/lib/mock-projects";
import { initialQuoteItems, initialQuotes } from "@/lib/mock-quotes";
import {
  initialRecurringBillingItems,
  initialRecurringBillings,
} from "@/lib/mock-recurring";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { useActivityLogStore } from "@/stores/activity-log-store";
import { useBankAccountStore } from "@/stores/bank-account-store";
import { useCompanyMembershipStore } from "@/stores/company-membership-store";
import { useCompanySettingsStore } from "@/stores/company-settings-store";
import { useCustomerStore } from "@/stores/customer-store";
import { useDeliveryNoteStore } from "@/stores/delivery-note-store";
import { useInvoiceStore } from "@/stores/invoice-store";
import { useItemTemplateCategoryStore } from "@/stores/item-template-category-store";
import { useItemTemplateStore } from "@/stores/item-template-store";
import { useOrderStore } from "@/stores/order-store";
import { useProjectItemStore } from "@/stores/project-item-store";
import { useProjectStore } from "@/stores/project-store";
import { useQuoteStore } from "@/stores/quote-store";
import { useReceiptStore } from "@/stores/receipt-store";
import { useRecurringStore } from "@/stores/recurring-store";

/**
 * 業務データストアをクリアする。
 * ログアウト・ユーザー変更・会社切替・初期化開始時に呼ぶ。
 */
export function clearAllBusinessStores() {
  const offline = !isSupabaseConfigured();

  useCustomerStore.setState({ customers: offline ? initialCustomers : [] });
  useProjectStore.setState({
    projects: offline ? initialProjects : [],
    histories: offline ? initialProjectHistories : [],
  });
  useProjectItemStore.setState({ projectItems: [] });
  useQuoteStore.setState({
    quotes: offline ? initialQuotes : [],
    quoteItems: offline ? initialQuoteItems : [],
  });
  useInvoiceStore.setState({
    invoices: offline ? initialInvoices : [],
    invoiceItems: offline ? initialInvoiceItems : [],
  });
  useRecurringStore.setState({
    recurringBillings: offline ? initialRecurringBillings : [],
    recurringBillingItems: offline ? initialRecurringBillingItems : [],
  });
  useItemTemplateStore.setState({
    itemTemplates: offline ? initialItemTemplates : [],
  });
  useItemTemplateCategoryStore.setState({ categories: [] });
  useBankAccountStore.setState({ bankAccounts: [] });
  useOrderStore.setState({ orders: [], orderItems: [] });
  useDeliveryNoteStore.setState({ deliveryNotes: [], deliveryNoteItems: [] });
  useReceiptStore.setState({ receipts: [], receiptItems: [] });
  useCompanySettingsStore.setState({
    settings: offline ? initialCompanySettings : emptyCompanySettings,
  });
  useCompanyMembershipStore.getState().reset();
  useActivityLogStore.getState().reset();
}
