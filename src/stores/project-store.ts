import { create } from "zustand";
import {
  getDefaultInvoiceStatus,
  getDefaultPaymentStatus,
  getNextAction,
  getStatusAfterAction,
} from "@/lib/project-utils";
import {
  initialProjectHistories,
  initialProjects,
} from "@/lib/mock-projects";
import { initialStoreData } from "@/lib/stores/store-initial";
import type {
  ProjectActionType,
  ProjectHistoryEvent,
  ProjectInput,
  ProjectListItem,
  ProjectRecord,
  ProjectStatus,
} from "@/lib/types";
import { useCustomerStore } from "@/stores/customer-store";
import { findProjectById } from "@/lib/project-display";
import { PROJECT_STATUS_LABELS } from "@/lib/constants";
import { applyProjectMilestoneDates } from "@/lib/project-milestone-dates";
import { getProjectInvoiceState } from "@/lib/invoice-state";
import { useInvoiceStore } from "@/stores/invoice-store";

function generateId(prefix: string): string {
  return `${prefix}${Date.now().toString(36)}`;
}

function enrichProject(project: ProjectRecord): ProjectListItem {
  const customer = useCustomerStore
    .getState()
    .getCustomerById(project.customerId);
  const invoiceState = getProjectInvoiceState(
    project.id,
    useInvoiceStore.getState().invoices
  );
  return {
    ...project,
    invoiceStatus: invoiceState.invoiceStatus,
    paymentStatus: invoiceState.paymentStatus,
    customerName: customer?.customerName ?? "（削除された顧客）",
    nextAction: getNextAction({
      status: project.status,
      invoiceStatus: invoiceState.invoiceStatus,
      paymentStatus: invoiceState.paymentStatus,
      hasMultipleActive: invoiceState.hasMultipleActive,
    }),
  };
}

function syncDerivedFields(
  project: ProjectRecord,
  status: ProjectStatus
): ProjectRecord {
  return applyProjectMilestoneDates(
    {
      ...project,
      status,
      invoiceStatus: getDefaultInvoiceStatus(status),
      paymentStatus: getDefaultPaymentStatus(status, project.dueDate),
      updatedAt: new Date().toISOString(),
    },
    status
  );
}

type ProjectStore = {
  projects: ProjectRecord[];
  histories: ProjectHistoryEvent[];
  hydrate: (data: {
    projects: ProjectRecord[];
    histories: ProjectHistoryEvent[];
  }) => void;
  upsertProject: (project: ProjectRecord) => void;
  removeProject: (id: string) => void;
  appendHistory: (history: ProjectHistoryEvent) => void;
  getProjectById: (id: string) => ProjectRecord | undefined;
  getListItems: () => ProjectListItem[];
  addProject: (input: ProjectInput) => ProjectRecord;
  updateProject: (id: string, input: ProjectInput) => ProjectRecord | null;
  deleteProject: (id: string) => boolean;
  setProjectArchived: (id: string, archived: boolean) => ProjectRecord | null;
  changeStatus: (id: string, status: ProjectStatus) => ProjectRecord | null;
  executeAction: (
    id: string,
    action: ProjectActionType
  ) => ProjectRecord | null;
  getHistories: (projectId: string) => ProjectHistoryEvent[];
  addHistory: (
    event: Omit<ProjectHistoryEvent, "id" | "createdAt">
  ) => ProjectHistoryEvent;
};

