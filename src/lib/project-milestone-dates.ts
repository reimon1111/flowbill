import type { ProjectRecord, ProjectStatus } from "@/lib/types";
import { todayISO } from "@/lib/quote-dates";

const CONFIRMED_STATUSES: ProjectStatus[] = [
  "ordered",
  "in_progress",
  "completed",
];

export function applyProjectMilestoneDates(
  project: ProjectRecord,
  status: ProjectStatus
): ProjectRecord {
  const today = todayISO();
  let confirmedDate = project.confirmedDate;
  let completedDate = project.completedDate;

  if (CONFIRMED_STATUSES.includes(status) && !confirmedDate) {
    confirmedDate = today;
  }

  if (status === "completed" && !completedDate) {
    completedDate = today;
  }

  if (
    confirmedDate === project.confirmedDate &&
    completedDate === project.completedDate
  ) {
    return project;
  }

  return {
    ...project,
    confirmedDate,
    completedDate,
  };
}
