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
      discountLabel: "",
      discountAmount: 0,
      customerContactName: "",
      customerDepartment: "",
      customerPosition: "",
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

/** 注文書・納品書など：見積明細 → 案件明細の優先順で明細を解決 */
export type CommercialItemsResolveMeta = {
  items: CommercialDocumentItemInput[];
  source:
    | "accepted_quote"
    | "sent_quote"
    | "draft_quote"
    | "selected_quote"
    | "project_items"
    | "fallback"
    | "empty";
  acceptedEstimate: { id: string; quoteNumber: string; itemCount: number } | null;
  sentEstimate: { id: string; quoteNumber: string; itemCount: number } | null;
  projectItems: Array<{ id: string; name: string }>;
};

export type ResolveCommercialItemsOptions = {
  allowTitleFallback?: boolean;
  /**
   * 明示指定の見積（下書き含む）。
   * null = 見積を使わず案件明細のみ。
   * undefined = 承認 → 提出済み → 下書きの自動優先。
   */
  quoteId?: string | null;
};

export function resolveCommercialItemsForProjectWithMeta(
  projectId: string,
  projectName: string,
  options?: ResolveCommercialItemsOptions
): CommercialItemsResolveMeta {
  const quotes = useQuoteStore
    .getState()
    .getQuotesByProjectId(projectId)
    .filter((q) => q.status !== "rejected")
    .slice()
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  const accepted = quotes.find((q) => q.status === "accepted") ?? null;
  const sent = quotes.find((q) => q.status === "sent") ?? null;
  const draft = quotes.find((q) => q.status === "draft") ?? null;
  const projectItems = useProjectItemStore.getState().getByProjectId(projectId);

  const acceptedEstimate = accepted
    ? {
        id: accepted.id,
        quoteNumber: accepted.quoteNumber,
        itemCount: useQuoteStore.getState().getQuoteItems(accepted.id).length,
      }
    : null;
  const sentEstimate = sent
    ? {
        id: sent.id,
        quoteNumber: sent.quoteNumber,
        itemCount: useQuoteStore.getState().getQuoteItems(sent.id).length,
      }
    : null;
  const projectItemSummaries = projectItems.map((it) => ({
    id: it.id,
    name: it.name,
  }));

  const fromQuote = (
    quoteId: string,
    source: CommercialItemsResolveMeta["source"]
  ): CommercialItemsResolveMeta | null => {
    const quoteItems = useQuoteStore.getState().getQuoteItems(quoteId);
    if (quoteItems.length === 0) return null;
    return {
      items: itemsFromQuoteItems(quoteItems),
      source,
      acceptedEstimate,
      sentEstimate,
      projectItems: projectItemSummaries,
    };
  };

  const fromProject = (): CommercialItemsResolveMeta | null => {
    if (projectItems.length === 0) return null;
    return {
      items: itemsFromProjectItems(projectItems),
      source: "project_items",
      acceptedEstimate,
      sentEstimate,
      projectItems: projectItemSummaries,
    };
  };

  const fromFallback = (): CommercialItemsResolveMeta => {
    if (options?.allowTitleFallback === false) {
      return {
        items: [],
        source: "empty",
        acceptedEstimate,
        sentEstimate,
        projectItems: projectItemSummaries,
      };
    }
    return {
      items: [
        {
          itemTemplateId: null,
          name: projectName,
          description: "",
          width: "",
          height: "",
          quantity: 1,
          unit: "式",
          unitPrice:
            useProjectStore.getState().getProjectById(projectId)?.amount ?? 0,
          taxRate: 0.1 as const,
          sortOrder: 0,
        },
      ],
      source: "fallback",
      acceptedEstimate,
      sentEstimate,
      projectItems: projectItemSummaries,
    };
  };

  // 見積を使わず案件から
  if (options?.quoteId === null) {
    return fromProject() ?? fromFallback();
  }

  // 明示指定の見積
  if (options?.quoteId) {
    const selected = quotes.find((q) => q.id === options.quoteId);
    if (selected) {
      const resolved = fromQuote(selected.id, "selected_quote");
      if (resolved) return resolved;
    }
    return fromProject() ?? fromFallback();
  }

  // 自動優先: 承認 → 提出済み → 下書き → 案件
  if (accepted) {
    const resolved = fromQuote(accepted.id, "accepted_quote");
    if (resolved) return resolved;
  }
  if (sent) {
    const resolved = fromQuote(sent.id, "sent_quote");
    if (resolved) return resolved;
  }
  if (draft) {
    const resolved = fromQuote(draft.id, "draft_quote");
    if (resolved) return resolved;
  }

  return fromProject() ?? fromFallback();
}

/** 注文書・納品書など：見積明細 → 案件明細 → 案件名1行の優先順で明細を解決 */
export function resolveCommercialItemsForProject(
  projectId: string,
  projectName: string,
  options?: ResolveCommercialItemsOptions
): CommercialDocumentItemInput[] {
  return resolveCommercialItemsForProjectWithMeta(
    projectId,
    projectName,
    options
  ).items;
}

export function quoteNeedsItemSync(quote: {
  id: string;
  totalAmount: number;
}): boolean {
  const items = useQuoteStore.getState().getQuoteItems(quote.id);
  return items.length === 0 || quote.totalAmount <= 0;
}
