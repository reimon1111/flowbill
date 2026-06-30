"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { ProjectStatusBadge } from "@/components/projects/project-status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/format";
import { PROJECT_STATUS_OPTIONS } from "@/lib/project-utils";
import {
  SCHEDULE_DAY_WIDTH,
  SCHEDULE_HEADER_HEIGHT,
  SCHEDULE_ROW_HEIGHT,
  SCHEDULE_STATUS_BAR_STYLES,
  addDays,
  buildDateRange,
  formatIsoDate,
  getBarPosition,
  getMonthDayCount,
  isSameDay,
  isWeekend,
  overlapsRange,
  parseIsoDate,
  projectHasSchedule,
  startOfDay,
  type ScheduleRangeMonths,
} from "@/lib/project-schedule-utils";
import type { ProjectListItem, ProjectStatus } from "@/lib/types";
import { useProjectStore } from "@/stores/project-store";

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-xl px-3.5 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-zinc-900 text-white"
          : "bg-white text-zinc-600 ring-1 ring-zinc-200/80 hover:bg-zinc-50"
      )}
    >
      {children}
    </button>
  );
}

const LEFT_COL_CLASS = "w-[13.75rem] shrink-0 sm:w-[16.25rem] lg:w-[17.5rem]";

function ScheduleProjectListItem({ project }: { project: ProjectListItem }) {
  const assignee = project.assigneeName.trim();

  return (
    <Link
      href={`/projects/${project.id}`}
      className="flex min-w-0 flex-col justify-center gap-1 border-b border-zinc-100 px-4 py-3 transition-colors hover:bg-muted/40"
      style={{ minHeight: SCHEDULE_ROW_HEIGHT }}
    >
      <div className="flex min-w-0 items-center gap-2">
        <span
          className="min-w-0 flex-1 truncate text-sm font-semibold text-zinc-900 sm:text-[15px]"
          title={project.projectName}
        >
          {project.projectName}
        </span>
        <ProjectStatusBadge
          status={project.status}
          className="shrink-0 gap-1 rounded-md px-1.5 py-0.5 text-xs leading-4 whitespace-nowrap [&>span:first-child]:size-1"
        />
      </div>
      <p
        className="min-w-0 truncate text-xs text-muted-foreground sm:text-sm"
        title={project.customerName}
      >
        {project.customerName}
      </p>
      {assignee ? (
        <p className="min-w-0 truncate text-xs text-muted-foreground" title={assignee}>
          担当：{assignee}
        </p>
      ) : null}
      <p className="truncate text-xs tabular-nums text-muted-foreground">
        更新：{formatDateTime(project.updatedAt)}
      </p>
    </Link>
  );
}

