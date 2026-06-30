import type { CommercialItemsResolveMeta } from "@/lib/services/project-items";

export const ORDER_EMPTY_ITEMS_TOAST =
  "注文書を作成できません。見積書または案件明細を追加してください。";

export type OrderCreationErrorCode =
  | "EMPTY_ITEMS"
  | "PROJECT_NOT_FOUND"
  | "ORDER_CREATE_FAILED";

export class OrderCreationError extends Error {
  readonly code: OrderCreationErrorCode;
  readonly projectId: string;
  readonly meta?: CommercialItemsResolveMeta;

  constructor(
    code: OrderCreationErrorCode,
    message: string,
    projectId: string,
    meta?: CommercialItemsResolveMeta
  ) {
    super(message);
    this.name = "OrderCreationError";
    this.code = code;
    this.projectId = projectId;
    this.meta = meta;
  }
}

export function isOrderCreationError(error: unknown): error is OrderCreationError {
  return error instanceof OrderCreationError;
}

export function getOrderCreationToastMessage(error: unknown): string | null {
  if (isOrderCreationError(error)) {
    if (error.code === "EMPTY_ITEMS") return ORDER_EMPTY_ITEMS_TOAST;
    return error.message;
  }
  return null;
}
