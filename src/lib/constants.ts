import type {
  InvoiceStatus,
  ProjectPaymentStatus,
  ProjectStatus,
} from "@/lib/types";

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  estimate: "見積中",
  ordered: "受注",
  in_progress: "作業中",
  completed: "完了",
  lost: "失注",
};

export const PROJECT_STATUS_STYLES: Record<
  ProjectStatus,
  { bg: string; text: string; dot: string }
> = {
  estimate: {
    bg: "bg-sky-50",
    text: "text-sky-700",
    dot: "bg-sky-500",
  },
  ordered: {
    bg: "bg-violet-50",
    text: "text-violet-700",
    dot: "bg-violet-500",
  },
  in_progress: {
    bg: "bg-amber-50",
    text: "text-amber-800",
    dot: "bg-amber-500",
  },
  completed: {
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    dot: "bg-emerald-500",
  },
  lost: {
    bg: "bg-zinc-100",
    text: "text-zinc-600",
    dot: "bg-zinc-400",
  },
};

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  not_created: "未作成",
  draft: "下書き",
  issued: "発行済",
  sent: "送付済",
};

export const INVOICE_STATUS_STYLES: Record<InvoiceStatus, string> = {
  not_created: "bg-zinc-100 text-zinc-600",
  draft: "bg-slate-50 text-slate-600",
  issued: "bg-violet-50 text-violet-700",
  sent: "bg-violet-50/80 text-violet-600",
};

export const PROJECT_PAYMENT_STATUS_LABELS: Record<
  ProjectPaymentStatus,
  string
> = {
  unpaid: "未入金",
  paid: "入金済",
  overdue: "期限超過",
};

export const PROJECT_PAYMENT_STATUS_STYLES: Record<
  ProjectPaymentStatus,
  string
> = {
  unpaid: "bg-amber-50 text-amber-700",
  paid: "bg-emerald-50 text-emerald-700",
  overdue: "bg-red-50 text-red-600",
};

export const NAV_ITEMS = [
  { href: "/", label: "ダッシュボード", icon: "LayoutDashboard" as const },
  { href: "/projects", label: "案件一覧", icon: "FolderKanban" as const },
  { href: "/projects/schedule", label: "予定表", icon: "CalendarRange" as const },
  { href: "/quotes", label: "見積書", icon: "ScrollText" as const },
  { href: "/orders", label: "注文書", icon: "ClipboardList" as const },
  { href: "/delivery-notes", label: "納品書", icon: "Package" as const },
  { href: "/invoices", label: "請求書", icon: "Receipt" as const },
  { href: "/receipts", label: "領収書", icon: "Stamp" as const },
  { href: "/payments", label: "入金管理", icon: "Wallet" },
  { href: "/customers", label: "顧客情報", icon: "Users" as const },
  {
    href: "/item-templates",
    label: "請求項目テンプレ",
    icon: "FileText" as const,
  },
  { href: "/recurring-billings", label: "定期請求", icon: "CalendarClock" },
  { href: "/settings/company", label: "会社設定", icon: "Building2" as const },
] as const;
