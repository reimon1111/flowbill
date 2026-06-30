import { getSupabaseClient } from "@/lib/supabase/client";
import { projectFromRow, type ProjectRow } from "@/lib/db/mappers";
import { normalizeEntityId } from "@/lib/project-display";
import type { ProjectRecord } from "@/lib/types";

/**
 * 書類が参照する project_id のうち、一覧取得に含まれていない案件を追加取得する。
 * DB 上は紐づいているが初回 projects クエリに含まれなかった場合のフォールバック。
 */
export async function fetchSupplementalProjects(
  companyId: string,
  projects: ProjectRecord[],
  referencedProjectIds: unknown[]
): Promise<ProjectRecord[]> {
  const known = new Set(projects.map((p) => normalizeEntityId(p.id)));
  const missing = [
    ...new Set(
      referencedProjectIds
        .map(normalizeEntityId)
        .filter((id) => id.length > 0 && !known.has(id))
    ),
  ];

  if (missing.length === 0) return projects;

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("company_id", companyId)
    .in("id", missing);

  if (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[fetchSupplementalProjects] failed", { missing, error });
    }
    return projects;
  }

  const supplemental = (data as ProjectRow[]).map(projectFromRow);
  if (process.env.NODE_ENV !== "production") {
    console.warn("[fetchSupplementalProjects] merged", {
      requested: missing.length,
      fetched: supplemental.length,
      missingIds: missing,
      projectsBefore: projects.length,
    });
  }

  const merged = [...projects];
  const mergedIds = new Set(known);
  for (const project of supplemental) {
    const id = normalizeEntityId(project.id);
    if (!mergedIds.has(id)) {
      merged.push(project);
      mergedIds.add(id);
    }
  }
  return merged;
}

export function collectProjectIdsFromDocuments(
  ...groups: Array<Array<{ projectId?: string | null }>>
): string[] {
  return groups.flatMap((group) =>
    group.map((row) => normalizeEntityId(row.projectId)).filter(Boolean)
  );
}
