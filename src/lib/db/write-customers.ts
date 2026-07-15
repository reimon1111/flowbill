import type { Customer, CustomerInput } from "@/lib/types";
import { getSupabaseClient } from "@/lib/supabase/client";
import { resolveCompanyId } from "@/lib/db/company-context";
import { generateId } from "@/lib/db/ids";
import { getAuthUserId, withCreateAudit, withUpdateAudit } from "@/lib/db/auth-user";
import { customerFromRow, customerToRow, type CustomerRow } from "@/lib/db/mappers";
import { recordActivityLog } from "@/lib/db/write-activity-log";
import {
  activityDescriptionCreated,
  activityDescriptionDeleted,
  activityDescriptionUpdated,
} from "@/lib/activity-log-messages";
import {
  isMissingAuditColumnError,
  isMissingCustomerFaxColumn,
  logSupabaseError,
  toUserFacingDbError,
} from "@/lib/db/errors";

type CustomerWriteRow = CustomerRow & Record<string, unknown>;

function stripAuditFields(row: CustomerWriteRow): CustomerWriteRow {
  const next = { ...row };
  delete next.created_by;
  delete next.updated_by;
  return next;
}

function stripFaxField(row: CustomerWriteRow): CustomerWriteRow {
  const next = { ...row };
  delete next.fax;
  return next;
}

async function runCustomerInsert(row: CustomerWriteRow) {
  const supabase = getSupabaseClient();
  return supabase.from("customers").insert(row);
}

async function runCustomerUpdate(id: string, row: CustomerWriteRow) {
  const supabase = getSupabaseClient();
  return supabase.from("customers").update(row).eq("id", id);
}

/** insert/update 時に未適用列（fax / audit）があれば除外して再試行 */
async function writeCustomerRow(
  mode: "insert" | "update",
  row: CustomerWriteRow,
  userId: string | null,
  id?: string
): Promise<void> {
  let payload: CustomerWriteRow =
    mode === "insert" ? withCreateAudit(row, userId) : withUpdateAudit(row, userId);

  let result =
    mode === "insert"
      ? await runCustomerInsert(payload)
      : await runCustomerUpdate(id!, payload);

  if (result.error && isMissingCustomerFaxColumn(result.error)) {
    payload = stripFaxField(payload);
    result =
      mode === "insert"
        ? await runCustomerInsert(payload)
        : await runCustomerUpdate(id!, payload);
    if (!result.error) {
      console.warn(
        "customers.fax 列が未作成のため FAX なしで保存しました。schema-full.sql を適用してください。"
      );
    }
  }

  if (result.error && isMissingAuditColumnError(result.error)) {
    payload = stripAuditFields(payload);
    result =
      mode === "insert"
        ? await runCustomerInsert(payload)
        : await runCustomerUpdate(id!, payload);
    if (!result.error) {
      console.warn(
        "customers.created_by / updated_by 列が未作成のため監査列なしで保存しました。supabase/add-audit-fields.sql を適用してください。"
      );
    }
  }

  if (result.error) {
    logSupabaseError(`db${mode === "insert" ? "Insert" : "Update"}Customer`, result.error);
    throw toUserFacingDbError(result.error);
  }
}

export async function dbInsertCustomer(input: CustomerInput): Promise<Customer> {
  const companyId = await resolveCompanyId();
  const userId = await getAuthUserId();
  const now = new Date().toISOString();
  const customer: Customer = {
    id: generateId("c"),
    ...input,
    createdBy: userId,
    updatedBy: userId,
    createdAt: now,
    updatedAt: now,
  };

  await writeCustomerRow("insert", customerToRow(companyId, customer), userId);

  recordActivityLog({
    action: "created",
    targetType: "customer",
    targetId: customer.id,
    targetLabel: customer.customerName,
    description: activityDescriptionCreated("customer", customer.customerName),
  });

  return customer;
}

export async function dbUpdateCustomer(
  id: string,
  input: CustomerInput
): Promise<Customer | null> {
  const companyId = await resolveCompanyId();
  const userId = await getAuthUserId();
  const supabase = getSupabaseClient();
  const { data: existing, error: fetchError } = await supabase
    .from("customers")
    .select("*")
    .eq("id", id)
    .single();
  if (fetchError) {
    logSupabaseError("dbUpdateCustomer fetch", fetchError);
    throw toUserFacingDbError(fetchError);
  }
  if (!existing) return null;

  const prev = customerFromRow(existing as CustomerRow);
  const updated: Customer = {
    ...prev,
    ...input,
    updatedBy: userId,
    updatedAt: new Date().toISOString(),
  };

  await writeCustomerRow(
    "update",
    customerToRow(companyId, updated),
    userId,
    id
  );

  recordActivityLog({
    action: "updated",
    targetType: "customer",
    targetId: updated.id,
    targetLabel: updated.customerName,
    description: activityDescriptionUpdated("customer", updated.customerName),
  });

  return updated;
}

export async function dbDeleteCustomer(id: string): Promise<boolean> {
  const companyId = await resolveCompanyId();
  const supabase = getSupabaseClient();
  const { data, error: fetchError } = await supabase
    .from("customers")
    .select("customer_name")
    .eq("id", id)
    .eq("company_id", companyId)
    .maybeSingle();
  if (fetchError) {
    logSupabaseError("dbDeleteCustomer fetch", fetchError);
    throw toUserFacingDbError(fetchError);
  }

  const customerName = String(data?.customer_name ?? "");

  const { error } = await supabase.from("customers").delete().eq("id", id);
  if (error) {
    logSupabaseError("dbDeleteCustomer", error);
    throw toUserFacingDbError(error);
  }

  recordActivityLog({
    action: "deleted",
    targetType: "customer",
    targetId: id,
    targetLabel: customerName,
    description: activityDescriptionDeleted("customer", customerName),
  });

  return true;
}
