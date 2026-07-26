import type { QuoteRecord, QuoteStatus } from "@/lib/types";
import { useQuoteStore } from "@/stores/quote-store";

export type ProjectQuoteSummary = {
  quoteCount: number;
  latestQuote: QuoteRecord | null;
};

/** 案件に紐づく見積を更新日時の新しい順で取得 */
export function getQuotesByProjectIdSorted(
  projectId: string,
  quotes?: QuoteRecord[]
): QuoteRecord[] {
  const list =
    quotes ?? useQuoteStore.getState().getQuotesByProjectId(projectId);
  return list
    .filter((q) => q.projectId === projectId)
    .slice()
    .sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
}

/** 案件一覧・詳細用の見積サマリー（件数 + 最新） */
export function getProjectQuoteSummary(
  projectId: string,
  quotes?: QuoteRecord[]
): ProjectQuoteSummary {
  const sorted = getQuotesByProjectIdSorted(projectId, quotes);
  return {
    quoteCount: sorted.length,
    latestQuote: sorted[0] ?? null,
  };
}

export function quoteStatusLabel(status: QuoteStatus): string {
  switch (status) {
    case "draft":
      return "下書き";
    case "sent":
      return "提出済み";
    case "accepted":
      return "承認";
    case "rejected":
      return "否認";
    default:
      return status;
  }
}
