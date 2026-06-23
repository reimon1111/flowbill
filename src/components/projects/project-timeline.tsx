import { formatDateTime } from "@/lib/format";
import type { ProjectHistoryEvent } from "@/lib/types";
import { cn } from "@/lib/utils";

type ProjectTimelineProps = {
  events: ProjectHistoryEvent[];
};

const dotStyles: Record<ProjectHistoryEvent["type"], string> = {
  created: "bg-zinc-400",
  status_changed: "bg-blue-500",
  invoice_generated: "bg-violet-500",
  payment_received: "bg-emerald-500",
  updated: "bg-zinc-300",
};

export function ProjectTimeline({ events }: ProjectTimelineProps) {
  if (events.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-zinc-500">
        履歴はまだありません
      </p>
    );
  }

  return (
    <ol className="relative space-y-0 pl-1">
      {events.map((event, index) => (
        <li key={event.id} className="relative flex gap-4 pb-8 last:pb-0">
          {index < events.length - 1 && (
            <span
              className="absolute left-[7px] top-4 h-[calc(100%-8px)] w-px bg-zinc-200"
              aria-hidden
            />
          )}
          <span
            className={cn(
              "relative z-10 mt-1.5 size-3.5 shrink-0 rounded-full ring-4 ring-white",
              dotStyles[event.type]
            )}
          />
          <div className="min-w-0 flex-1 pt-0.5">
            <p className="font-medium text-zinc-900">{event.title}</p>
            {event.description && (
              <p className="mt-0.5 text-sm text-zinc-500">
                {event.description}
              </p>
            )}
            <p className="mt-1 text-xs text-zinc-400">
              {formatDateTime(event.createdAt)}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
