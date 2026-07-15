import type { QuoteRecord } from "@/lib/types";
import { useQuoteStore } from "@/stores/quote-store";

/** 注文書の元として選べる見積（否認済みを除外） */
export function getSelectableQuotesForProject(projectId: string): QuoteRecord[] {
  return useQuoteStore
    .getState()
    .getQuotesByProjectId(projectId)
    .filter((q) => q.status !== "rejected")
    .slice()
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/** 承認済み見積は確認ダイアログなしで作成可 */
export function isQuoteConfirmedForOrder(quote: QuoteRecord): boolean {
  return quote.status === "accepted";
}

/** 受注確定など自動作成時の優先見積 */
export function pickPreferredQuoteForOrder(
  quotes: QuoteRecord[]
): QuoteRecord | null {
  return (
    quotes.find((q) => q.status === "accepted") ??
    quotes.find((q) => q.status === "sent") ??
    quotes.find((q) => q.status === "draft") ??
    null
  );
}
