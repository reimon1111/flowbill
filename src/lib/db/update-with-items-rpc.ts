import { getSupabaseClient } from "@/lib/supabase/client";
import {
  isMissingRpcFunction,
  logSupabaseError,
} from "@/lib/db/errors";

type RpcCallArgs = {
  rpcName: string;
  sqlFile: string;
  hint: string;
  parentIdParam: string;
  parentId: string;
  parentPayload: Record<string, unknown>;
  parentPayloadKey: string;
  itemsPayload: Record<string, unknown>[];
  itemsPayloadKey?: string;
  companyId: string;
  notFoundMessageIncludes: string;
};

/**
 * 親+明細の原子的更新 RPC を呼び出す（見積 update_quote_with_items と同型）。
 * 未適用時はヒント付き Error。親 not found は null。
 */
export async function callUpdateWithItemsRpc(
  args: RpcCallArgs
): Promise<Record<string, unknown> | null> {
  const supabase = getSupabaseClient();
  const itemsKey = args.itemsPayloadKey ?? "p_items";

  const { data, error } = await supabase.rpc(args.rpcName, {
    [args.parentIdParam]: args.parentId,
    [args.parentPayloadKey]: args.parentPayload,
    [itemsKey]: args.itemsPayload,
  });

  if (error) {
    if (isMissingRpcFunction(error, args.rpcName)) {
      logSupabaseError(`${args.rpcName} RPC missing`, error);
      console.error(`[${args.rpcName}] RPC未適用`, {
        rpcName: args.rpcName,
        parentId: args.parentId,
        companyId: args.companyId,
        hint: `${args.sqlFile} を適用してください`,
        code: (error as { code?: string }).code ?? null,
        message: (error as { message?: string }).message ?? null,
        details: (error as { details?: string }).details ?? null,
        hintDetail: (error as { hint?: string }).hint ?? null,
      });
      throw new Error(args.hint);
    }

    const message = String((error as { message?: string }).message ?? "");
    if (
      message.toLowerCase().includes(args.notFoundMessageIncludes.toLowerCase()) ||
      (error as { code?: string }).code === "P0002"
    ) {
      return null;
    }

    throw error;
  }

  if (!data || typeof data !== "object") {
    throw new Error(`${args.rpcName}: 更新結果を取得できませんでした`);
  }

  return data as Record<string, unknown>;
}
