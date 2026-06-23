import type {
  InvoiceDocumentStatus,
  InvoiceInput,
  InvoiceItemRecord,
  InvoiceRecord,
} from "@/lib/types";
import { getSupabaseClient } from "@/lib/supabase/client";
import { resolveCompanyId } from "@/lib/db/company-context";
import { generateId } from "@/lib/db/ids";
import {
  buildInvoiceItems,
  computeLineTotals,
  invoiceFromRow,
  invoiceItemToRow,
  invoiceToRow,
  type InvoiceRow,
} from "@/lib/db/mappers";
import { dbInsertHistory, dbUpsertProject } from "@/lib/db/write-projects";
import { projectFromRow, type ProjectRow } from "@/lib/db/mappers";
import { resolveProjectFieldsAfterInvoiceChange } from "@/lib/invoice-project-sync";
import { insertRowsWithConstructionFallback } from "@/lib/db/line-item-insert";
import { dbResolveBankAccountId } from "@/lib/db/write-bank-accounts";

async function nextInvoiceNumber(issueDate: string): Promise<string> {
  const y = issueDate.slice(0, 4);
  const supabase = getSupabaseClient();
  const { count, error } = await supabase
    .from("invoices")
    .select("*", { count: "exact", head: true })
    .like("invoice_number", `INV-${y}-%`);
  if (error) throw error;
  const n = (count ?? 0) + 1;
  return `INV-${y}-${String(n).padStart(4, "0")}`;
}

function isOverdue(dueDate: string) {
  if (!dueDate) return false;
  return new Date(dueDate + "T23:59:59") < new Date();
}

export async function dbInsertInvoice(
  input: InvoiceInput
): Promise<{ invoice: InvoiceRecord; items: InvoiceItemRecord[] }> {
  const companyId = await resolveCompanyId();
  const now = new Date().toISOString();
  const invoiceId = generateId("inv_");
  const items = buildInvoiceItems(companyId, invoiceId, input, now).map((it) => ({
    ...it,
    id: generateId("invi_"),
  }));
  const totals = computeLineTotals(items);
  const bankAccountId = await dbResolveBankAccountId(input.bankAccountId);

  const invoice: InvoiceRecord = {
    id: invoiceId,
    projectId: input.projectId,
    customerId: input.customerId,
    quoteId: input.quoteId,
    invoiceNumber: await nextInvoiceNumber(input.issueDate),
    issueDate: input.issueDate,
    dueDate: input.dueDate,
    status: "draft",
    subtotal: totals.subtotal,
    taxAmount: totals.taxAmount,
    totalAmount: totals.totalAmount,
    pdfUrl: null,
    memo: input.memo,
    paymentTerms: input.paymentTerms,
    bankAccountId,
    createdAt: now,
    updatedAt: now,
  };

  const supabase = getSupabaseClient();
  const { error: invError } = await supabase
    .from("invoices")
    .insert(invoiceToRow(companyId, invoice));
  if (invError) throw invError;

  try {
    await insertRowsWithConstructionFallback(
      async (rows) => {
        const { error } = await supabase.from("invoice_items").insert(rows);
        return { error };
      },
      items.map((i) => invoiceItemToRow(companyId, i))
    );
  } catch (error) {
    await supabase.from("invoices").delete().eq("id", invoiceId);
    throw error;
  }

  return { invoice, items };
}

export async function dbUpdateInvoice(
  invoiceId: string,
  input: InvoiceInput
): Promise<{ invoice: InvoiceRecord; items: InvoiceItemRecord[] } | null> {
  const companyId = await resolveCompanyId();
  const supabase = getSupabaseClient();
  const { data, error: fetchError } = await supabase
    .from("invoices")
    .select("*")
    .eq("id", invoiceId)
    .single();
  if (fetchError || !data) return null;

  const existing = invoiceFromRow(data as InvoiceRow);
  const now = new Date().toISOString();
  const items = buildInvoiceItems(companyId, invoiceId, input, now).map((it) => ({
    ...it,
    id: generateId("invi_"),
  }));
  const totals = computeLineTotals(items);
  const bankAccountId = await dbResolveBankAccountId(input.bankAccountId);

  const invoice: InvoiceRecord = {
    ...existing,
    projectId: input.projectId,
    customerId: input.customerId,
    quoteId: input.quoteId,
    issueDate: input.issueDate,
    dueDate: input.dueDate,
    subtotal: totals.subtotal,
    taxAmount: totals.taxAmount,
    totalAmount: totals.totalAmount,
    memo: input.memo,
    paymentTerms: input.paymentTerms,
    bankAccountId,
    updatedAt: now,
  };

  const { error: updateError } = await supabase
    .from("invoices")
    .update(invoiceToRow(companyId, invoice))
    .eq("id", invoiceId);
  if (updateError) throw updateError;

  await supabase.from("invoice_items").delete().eq("invoice_id", invoiceId);
  await insertRowsWithConstructionFallback(
    async (rows) => {
      const { error } = await supabase.from("invoice_items").insert(rows);
      return { error };
    },
    items.map((i) => invoiceItemToRow(companyId, i))
  );

  return { invoice, items };
}

