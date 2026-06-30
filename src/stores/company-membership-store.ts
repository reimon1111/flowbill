"use client";

import { create } from "zustand";
import type {
  CompanyInvitationRecord,
  CompanyMemberRecord,
  CompanyMemberRole,
  UserCompanySummary,
} from "@/lib/types/company-membership";

type CompanyMembershipStore = {
  companies: UserCompanySummary[];
  members: CompanyMemberRecord[];
  pendingInvitations: CompanyInvitationRecord[];
  currentRole: CompanyMemberRole | null;
  hydrated: boolean;
  hydrate: (data: {
    companies: UserCompanySummary[];
    members: CompanyMemberRecord[];
    pendingInvitations: CompanyInvitationRecord[];
    currentRole: CompanyMemberRole | null;
  }) => void;
  reset: () => void;
};

export const useCompanyMembershipStore = create<CompanyMembershipStore>((set) => ({
  companies: [],
  members: [],
  pendingInvitations: [],
  currentRole: null,
  hydrated: false,
  hydrate: (data) => set({ ...data, hydrated: true }),
  reset: () =>
    set({
      companies: [],
      members: [],
      pendingInvitations: [],
      currentRole: null,
      hydrated: false,
    }),
}));
