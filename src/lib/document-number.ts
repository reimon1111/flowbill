/**
 * 帳票番号（QT / OR / DN / INV / RC）の安全な払い出し。
 * Supabase: allocate_document_number RPC（会社×種別×年カウンタ）。
 * Local: プロセス内カウンタ + 既存番号の最大値（並列タブの完全排他はなし）。
 */
import { getSupabaseClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { toUserFacingDbError } from "@/lib/db/errors";

export type DocumentNumberKind =
  | "quote"
  | "order"
  | "delivery_note"
  | "invoice"
  | "receipt";

const DOCUMENT_NUMBER_PREFIX: Record<DocumentNumberKind, string> = {
  quote: "QT",
  order: "OR",
  delivery_note: "DN",
  invoice: "INV",
  receipt: "RC",
};

/** local mode 用: kind:year → 最後に払い出した連番 */
const localCounters = new Map<string, number>();

function yearFromIssueDate(issueDate: string): number {
  const y = Number.parseInt(issueDate.slice(0, 4), 10);
  if (!Number.isFinite(y) || y < 2000 || y > 2100) {
    throw new Error(`不正な発行年です: ${issueDate}`);
  }
  return y;
}

function formatDocumentNumber(
  kind: DocumentNumberKind,
  year: number,
  seq: number
): string {
  const prefix = DOCUMENT_NUMBER_PREFIX[kind];
  return `${prefix}-${year}-${String(seq).padStart(4, "0")}`;
}

function maxExistingSeq(
  kind: DocumentNumberKind,
  year: number,
  existingNumbers: string[]
): number {
  const head = `${DOCUMENT_NUMBER_PREFIX[kind]}-${year}-`;
  let max = 0;
  for (const n of existingNumbers) {
    if (!n.startsWith(head)) continue;
    const seq = Number.parseInt(n.slice(head.length), 10);
    if (Number.isFinite(seq) && seq > max) max = seq;
  }
  return max;
}

/**
 * ローカル採番（単一プロセス内で一意。削除済み番号も existing に含めれば再利用しない）。
 */
export function allocateDocumentNumberLocal(
  kind: DocumentNumberKind,
  issueDate: string,
  existingNumbers: string[]
): string {
  const year = yearFromIssueDate(issueDate);
  const key = `${kind}:${year}`;
  const fromExisting = maxExistingSeq(kind, year, existingNumbers);
  const fromCounter = localCounters.get(key) ?? 0;
  const next = Math.max(fromExisting, fromCounter) + 1;
  localCounters.set(key, next);
  return formatDocumentNumber(kind, year, next);
}

/**
 * 次の帳票番号を取得。
 * @param existingNumbersForLocal local mode 時に参照する既存番号一覧（削除済み含むこと）
 */
export async function allocateDocumentNumber(
  kind: DocumentNumberKind,
  issueDate: string,
  existingNumbersForLocal: string[] = []
): Promise<string> {
  const year = yearFromIssueDate(issueDate);

  if (!isSupabaseConfigured()) {
    return allocateDocumentNumberLocal(kind, issueDate, existingNumbersForLocal);
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("allocate_document_number", {
    p_doc_kind: kind,
    p_year: year,
  });

  if (error) {
    throw toUserFacingDbError(error);
  }

  const allocated = typeof data === "string" ? data.trim() : "";
  if (!allocated) {
    throw new Error("帳票番号の払い出しに失敗しました");
  }
  return allocated;
}

export function getDocumentNumberPrefix(kind: DocumentNumberKind): string {
  return DOCUMENT_NUMBER_PREFIX[kind];
}
