export type DocumentKind =
  | "quote"
  | "invoice"
  | "order"
  | "delivery_note"
  | "receipt";

export type DocumentLabels = {
  title: string;
  numberLabel: string;
  secondDateLabel: string | null;
  greeting: string;
  totalLabel: string;
  subjectSuffix: string;
  showPaymentTerms: boolean;
  showBankInfo: boolean;
  showReceiptStamp: boolean;
  showConstructionSite: boolean;
};

export function getDocumentLabels(kind: DocumentKind): DocumentLabels {
  switch (kind) {
    case "quote":
      return {
        title: "見積書",
        numberLabel: "見積番号",
        secondDateLabel: "有効期限",
        greeting: "下記の通り、お見積り申し上げます。",
        totalLabel: "御見積金額（税込）",
        subjectSuffix: " 御見積",
        showPaymentTerms: true,
        showBankInfo: false,
        showReceiptStamp: false,
        showConstructionSite: true,
      };
    case "invoice":
      return {
        title: "請求書",
        numberLabel: "請求番号",
        secondDateLabel: "支払期限",
        greeting: "下記の通り、ご請求申し上げます。",
        totalLabel: "ご請求金額（税込）",
        subjectSuffix: "",
        showPaymentTerms: true,
        showBankInfo: true,
        showReceiptStamp: false,
        showConstructionSite: true,
      };
    case "order":
      return {
        title: "注文書",
        numberLabel: "注文番号",
        secondDateLabel: null,
        greeting: "下記の通り、注文いたします。",
        totalLabel: "注文金額（税込）",
        subjectSuffix: "",
        showPaymentTerms: true,
        showBankInfo: false,
        showReceiptStamp: false,
        showConstructionSite: true,
      };
    case "delivery_note":
      return {
        title: "納品書",
        numberLabel: "納品番号",
        secondDateLabel: null,
        greeting: "下記の通り、納品いたします。",
        totalLabel: "納品金額（税込）",
        subjectSuffix: "",
        showPaymentTerms: true,
        showBankInfo: false,
        showReceiptStamp: false,
        showConstructionSite: true,
      };
    case "receipt":
      return {
        title: "領収書",
        numberLabel: "領収番号",
        secondDateLabel: null,
        greeting: "下記の金額、正に領収いたしました。",
        totalLabel: "領収金額（税込）",
        subjectSuffix: "",
        showPaymentTerms: false,
        showBankInfo: false,
        showReceiptStamp: true,
        showConstructionSite: false,
      };
  }
}

export function getMemoTemplateKey(
  kind: DocumentKind
): keyof Pick<
  import("@/lib/types").CompanySettings,
  | "quoteMemoTemplate"
  | "invoiceMemoTemplate"
  | "orderMemoTemplate"
  | "deliveryNoteMemoTemplate"
  | "receiptMemoTemplate"
> {
  switch (kind) {
    case "quote":
      return "quoteMemoTemplate";
    case "invoice":
      return "invoiceMemoTemplate";
    case "order":
      return "orderMemoTemplate";
    case "delivery_note":
      return "deliveryNoteMemoTemplate";
    case "receipt":
      return "receiptMemoTemplate";
  }
}
