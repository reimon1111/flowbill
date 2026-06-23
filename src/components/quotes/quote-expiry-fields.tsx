"use client";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  QUOTE_EXPIRY_FORM_OPTIONS,
  QUOTE_EXPIRY_TYPE_LABELS,
  calculateQuoteExpiryDate,
  formatQuoteExpiryListText,
  getQuoteExpiryDisplayStatus,
  type QuoteExpiryType,
} from "@/lib/quote-expiry";
import { formatDate } from "@/lib/format";
import { formatFieldErrorMessage } from "@/lib/form-error-message";

export function QuoteExpiryFields({
  issueDate,
  expiryType,
  expiryDate,
  onExpiryTypeChange,
  onExpiryDateChange,
  expiryTypeError,
  expiryDateError,
}: {
  issueDate: string;
  expiryType: QuoteExpiryType;
  expiryDate: string;
  onExpiryTypeChange: (type: QuoteExpiryType) => void;
  onExpiryDateChange: (date: string) => void;
  expiryTypeError?: string;
  expiryDateError?: string;
}) {
  const isCustom = expiryType === "custom";
  const previewDate = isCustom
    ? expiryDate
    : calculateQuoteExpiryDate(issueDate, expiryType);

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <p className="text-sm font-medium text-zinc-700">有効期限 *</p>
        <div className="flex flex-wrap gap-2">
          {QUOTE_EXPIRY_FORM_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => onExpiryTypeChange(option.value)}
              className={cn(
                "rounded-xl px-3.5 py-2 text-sm font-medium transition-colors",
                expiryType === option.value
                  ? "bg-zinc-900 text-white"
                  : "bg-white text-zinc-600 ring-1 ring-zinc-200/80 hover:bg-zinc-50"
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
        {expiryTypeError && (
          <p className="text-sm text-red-600">
            {formatFieldErrorMessage(expiryTypeError)}
          </p>
        )}
      </div>

      {isCustom ? (
        <div className="space-y-2">
          <p className="text-sm font-medium text-zinc-700">有効期限日 *</p>
          <Input
            type="date"
            value={expiryDate}
            onChange={(e) => onExpiryDateChange(e.target.value)}
            className="h-11 rounded-xl border-zinc-200/80 text-base"
          />
          {expiryDateError && (
            <p className="text-sm text-red-600">
              {formatFieldErrorMessage(expiryDateError)}
            </p>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-zinc-200/80 bg-zinc-50/60 px-4 py-3">
          <p className="text-xs font-medium text-zinc-500">有効期限日（自動計算）</p>
          <p className="mt-1 text-sm font-semibold text-zinc-900">
            {previewDate ? formatDate(previewDate) : "—"}
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            発行日から{QUOTE_EXPIRY_TYPE_LABELS[expiryType]}後
          </p>
        </div>
      )}
    </div>
  );
}

export function QuoteExpiryListLabel({ expiryDate }: { expiryDate: string }) {
  const status = getQuoteExpiryDisplayStatus(expiryDate);

  return (
    <div className="mt-0.5 text-xs">
      <p className="text-zinc-400">有効期限 {formatDate(expiryDate)}</p>
      <p
        className={cn(
          "mt-0.5 font-medium",
          status === "expired" && "text-red-600",
          status === "soon" && "text-amber-700",
          status === "ok" && "text-zinc-500"
        )}
      >
        {status === "expired"
          ? `期限切れ（${formatQuoteExpiryListText(expiryDate)}）`
          : status === "soon"
            ? `期限間近（${formatQuoteExpiryListText(expiryDate)}）`
            : formatQuoteExpiryListText(expiryDate)}
      </p>
    </div>
  );
}
