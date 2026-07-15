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
import {
  resolveProjectFieldsAfterInvoiceChange,
  resolveStoredInvoiceStatus,
} from "@/lib/invoice-state";
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

async function syncProjectInvoiceFields(
  projectId: string,
  companyId: string,
  now: string
): Promise<void> {
  const supabase = getSupabaseClient();
  const { data: projectData } = await supabase
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .eq("company_id", companyId)
    .maybeSingle();
  if (!projectData) return;

  const { data: siblingRows } = await supabase
    .from("invoices")
    .select("*")
    .eq("project_id", projectId)
    .eq("company_id", companyId);
  const siblingInvoices = (siblingRows ?? []).map((row) =>
    invoiceFromRow(row as InvoiceRow)
  );
  const derived = resolveProjectFieldsAfterInvoiceChange(projectId, siblingInvoices);
  await dbUpsertProject({
    ...projectFromRow(projectData as ProjectRow),
    ...derived,
    updatedAt: now,
  });
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
  const totals = computeLineTotals(items, {
    discountLabel: input.discountLabel,
    discountAmount: input.discountAmount,
  });
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
    discountLabel: input.discountLabel?.trim() ?? "",
    discountAmount: input.discountAmount ?? 0,
    customerContactName: input.customerContactName?.trim() ?? "",
    customerDepartment: input.customerDepartment?.trim() ?? "",
    customerPosition: input.customerPosition?.trim() ?? "",
    pdfUrl: null,
    memo: input.memo,
    paymentTerms: input.paymentTerms,
    bankAccountId,
    createdBy: userId,
    updatedBy: userId,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
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

  const { data: projectData } = await supabase
    .from("projects")
    .select("*")
    .eq("id", input.projectId)
    .eq("company_id", companyId)
    .maybeSingle();

  if (projectData) {
    const project = projectFromRow(projectData as ProjectRow);
    const { data: siblingRows } = await supabase
      .from("invoices")
      .select("*")
      .eq("project_id", input.projectId)
      .eq("company_id", companyId);
    const siblingInvoices = (siblingRows ?? []).map((row) =>
      invoiceFromRow(row as InvoiceRow)
    );
    const derived = resolveProjectFieldsAfterInvoiceChange(
      input.projectId,
      siblingInvoices
    );
    await dbUpsertProject({
      ...project,
      ...derived,
      updatedAt: now,
    });
    await dbInsertHistory({
      projectId: input.projectId,
      type: "invoice_generated",
      title: "請求書を作成しました",
      description: invoice.invoiceNumber,
    });
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
    .eq("company_id", companyId)
    .single();
  if (fetchError || !data) return null;

  const existing = invoiceFromRow(data as InvoiceRow);
  const now = new Date().toISOString();
  const items = buildInvoiceItems(companyId, invoiceId, input, now).map((it) => ({
    ...it,
    id: generateId("invi_"),
  }));
  const totals = computeLineTotals(items, {
    discountLabel: input.discountLabel,
    discountAmount: input.discountAmount,
  });
  const bankAccountId = await dbResolveBankAccountId(input.bankAccountId);

  const draft: InvoiceRecord = {
    ...existing,
    projectId: input.projectId,
    customerId: input.customerId,
    quoteId: input.quoteId,
    issueDate: input.issueDate,
    dueDate: input.dueDate,
    subtotal: totals.subtotal,
    taxAmount: totals.taxAmount,
    totalAmount: totals.totalAmount,
    discountLabel: input.discountLabel?.trim() ?? "",
    discountAmount: input.discountAmount ?? 0,
    customerContactName: input.customerContactName?.trim() ?? "",
    customerDepartment: input.customerDepartment?.trim() ?? "",
    customerPosition: input.customerPosition?.trim() ?? "",
    memo: input.memo,
    paymentTerms: input.paymentTerms,
    bankAccountId,
    updatedAt: now,
  };
  const invoice: InvoiceRecord = {
    ...draft,
    status: resolveStoredInvoiceStatus(draft),
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

  await syncProjectInvoiceFields(input.projectId, companyId, now);

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

export async function dbSoftDeleteInvoice(invoiceId: string): Promise<InvoiceRecord | null> {
  const companyId = await resolveCompanyId();
  const supabase = getSupabaseClient();
  const { data, error: fetchError } = await supabase
    .from("invoices")
    .select("*")
    .eq("id", invoiceId)
    .eq("company_id", companyId)
    .maybeSingle();
  if (fetchError) throw fetchError;
  if (!data) return null;

  const existing = invoiceFromRow(data as InvoiceRow);
  if (existing.deletedAt) return existing;

  const now = new Date().toISOString();
  const updated: InvoiceRecord = {
    ...existing,
    deletedAt: now,
    updatedAt: now,
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
    .maybeSingle();

  if (projectData) {
    const project = projectFromRow(projectData as ProjectRow);
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
    await dbUpsertProject({
      ...project,
      ...derived,
      updatedAt: now,
    });
    await dbInsertHistory({
      projectId: updated.projectId,
      type: "updated",
      title: "請求書を削除しました",
      description: updated.invoiceNumber,
    });
  }

  recordActivityLog({
    action: "deleted",
    targetType: "invoice",
    targetId: invoiceId,
    targetLabel: updated.invoiceNumber,
    description: activityDescriptionDeleted("invoice", updated.invoiceNumber),
  });

  return updated;
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

    const siblingInvoicesForDerived = async () => {
      const { data: siblingRows } = await supabase
        .from("invoices")
        .select("*")
        .eq("project_id", updated.projectId)
        .eq("company_id", companyId);
      return (siblingRows ?? []).map((row) => invoiceFromRow(row as InvoiceRow));
    };

    if (status === "issued") {
      const derived = resolveProjectFieldsAfterInvoiceChange(
        updated.projectId,
        (await siblingInvoicesForDerived()).map((inv) =>
          inv.id === updated.id ? updated : inv
        )
      );
      patch = {
        ...patch,
        status: "completed",
        ...derived,
      };
      await dbInsertHistory({
        projectId: updated.projectId,
        type: "invoice_generated",
        title: "請求書を発行済みにしました",
        description: updated.invoiceNumber,
      });
    }
    if (status === "sent") {
      const derived = resolveProjectFieldsAfterInvoiceChange(
        updated.projectId,
        (await siblingInvoicesForDerived()).map((inv) =>
          inv.id === updated.id ? updated : inv
        )
      );
      patch = { ...patch, ...derived };
      await dbInsertHistory({
        projectId: updated.projectId,
        type: "updated",
        title: "請求書を送付済みにしました",
        description: updated.invoiceNumber,
      });
    }
    if (status === "paid") {
      const derived = resolveProjectFieldsAfterInvoiceChange(
        updated.projectId,
        (await siblingInvoicesForDerived()).map((inv) =>
          inv.id === updated.id ? updated : inv
        )
      );
      patch = { ...patch, status: "completed", ...derived };
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

export async function dbRefreshOverdueInvoices(): Promise<boolean> {
  const companyId = await resolveCompanyId();
  const supabase = getSupabaseClient();
  const now = new Date().toISOString();
  const userId = await getAuthUserId();
  const today = new Date();

  const { data: rows, error } = await supabase
    .from("invoices")
    .select("*")
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .in("status", ["issued", "sent", "overdue"]);
  if (error) throw error;

  const invoices = (rows ?? []).map((row) => invoiceFromRow(row as InvoiceRow));
  const affectedProjectIds = new Set<string>();
  let changed = false;

  for (const inv of invoices) {
    if (inv.status === "cancelled") continue;
    const nextStatus = resolveStoredInvoiceStatus(inv, today);
    if (nextStatus === inv.status) continue;

    changed = true;
    affectedProjectIds.add(inv.projectId);
    const { error: updateError } = await supabase
      .from("invoices")
      .update(
        withUpdateAudit(
          {
            status: nextStatus,
            updated_at: now,
          },
          userId
        )
      )
      .eq("id", inv.id)
      .eq("company_id", companyId);
    if (updateError) throw updateError;
  }

  await Promise.all(
    [...affectedProjectIds].map((projectId) =>
      syncProjectInvoiceFields(projectId, companyId, now)
    )
  );

  return changed;
}
