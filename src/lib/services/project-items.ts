import type { ProjectItemInput, ProjectItemRecord } from "@/lib/types";
import type { InvoiceInput } from "@/lib/types";
import { quoteItemsFromProjectTitle } from "@/lib/project-title";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import {
  itemsFromProjectItems,
  itemsFromQuoteItems,
} from "@/lib/build-commercial-items";
import type { CommercialDocumentItemInput } from "@/lib/commercial-document";
import { DEFAULT_UNIT } from "@/lib/constants/units";
import { useProjectStore } from "@/stores/project-store";
import { useProjectItemStore } from "@/stores/project-item-store";
import { useQuoteStore } from "@/stores/quote-store";
import {
  dbFetchProjectItems,
  dbReplaceProjectItems,
} from "@/lib/db/write-project-items";
import type { ProjectInput } from "@/lib/types";

export function getProjectItems(projectId: string): ProjectItemRecord[] {
  return useProjectItemStore.getState().getByProjectId(projectId);
}

export async function fetchProjectItems(
  projectId: string
): Promise<ProjectItemRecord[]> {
  if (isSupabaseConfigured()) {
    const items = await dbFetchProjectItems(projectId);
    return items;
  }
  return getProjectItems(projectId);
}

export async function saveProjectItems(
  projectId: string,
  input: Pick<ProjectInput, "items">
): Promise<ProjectItemRecord[]> {
  if (isSupabaseConfigured()) {
    return dbReplaceProjectItems(projectId, {
      ...input,
      customerId: "",
      projectName: "",
      constructionSite: "",
      status: "estimate",
      amount: 0,
      dueDate: "",
      startDate: "",
      endDate: "",
      assigneeName: "",
      memo: "",
    });
  }
  return useProjectItemStore.getState().replaceForProject(projectId, input.items);
}

/** 見積下書き用に案件明細を QuoteInput.items 形式へ */
export function quoteItemsFromProjectItems(
  projectId: string
): ProjectItemInput[] {
  return getProjectItems(projectId).map((it) => ({
    itemTemplateId: it.itemTemplateId,
    name: it.name,
    description: it.description,
    width: it.width ?? "",
    height: it.height ?? "",
    quantity: it.quantity,
    unit: it.unit,
    unitPrice: it.unitPrice,
    taxRate: it.taxRate,
    sortOrder: it.sortOrder,
  }));
}

export function buildQuoteInputItemsForProject(
  projectId: string,
  projectName: string,
  fallbackAmount: number
): ProjectItemInput[] {
  const fromItems = quoteItemsFromProjectItems(projectId);
  if (fromItems.length > 0) return fromItems;

  return quoteItemsFromProjectTitle(projectName, fallbackAmount).map((line, idx) => ({
    itemTemplateId: null,
    name: line.name,
    description: "",
    width: "",
    height: "",
    quantity: 1,
    unit: "一式",
    unitPrice: line.unitPrice,
    taxRate: 0.1 as const,
    sortOrder: idx,
  }));
}

/** 請求書作成用：案件明細 → InvoiceInput.items */
export function buildInvoiceInputItemsForProject(
  projectId: string,
  projectName: string,
  fallbackAmount: number
): InvoiceInput["items"] {
  return buildQuoteInputItemsForProject(projectId, projectName, fallbackAmount).map(
    (it, idx) => ({
      quoteItemId: null,
      name: it.name,
      description: it.description,
      width: it.width ?? "",
      height: it.height ?? "",
      quantity: it.quantity,
      unit: it.unit || DEFAULT_UNIT,
      unitPrice: it.unitPrice,
      taxRate: it.taxRate,
      sortOrder: it.sortOrder ?? idx,
    })
  );
}

/** 注文書・納品書など：見積明細 → 案件明細 → 案件名1行の優先順で明細を解決 */
export function resolveCommercialItemsForProject(
  projectId: string,
  projectName: string
): CommercialDocumentItemInput[] {
  const quote = useQuoteStore
    .getState()
    .getQuotesByProjectId(projectId)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];

  if (quote) {
    const quoteItems = useQuoteStore.getState().getQuoteItems(quote.id);
    if (quoteItems.length > 0) return itemsFromQuoteItems(quoteItems);
  }

  const projectItems = useProjectItemStore.getState().getByProjectId(projectId);
  if (projectItems.length > 0) return itemsFromProjectItems(projectItems);

  return [
    {
      itemTemplateId: null,
      name: projectName,
      description: "",
      width: "",
      height: "",
      quantity: 1,
      unit: "式",
      unitPrice: useProjectStore.getState().getProjectById(projectId)?.amount ?? 0,
      taxRate: 0.1 as const,
      sortOrder: 0,
    },
  ];
}

export function quoteNeedsItemSync(quote: {
  id: string;
  totalAmount: number;
}): boolean {
  const items = useQuoteStore.getState().getQuoteItems(quote.id);
  return items.length === 0 || quote.totalAmount <= 0;
}
