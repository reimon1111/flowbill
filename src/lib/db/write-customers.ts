import type { Customer, CustomerInput } from "@/lib/types";
import { getSupabaseClient } from "@/lib/supabase/client";
import { resolveCompanyId } from "@/lib/db/company-context";
import { generateId } from "@/lib/db/ids";
import { customerFromRow, customerToRow, type CustomerRow } from "@/lib/db/mappers";

export async function dbInsertCustomer(input: CustomerInput): Promise<Customer> {
  const companyId = await resolveCompanyId();
  const now = new Date().toISOString();
  const customer: Customer = {
    id: generateId("c"),
    ...input,
    createdAt: now,
    updatedAt: now,
  };
  const supabase = getSupabaseClient();
  const { error } = await supabase.from("customers").insert(customerToRow(companyId, customer));
  if (error) throw error;
  return customer;
}

export async function dbUpdateCustomer(
  id: string,
  input: CustomerInput
): Promise<Customer | null> {
  const companyId = await resolveCompanyId();
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
    updatedAt: new Date().toISOString(),
  };
  const { error } = await supabase
    .from("customers")
    .update(customerToRow(companyId, updated))
    .eq("id", id);
  if (error) throw error;
  return updated;
}

export async function dbDeleteCustomer(id: string): Promise<boolean> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from("customers").delete().eq("id", id);
  if (error) throw error;
  return true;
}
