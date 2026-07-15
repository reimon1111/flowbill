"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { QuoteStatusBadge } from "@/components/quotes/quote-status-badge";
import { cn } from "@/lib/utils";
import type { QuoteRecord } from "@/lib/types";

type CreateOrderUnconfirmedDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  loading?: boolean;
};

/** 未確定・未承認の見積から注文書を作る前の確認 */
export function CreateOrderUnconfirmedDialog({
  open,
  onOpenChange,
  onConfirm,
  loading,
}: CreateOrderUnconfirmedDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(90vh,40rem)] overflow-y-auto rounded-xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle>未確定の見積書から注文書を作成しますか？</DialogTitle>
          <DialogDescription>
            この見積書はまだ確定していません。現在の内容を引き継いで注文書を作成します。作成後の注文書は見積書とは別に編集できます。
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            type="button"
            variant="outline"
            className="w-full rounded-xl sm:w-auto"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            キャンセル
          </Button>
          <Button
            type="button"
            className="w-full rounded-xl bg-zinc-900 text-white hover:bg-zinc-800 sm:w-auto"
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? "作成中…" : "注文書を作成"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type CreateOrderQuoteSelectDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quotes: QuoteRecord[];
  onSelectQuote: (quote: QuoteRecord) => void;
  onSelectProject: () => void;
  loading?: boolean;
};

/** 複数見積があるとき、作成元を選択 */
export function CreateOrderQuoteSelectDialog({
  open,
  onOpenChange,
  quotes,
  onSelectQuote,
  onSelectProject,
  loading,
}: CreateOrderQuoteSelectDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(90vh,40rem)] overflow-y-auto rounded-xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle>注文書の作成元を選択</DialogTitle>
          <DialogDescription>
            引き継ぐ見積書を選ぶか、見積書を使わず案件の内容から作成できます。
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          {quotes.map((quote) => (
            <button
              key={quote.id}
              type="button"
              disabled={loading}
              onClick={() => onSelectQuote(quote)}
              className={cn(
                "flex w-full flex-col items-start gap-1 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-left transition-colors",
                "hover:border-zinc-300 hover:bg-zinc-50",
                "disabled:opacity-60"
              )}
            >
              <span className="flex w-full flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-zinc-900">
                  {quote.quoteNumber}
                </span>
                <QuoteStatusBadge status={quote.status} />
              </span>
              <span className="text-xs text-zinc-500">
                合計 ¥{Math.round(quote.totalAmount).toLocaleString("ja-JP")}
              </span>
            </button>
          ))}
          <button
            type="button"
            disabled={loading}
            onClick={onSelectProject}
            className={cn(
              "flex w-full flex-col items-start gap-1 rounded-xl border border-dashed border-zinc-300 bg-zinc-50/80 px-4 py-3 text-left transition-colors",
              "hover:border-zinc-400 hover:bg-zinc-50",
              "disabled:opacity-60"
            )}
          >
            <span className="text-sm font-medium text-zinc-900">
              見積書を使わず案件から作成
            </span>
            <span className="text-xs text-zinc-500">
              案件名・案件明細・値引きなどを引き継ぎます
            </span>
          </button>
        </div>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            type="button"
            variant="outline"
            className="w-full rounded-xl sm:w-auto"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            キャンセル
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