export async function dbDeleteInvoice(invoiceId: string): Promise<boolean> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from("invoices").delete().eq("id", invoiceId);
  if (error) throw error;
  return true;
}

export async function dbUpdateInvoiceStatus(
  invoiceId: string,
  status: InvoiceDocumentStatus
): Promise<InvoiceRecord | null> {
  const companyId = await resolveCompanyId();
  const supabase = getSupabaseClient();
  const { data, error: fetchError } = await supabase
    .from("invoices")
    .select("*")
    .eq("id", invoiceId)
    .single();
  if (fetchError || !data) return null;

  const existing = invoiceFromRow(data as InvoiceRow);
  const updated: InvoiceRecord = {
    ...existing,
    status,
    updatedAt: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("invoices")
    .update(invoiceToRow(companyId, updated))
    .eq("id", invoiceId);
  if (error) throw error;

  const { data: projectData } = await supabase
    .from("projects")
    .select("*")
    .eq("id", updated.projectId)
    .single();

  if (projectData) {
    const project = projectFromRow(projectData as ProjectRow);
    let patch = { ...project, updatedAt: new Date().toISOString() };

    if (status === "issued") {
      patch = {
        ...patch,
        status: "completed",
        invoiceStatus: "issued",
        paymentStatus: isOverdue(updated.dueDate) ? "overdue" : "unpaid",
      };
      await dbInsertHistory({
        projectId: updated.projectId,
        type: "invoice_generated",
        title: "請求書を発行済みにしました",
        description: updated.invoiceNumber,
      });
    }
    if (status === "sent") {
      patch = { ...patch, invoiceStatus: "sent" };
      await dbInsertHistory({
        projectId: updated.projectId,
        type: "updated",
        title: "請求書を送付済みにしました",
        description: updated.invoiceNumber,
      });
    }
    if (status === "paid") {
      patch = { ...patch, status: "completed", paymentStatus: "paid" };
      await dbInsertHistory({
        projectId: updated.projectId,
        type: "payment_received",
        title: "入金済みにしました",
        description: updated.invoiceNumber,
      });
    }
    if (status === "cancelled") {
      const { data: siblingRows } = await supabase
        .from("invoices")
        .select("*")
        .eq("project_id", updated.projectId);
      const siblingInvoices = (siblingRows ?? []).map((row) =>
        invoiceFromRow(row as InvoiceRow)
      );
      const derived = resolveProjectFieldsAfterInvoiceChange(
        updated.projectId,
        siblingInvoices,
        { excludeInvoiceId: updated.id }
      );
      patch = { ...patch, ...derived };
      await dbInsertHistory({
        projectId: updated.projectId,
        type: "updated",
        title: "請求書をキャンセルしました",
        description: updated.invoiceNumber,
      });
      await dbUpsertProject(patch);
    }

    if (status === "issued" || status === "sent" || status === "paid") {
      await dbUpsertProject(patch);
    }
  }

  return updated;
}

export async function dbRefreshOverdueInvoices(): Promise<void> {
  const companyId = await resolveCompanyId();
  const supabase = getSupabaseClient();
  const now = new Date().toISOString();

  const { data: invoices, error } = await supabase
    .from("invoices")
    .select("*")
    .in("status", ["issued", "sent"]);
  if (error) throw error;

  for (const row of invoices ?? []) {
    const inv = invoiceFromRow(row as InvoiceRow);
    if (!isOverdue(inv.dueDate)) continue;

    const updated: InvoiceRecord = { ...inv, status: "overdue", updatedAt: now };
    await supabase
      .from("invoices")
      .update(invoiceToRow(companyId, updated))
      .eq("id", inv.id);

    const { data: projectData } = await supabase
      .from("projects")
      .select("*")
      .eq("id", inv.projectId)
      .single();
    if (projectData) {
      const project = projectFromRow(projectData as ProjectRow);
      await dbUpsertProject({
        ...project,
        paymentStatus: "overdue",
        updatedAt: now,
      });
    }
  }
}
