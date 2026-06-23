"use client";

import { create } from "zustand";
import type { ProjectItemInput, ProjectItemRecord } from "@/lib/types";
import { normalizeUnit } from "@/lib/constants/units";
import { lineItemAmount } from "@/lib/line-item-utils";

function id(prefix: string) {
  return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

type ProjectItemStore = {
  projectItems: ProjectItemRecord[];
  hydrate: (items: ProjectItemRecord[]) => void;
  getByProjectId: (projectId: string) => ProjectItemRecord[];
  replaceForProject: (
    projectId: string,
    inputs: ProjectItemInput[]
  ) => ProjectItemRecord[];
  removeForProject: (projectId: string) => void;
};

export const useProjectItemStore = create<ProjectItemStore>((set, get) => ({
  projectItems: [],

  hydrate: (items) => set({ projectItems: items }),

  getByProjectId: (projectId) =>
    get()
      .projectItems.filter((i) => i.projectId === projectId)
      .sort((a, b) => a.sortOrder - b.sortOrder),

  replaceForProject: (projectId, inputs) => {
    const now = new Date().toISOString();
    const records: ProjectItemRecord[] = inputs.map((it, idx) => {
      const amount = lineItemAmount(it.quantity, it.unitPrice);
      return {
        id: id("pi_"),
        projectId,
        itemTemplateId: it.itemTemplateId,
        name: it.name,
        description: it.description,
        width: it.width ?? "",
        height: it.height ?? "",
        quantity: it.quantity,
        unit: normalizeUnit(it.unit),
        unitPrice: it.unitPrice,
        taxRate: it.taxRate,
        amount,
        sortOrder: it.sortOrder ?? idx,
        createdAt: now,
        updatedAt: now,
      };
    });

    set((state) => ({
      projectItems: [
        ...state.projectItems.filter((i) => i.projectId !== projectId),
        ...records,
      ],
    }));

    return records;
  },

  removeForProject: (projectId) =>
    set((state) => ({
      projectItems: state.projectItems.filter((i) => i.projectId !== projectId),
    })),
}));
