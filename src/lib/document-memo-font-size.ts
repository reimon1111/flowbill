import { z } from "zod";

/** 帳票備考の文字サイズ（帳票スナップショット） */
export type DocumentMemoFontSize = "small" | "normal" | "large";

export const DOCUMENT_MEMO_FONT_SIZE_OPTIONS: Array<{
  value: DocumentMemoFontSize;
  label: string;
}> = [
  { value: "small", label: "小" },
  { value: "normal", label: "標準" },
  { value: "large", label: "大" },
];

export const DEFAULT_DOCUMENT_MEMO_FONT_SIZE: DocumentMemoFontSize = "normal";

export function normalizeDocumentMemoFontSize(
  value: string | null | undefined
): DocumentMemoFontSize {
  if (value === "small" || value === "normal" || value === "large") {
    return value;
  }
  return DEFAULT_DOCUMENT_MEMO_FONT_SIZE;
}

/**
 * 備考本文用 class。
 * 標準(normal)は帳票フッター現行の text-[10px] 継承相当。
 */
export function resolveDocumentMemoFontClass(
  size: DocumentMemoFontSize | string | null | undefined
): string {
  switch (normalizeDocumentMemoFontSize(size)) {
    case "small":
      return "text-[9px] leading-snug";
    case "large":
      return "text-[12px] leading-snug";
    case "normal":
    default:
      return "text-[10px] leading-snug";
  }
}

export const documentMemoFontSizeFieldSchema = z.object({
  memoFontSize: z.enum(["small", "normal", "large"]),
});

export const documentMemoFontSizeFormDefaults = {
  memoFontSize: DEFAULT_DOCUMENT_MEMO_FONT_SIZE as DocumentMemoFontSize,
};
