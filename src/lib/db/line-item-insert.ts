import {
  CONSTRUCTION_ITEM_FIELDS_MIGRATION_HINT,
  isMissingConstructionItemFieldColumns,
} from "@/lib/db/errors";

type RowWithDimensions = {
  width?: string | null;
  height?: string | null;
};

export function stripConstructionDimensions<T extends RowWithDimensions>(
  row: T
): Omit<T, "width" | "height"> {
  const { width: _w, height: _h, ...rest } = row;
  return rest;
}

/** width / height 列未作成 DB 向けに明細 insert をリトライ */
export async function insertRowsWithConstructionFallback<
  TRow extends RowWithDimensions,
>(
  insert: (rows: TRow[]) => Promise<{ error: { message?: string } | null }>,
  rows: TRow[]
): Promise<void> {
  if (rows.length === 0) return;

  let { error } = await insert(rows);
  if (error && isMissingConstructionItemFieldColumns(error)) {
    const legacy = rows.map((row) => stripConstructionDimensions(row)) as TRow[];
    ({ error } = await insert(legacy));
    if (!error) {
      console.warn(CONSTRUCTION_ITEM_FIELDS_MIGRATION_HINT);
    }
  }
  if (error) throw error;
}
