import type { ProjectInput, ProjectItemRecord } from "@/lib/types";
import { getSupabaseClient } from "@/lib/supabase/client";
import { resolveCompanyId } from "@/lib/db/company-context";
import { generateId } from "@/lib/db/ids";
import {
  buildProjectItems,
  projectItemFromRow,
  projectItemToRow,
  type ProjectItemRow,
} from "@/lib/db/mappers";

export async function dbReplaceProjectItems(
  projectId: string,
  input: ProjectInput
): Promise<ProjectItemRecord[]> {
  const companyId = await resolveCompanyId();
  const supabase = getSupabaseClient();
  const now = new Date().toISOString();

  const { error: delError } = await supabase
    .from("project_items")
    .delete()
    .eq("project_id", projectId);
  if (delError) throw delError;

  if (input.items.length === 0) return [];

  const records = buildProjectItems(companyId, projectId, input, now).map((it) => ({
    ...it,
    id: generateId("pi_"),
  }));

  const { error: insError } = await supabase
    .from("project_items")
    .insert(records.map((r) => projectItemToRow(companyId, r)));
  if (insError) throw insError;

  return records;
}

export async function dbFetchProjectItems(
  projectId: string
): Promise<ProjectItemRecord[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("project_items")
    .select("*")
    .eq("project_id", projectId)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data as ProjectItemRow[]).map(projectItemFromRow);
}