export const useProjectStore = create<ProjectStore>((set, get) => ({
  projects: initialStoreData(initialProjects, []),
  histories: initialStoreData(initialProjectHistories, []),

  hydrate: ({ projects, histories }) => set({ projects, histories }),

  upsertProject: (project) =>
    set((state) => {
      const exists = state.projects.some((p) => p.id === project.id);
      if (exists) {
        return {
          projects: state.projects.map((p) => (p.id === project.id ? project : p)),
        };
      }
      return { projects: [project, ...state.projects] };
    }),

  removeProject: (id) =>
    set((state) => ({
      projects: state.projects.filter((p) => p.id !== id),
      histories: state.histories.filter((h) => h.projectId !== id),
    })),

  appendHistory: (history) =>
    set((state) => ({
      histories: [history, ...state.histories],
    })),

  getProjectById: (id) => findProjectById(get().projects, id),

  getListItems: () => get().projects.map(enrichProject),

  addProject: (input) => {
    const now = new Date().toISOString();
    const project: ProjectRecord = {
      id: generateId("p"),
      customerId: input.customerId,
      projectName: input.projectName,
      constructionSite: input.constructionSite ?? "",
      status: input.status,
      amount: input.amount ?? 0,
      discountLabel: input.discountLabel?.trim() ?? "",
      discountAmount: input.discountAmount ?? 0,
      customerContactName: input.customerContactName?.trim() ?? "",
      customerDepartment: input.customerDepartment?.trim() ?? "",
      customerPosition: input.customerPosition?.trim() ?? "",
      dueDate: input.dueDate,
      startDate: input.startDate ?? "",
      endDate: input.endDate ?? "",
      assigneeName: input.assigneeName ?? "",
      memo: input.memo,
      invoiceStatus: getDefaultInvoiceStatus(input.status),
      paymentStatus: getDefaultPaymentStatus(input.status, input.dueDate),
      archived: false,
      confirmedDate: "",
      completedDate: "",
      createdBy: null,
      updatedBy: null,
      createdAt: now,
      updatedAt: now,
    };
    set((state) => ({ projects: [project, ...state.projects] }));
    get().addHistory({
      projectId: project.id,
      type: "created",
      title: "案件作成",
    });
    return project;
  },

  updateProject: (id, input) => {
    let updated: ProjectRecord | null = null;
    set((state) => ({
      projects: state.projects.map((p) => {
        if (p.id !== id) return p;
        updated = syncDerivedFields(
          {
            ...p,
            customerId: input.customerId,
            projectName: input.projectName,
            constructionSite: input.constructionSite ?? "",
            status: input.status,
            amount: input.amount ?? 0,
            discountLabel: input.discountLabel?.trim() ?? "",
            discountAmount: input.discountAmount ?? 0,
            customerContactName: input.customerContactName?.trim() ?? "",
            customerDepartment: input.customerDepartment?.trim() ?? "",
            customerPosition: input.customerPosition?.trim() ?? "",
            dueDate: input.dueDate,
            startDate: input.startDate ?? "",
            endDate: input.endDate ?? "",
            assigneeName: input.assigneeName ?? "",
            memo: input.memo,
          },
          input.status
        );
        return updated;
      }),
    }));
    if (updated) {
      get().addHistory({
        projectId: id,
        type: "updated",
        title: "案件情報を更新",
      });
    }
    return updated;
  },

  deleteProject: (id) => {
    const exists = get().projects.some((p) => p.id === id);
    if (!exists) return false;
    set((state) => ({
      projects: state.projects.filter((p) => p.id !== id),
      histories: state.histories.filter((h) => h.projectId !== id),
    }));
    return true;
  },

  setProjectArchived: (id, archived) => {
    let updated: ProjectRecord | null = null;
    set((state) => ({
      projects: state.projects.map((p) => {
        if (p.id !== id) return p;
        updated = {
          ...p,
          archived,
          updatedAt: new Date().toISOString(),
        };
        return updated;
      }),
    }));
    if (updated) {
      get().addHistory({
        projectId: id,
        type: "updated",
        title: archived ? "案件をアーカイブしました" : "アーカイブを解除しました",
      });
    }
    return updated;
  },

  changeStatus: (id, status) => {
    let updated: ProjectRecord | null = null;
    set((state) => ({
      projects: state.projects.map((p) => {
        if (p.id !== id) return p;
        updated = syncDerivedFields(p, status);
        return updated;
      }),
    }));
    if (updated) {
      get().addHistory({
        projectId: id,
        type: "status_changed",
        title: "ステータス変更",
        description: PROJECT_STATUS_LABELS[status],
      });
    }
    return updated;
  },

  executeAction: (id, action) => {
    const nextStatus = getStatusAfterAction(action);
    if (!nextStatus) return null;

    let updated = get().changeStatus(id, nextStatus);

    if (updated && action === "mark_paid") {
      updated = {
        ...updated,
        paymentStatus: "paid",
        updatedAt: new Date().toISOString(),
      };
      set((state) => ({
        projects: state.projects.map((p) => (p.id === id ? updated! : p)),
      }));
      get().addHistory({
        projectId: id,
        type: "payment_received",
        title: "入金済",
      });
    }

    return updated;
  },

  getHistories: (projectId) =>
    get()
      .histories.filter((h) => h.projectId === projectId)
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ),

  addHistory: (event) => {
    const history: ProjectHistoryEvent = {
      id: generateId("h"),
      createdAt: new Date().toISOString(),
      ...event,
    };
    set((state) => ({
      histories: [history, ...state.histories],
    }));
    return history;
  },
}));
