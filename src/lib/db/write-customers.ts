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
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from("customers")
    .insert(withCreateAudit(customerToRow(companyId, customer), userId));
  if (error) throw error;

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
  if (fetchError || !existing) return null;

  const prev = customerFromRow(existing as CustomerRow);
  const updated: Customer = {
    ...prev,
    ...input,
    updatedBy: userId,
    updatedAt: new Date().toISOString(),
  };
  const { error } = await supabase
    .from("customers")
    .update(withUpdateAudit(customerToRow(companyId, updated), userId))
    .eq("id", id);
  if (error) throw error;

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
  if (fetchError) throw fetchError;

  const customerName = String(data?.customer_name ?? "");

  const { error } = await supabase.from("customers").delete().eq("id", id);
  if (error) throw error;

  recordActivityLog({
    action: "deleted",
    targetType: "customer",
    targetId: id,
    targetLabel: customerName,
    description: activityDescriptionDeleted("customer", customerName),
  });

  return true;
}
