import type {
  InvoiceDocumentStatus,
  InvoiceInput,
  InvoiceItemRecord,
  InvoiceRecord,
} from "@/lib/types";
import { getSupabaseClient } from "@/lib/supabase/client";
import { resolveCompanyId } from "@/lib/db/company-context";
import { getAuthUserId, withCreateAudit, withUpdateAudit } from "@/lib/db/auth-user";
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
import { recordActivityLog } from "@/lib/db/write-activity-log";
import {
  activityDescriptionCreated,
  activityDescriptionDeleted,
  activityDescriptionInvoiceIssued,
  activityDescriptionInvoicePaid,
  activityDescriptionUpdated,
} from "@/lib/activity-log-messages";

async function nextInvoiceNumber(issueDate: string, companyId: string): Promise<string> {
  const y = issueDate.slice(0, 4);
  const supabase = getSupabaseClient();
  const { count, error } = await supabase
    .from("invoices")
    .select("*", { count: "exact", head: true })
    .eq("company_id", companyId)
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
  const userId = await getAuthUserId();
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
    invoiceNumber: await nextInvoiceNumber(input.issueDate, companyId),
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
    createdBy: userId,
    updatedBy: userId,
    createdAt: now,
    updatedAt: now,
  };

  const supabase = getSupabaseClient();
  const { error: invError } = await supabase
    .from("invoices")
    .insert(withCreateAudit(invoiceToRow(companyId, invoice), userId));
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
    await supabase.from("invoices").delete().eq("id", invoiceId).eq("company_id", companyId);
    throw error;
  }

  recordActivityLog({
    action: "created",
    targetType: "invoice",
    targetId: invoice.id,
    targetLabel: invoice.invoiceNumber,
    description: activityDescriptionCreated("invoice", invoice.invoiceNumber),
  });

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
    .eq("company_id", companyId)
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

  const userId = await getAuthUserId();
  const { error: updateError } = await supabase
    .from("invoices")
    .update(withUpdateAudit(invoiceToRow(companyId, invoice), userId))
    .eq("id", invoiceId)
    .eq("company_id", companyId);
  if (updateError) throw updateError;

  await supabase
    .from("invoice_items")
    .delete()
    .eq("invoice_id", invoiceId)
    .eq("company_id", companyId);
  await insertRowsWithConstructionFallback(
    async (rows) => {
      const { error } = await supabase.from("invoice_items").insert(rows);
      return { error };
    },
    items.map((i) => invoiceItemToRow(companyId, i))
  );

  recordActivityLog({
    action: "updated",
    targetType: "invoice",
    targetId: invoice.id,
    targetLabel: invoice.invoiceNumber,
    description: activityDescriptionUpdated("invoice", invoice.invoiceNumber),
  });

  return { invoice, items };
}

export async function dbDeleteInvoice(invoiceId: string): Promise<boolean> {
  const companyId = await resolveCompanyId();
  const supabase = getSupabaseClient();
  const { data, error: fetchError } = await supabase
    .from("invoices")
    .select("invoice_number")
    .eq("id", invoiceId)
    .eq("company_id", companyId)
    .maybeSingle();
  if (fetchError) throw fetchError;

  const invoiceNumber = String(data?.invoice_number ?? "");

  const { error } = await supabase
    .from("invoices")
    .delete()
    .eq("id", invoiceId)
    .eq("company_id", companyId);
  if (error) throw error;

  recordActivityLog({
    action: "deleted",
    targetType: "invoice",
    targetId: invoiceId,
    targetLabel: invoiceNumber,
    description: activityDescriptionDeleted("invoice", invoiceNumber),
  });

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
    .eq("company_id", companyId)
    .single();
  if (fetchError || !data) return null;

  const existing = invoiceFromRow(data as InvoiceRow);
  const updated: InvoiceRecord = {
    ...existing,
    status,
    updatedAt: new Date().toISOString(),
  };

  const userId = await getAuthUserId();
  const { error } = await supabase
    .from("invoices")
    .update(withUpdateAudit(invoiceToRow(companyId, updated), userId))
    .eq("id", invoiceId)
    .eq("company_id", companyId);
  if (error) throw error;

  const { data: projectData } = await supabase
    .from("projects")
    .select("*")
    .eq("id", updated.projectId)
    .eq("company_id", companyId)
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
        .eq("project_id", updated.projectId)
        .eq("company_id", companyId);
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

  if (status === "issued") {
    recordActivityLog({
      action: "issued",
      targetType: "invoice",
      targetId: updated.id,
      targetLabel: updated.invoiceNumber,
      description: activityDescriptionInvoiceIssued(updated.invoiceNumber),
    });
  } else if (status === "paid") {
    recordActivityLog({
      action: "paid",
      targetType: "invoice",
      targetId: updated.id,
      targetLabel: updated.invoiceNumber,
      description: activityDescriptionInvoicePaid(updated.invoiceNumber),
    });
  } else {
    recordActivityLog({
      action: "updated",
      targetType: "invoice",
      targetId: updated.id,
      targetLabel: updated.invoiceNumber,
      description: activityDescriptionUpdated("invoice", updated.invoiceNumber),
    });
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
    .eq("company_id", companyId)
    .in("status", ["issued", "sent"]);
  if (error) throw error;

  for (const row of invoices ?? []) {
    const inv = invoiceFromRow(row as InvoiceRow);
    if (!isOverdue(inv.dueDate)) continue;

    const updated: InvoiceRecord = { ...inv, status: "overdue", updatedAt: now };
    await supabase
      .from("invoices")
      .update(withUpdateAudit(invoiceToRow(companyId, updated), await getAuthUserId()))
      .eq("id", inv.id)
      .eq("company_id", companyId);

    const { data: projectData } = await supabase
      .from("projects")
      .select("*")
      .eq("id", inv.projectId)
      .eq("company_id", companyId)
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
