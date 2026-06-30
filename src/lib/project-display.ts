import type { ProjectRecord } from "@/lib/types";

export const UNKNOWN_PROJECT_LABEL = "（不明な案件）";
export const UNKNOWN_CUSTOMER_LABEL = "（不明な顧客）";

/** ID 比較用に正規化（null / undefined / 空白を吸収） */
export function normalizeEntityId(id: unknown): string {
  if (id == null) return "";
  return String(id).trim();
}

export type ProjectNameIndex = Map<string, string>;

export function buildProjectNameIndex(
  projects: Array<Pick<ProjectRecord, "id" | "projectName">>
): ProjectNameIndex {
  const index = new Map<string, string>();
  for (const project of projects) {
    const id = normalizeEntityId(project.id);
    if (!id) continue;
    index.set(id, project.projectName);
  }
  return index;
}

export type ResolveProjectNameContext = {
  documentType?: string;
  documentId?: string;
  projectsLength?: number;
};

/**
 * 案件名を解決する。見つからない場合は開発時にデバッグログを出す。
 */
export function resolveProjectName(
  projectId: unknown,
  index: ProjectNameIndex,
  context?: ResolveProjectNameContext
): string {
  const id = normalizeEntityId(projectId);
  if (!id) {
    logUnknownProject("missing_project_id", projectId, index, context);
    return UNKNOWN_PROJECT_LABEL;
  }

  const name = index.get(id);
  if (!name) {
    logUnknownProject("project_not_in_index", id, index, context);
    return UNKNOWN_PROJECT_LABEL;
  }

  return name;
}

function logUnknownProject(
  reason: string,
  projectId: unknown,
  index: ProjectNameIndex,
  context?: ResolveProjectNameContext
): void {
  if (process.env.NODE_ENV === "production") return;

  console.warn("[resolveProjectName]", {
    reason,
    projectId,
    normalizedProjectId: normalizeEntityId(projectId),
    projectsLength: context?.projectsLength ?? index.size,
    documentType: context?.documentType,
    documentId: context?.documentId,
    sampleProjectIds: [...index.keys()].slice(0, 5),
  });
}

export function findProjectById(
  projects: ProjectRecord[],
  projectId: unknown
): ProjectRecord | undefined {
  const id = normalizeEntityId(projectId);
  if (!id) return undefined;
  return projects.find((p) => normalizeEntityId(p.id) === id);
}

export function resolveProjectNameFromStore(
  projectId: unknown,
  projects: ProjectRecord[],
  context?: ResolveProjectNameContext
): string {
  return resolveProjectName(projectId, buildProjectNameIndex(projects), {
    ...context,
    projectsLength: projects.length,
  });
}
