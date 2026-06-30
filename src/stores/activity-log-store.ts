"use client";

import { create } from "zustand";
import type { ActivityLogRecord } from "@/lib/types/activity-log";

type ActivityLogStore = {
  recentLogs: ActivityLogRecord[];
  hydrated: boolean;
  hydrateRecent: (logs: ActivityLogRecord[]) => void;
  prepend: (log: ActivityLogRecord) => void;
  reset: () => void;
};

export const useActivityLogStore = create<ActivityLogStore>((set) => ({
  recentLogs: [],
  hydrated: false,
  hydrateRecent: (logs) => set({ recentLogs: logs, hydrated: true }),
  prepend: (log) =>
    set((state) => ({
      recentLogs: [log, ...state.recentLogs.filter((l) => l.id !== log.id)].slice(
        0,
        10
      ),
    })),
  reset: () => set({ recentLogs: [], hydrated: false }),
}));