function ScheduleToolbar({
  viewStart,
  rangeMonths,
  statusFilter,
  assigneeFilter,
  assignees,
  onViewStartChange,
  onRangeChange,
  onStatusChange,
  onAssigneeChange,
  onToday,
  onShift,
}: {
  viewStart: string;
  rangeMonths: ScheduleRangeMonths;
  statusFilter: ProjectStatus | "all";
  assigneeFilter: string;
  assignees: string[];
  onViewStartChange: (value: string) => void;
  onRangeChange: (months: ScheduleRangeMonths) => void;
  onStatusChange: (status: ProjectStatus | "all") => void;
  onAssigneeChange: (assignee: string) => void;
  onToday: () => void;
  onShift: (days: number) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <p className="mb-1.5 text-xs font-medium text-zinc-500">表示開始日</p>
          <Input
            type="date"
            value={viewStart}
            onChange={(e) => onViewStartChange(e.target.value)}
            className="h-10 w-40 rounded-xl"
          />
        </div>
        <Button type="button" variant="outline" className="h-10 rounded-xl" onClick={onToday}>
          今日
        </Button>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-10 rounded-xl"
            onClick={() => onShift(-7)}
            aria-label="1週間前へ"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-10 rounded-xl"
            onClick={() => onShift(7)}
            aria-label="1週間後へ"
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {([1, 2, 3] as ScheduleRangeMonths[]).map((months) => (
            <FilterChip
              key={months}
              active={rangeMonths === months}
              onClick={() => onRangeChange(months)}
            >
              {months}ヶ月
            </FilterChip>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <FilterChip active={statusFilter === "all"} onClick={() => onStatusChange("all")}>
          すべて
        </FilterChip>
        {PROJECT_STATUS_OPTIONS.map((option) => (
          <FilterChip
            key={option.value}
            active={statusFilter === option.value}
            onClick={() => onStatusChange(option.value)}
          >
            {option.label}
          </FilterChip>
        ))}
      </div>

      {assignees.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          <FilterChip
            active={assigneeFilter === "all"}
            onClick={() => onAssigneeChange("all")}
          >
            担当者すべて
          </FilterChip>
          {assignees.map((name) => (
            <FilterChip
              key={name}
              active={assigneeFilter === name}
              onClick={() => onAssigneeChange(name)}
            >
              {name}
            </FilterChip>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ScheduleTimelineHeader({
  dates,
  today,
}: {
  dates: Date[];
  today: Date;
}) {
  return (
    <div
      className="flex border-b border-zinc-200 bg-zinc-50/80"
      style={{ height: SCHEDULE_HEADER_HEIGHT }}
    >
      {dates.map((date) => {
        const todayMark = isSameDay(date, today);
        const weekend = isWeekend(date);
        return (
          <div
            key={formatIsoDate(date)}
            className={cn(
              "flex shrink-0 flex-col items-center justify-center border-r border-zinc-100 text-[10px]",
              weekend && "bg-zinc-100/80",
              todayMark && "bg-orange-50"
            )}
            style={{ width: SCHEDULE_DAY_WIDTH }}
          >
            <span className={cn("tabular-nums text-zinc-400", todayMark && "text-orange-600")}>
              {date.getMonth() + 1}/{date.getDate()}
            </span>
            <span className={cn("text-zinc-500", todayMark && "font-semibold text-orange-700")}>
              {["日", "月", "火", "水", "木", "金", "土"][date.getDay()]}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function ScheduleTimelineRow({
  project,
  dates,
  viewStart,
  today,
}: {
  project: ProjectListItem;
  dates: Date[];
  viewStart: Date;
  today: Date;
}) {
  const styles = SCHEDULE_STATUS_BAR_STYLES[project.status];
  const bar = getBarPosition(
    viewStart,
    dates.length,
    project.startDate,
    project.endDate,
    SCHEDULE_DAY_WIDTH
  );

  return (
    <div
      className="relative border-b border-zinc-100"
      style={{ minHeight: SCHEDULE_ROW_HEIGHT, width: dates.length * SCHEDULE_DAY_WIDTH }}
    >
      {dates.map((date, index) => {
        const todayMark = isSameDay(date, today);
        const weekend = isWeekend(date);
        return (
          <div
            key={formatIsoDate(date)}
            className={cn(
              "absolute top-0 bottom-0 border-r border-zinc-100",
              weekend && "bg-zinc-50/90",
              todayMark && "bg-orange-50/70"
            )}
            style={{ left: index * SCHEDULE_DAY_WIDTH, width: SCHEDULE_DAY_WIDTH }}
          />
        );
      })}

      {bar ? (
        <Link
          href={`/projects/${project.id}`}
          className={cn(
            "absolute top-1/2 flex h-7 -translate-y-1/2 items-center overflow-hidden rounded-md px-2 text-[11px] font-medium transition-opacity hover:opacity-90",
            styles.bar,
            styles.text
          )}
          style={{ left: bar.left + 2, width: bar.width }}
          title={project.projectName}
        >
          <span className="truncate">{project.projectName}</span>
        </Link>
      ) : null}
    </div>
  );
}

export function ProjectSchedulePage() {
  const today = useMemo(() => startOfDay(new Date()), []);
  const [viewStart, setViewStart] = useState(() => formatIsoDate(today));
  const [rangeMonths, setRangeMonths] = useState<ScheduleRangeMonths>(2);
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | "all">("all");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("all");

  useProjectStore((s) => s.projects);

  const allProjects = useProjectStore.getState().getListItems();
  const assignees = useMemo(
    () =>
      [
        ...new Set(
          allProjects
            .map((p) => p.assigneeName.trim())
            .filter(Boolean)
        ),
      ].sort(),
    [allProjects]
  );

  const viewStartDate = useMemo(() => parseIsoDate(viewStart), [viewStart]);
  const dayCount = getMonthDayCount(rangeMonths);
  const dates = useMemo(
    () => buildDateRange(viewStartDate, dayCount),
    [viewStartDate, dayCount]
  );
  const rangeEnd = dates[dates.length - 1];

  const projects = useMemo(() => {
    return allProjects
      .filter((p) => !p.archived)
      .filter((p) => projectHasSchedule(p.startDate, p.endDate))
      .filter((p) => overlapsRange(p.startDate, p.endDate, viewStartDate, rangeEnd))
      .filter((p) => statusFilter === "all" || p.status === statusFilter)
      .filter(
        (p) =>
          assigneeFilter === "all" ||
          p.assigneeName.trim() === assigneeFilter
      )
      .sort((a, b) => a.startDate.localeCompare(b.startDate));
  }, [
    allProjects,
    viewStartDate,
    rangeEnd,
    statusFilter,
    assigneeFilter,
  ]);

  return (
    <div className="mx-auto min-w-0 max-w-[1600px] space-y-6 px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <PageHeader
        title="案件予定"
        description="開始日〜完了予定日で案件の期間を一覧表示します（スマホでは横スクロールで期間を確認できます）"
      />

      <ScheduleToolbar
        viewStart={viewStart}
        rangeMonths={rangeMonths}
        statusFilter={statusFilter}
        assigneeFilter={assigneeFilter}
        assignees={assignees}
        onViewStartChange={setViewStart}
        onRangeChange={setRangeMonths}
        onStatusChange={setStatusFilter}
        onAssigneeChange={setAssigneeFilter}
        onToday={() => setViewStart(formatIsoDate(today))}
        onShift={(days) =>
          setViewStart(formatIsoDate(addDays(parseIsoDate(viewStart), days)))
        }
      />

      {projects.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-200 bg-white px-6 py-16 text-center">
          <p className="text-sm font-medium text-zinc-700">表示できる案件がありません</p>
          <p className="mt-2 text-sm text-zinc-500">
            案件の開始日・完了予定日を登録すると、ここに期間バーが表示されます。
          </p>
          <Link
            href="/projects"
            className="mt-4 inline-block text-sm font-medium text-zinc-900 underline-offset-4 hover:underline"
          >
            案件一覧へ
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-sm shadow-zinc-900/[0.03]">
          <div className="flex">
            <div className={cn("border-r border-zinc-200 bg-white", LEFT_COL_CLASS)}>
              <div
                className="flex items-end border-b border-zinc-200 bg-zinc-50/80 px-4 pb-2 text-xs font-medium text-zinc-500"
                style={{ height: SCHEDULE_HEADER_HEIGHT }}
              >
                案件
              </div>
              {projects.map((project) => (
                <ScheduleProjectListItem key={project.id} project={project} />
              ))}
            </div>

            <div className="min-w-0 flex-1 overflow-x-auto">
              <div style={{ minWidth: dates.length * SCHEDULE_DAY_WIDTH }}>
                <ScheduleTimelineHeader dates={dates} today={today} />
                {projects.map((project) => (
                  <ScheduleTimelineRow
                    key={project.id}
                    project={project}
                    dates={dates}
                    viewStart={viewStartDate}
                    today={today}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
