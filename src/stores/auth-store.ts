"use client";

import { create } from "zustand";
import type { User } from "@supabase/supabase-js";

type AuthStore = {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  /** 初回セッション確認が完了したか */
  sessionChecked: boolean;
  /** プロフィール初期化済みのユーザーID */
  bootstrappedUserId: string | null;
  profileError: string | null;
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  setSessionChecked: (checked: boolean) => void;
  setBootstrappedUserId: (userId: string | null) => void;
  setProfileError: (error: string | null) => void;
  reset: () => void;
};

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  isLoading: true,
  isAuthenticated: false,
  sessionChecked: false,
  bootstrappedUserId: null,
  profileError: null,
  setUser: (user) =>
    set({
      user,
      isAuthenticated: !!user,
      isLoading: false,
      ...(user ? { profileError: null } : {}),
    }),
  setLoading: (isLoading) => set({ isLoading }),
  setSessionChecked: (sessionChecked) => set({ sessionChecked }),
  setBootstrappedUserId: (bootstrappedUserId) => set({ bootstrappedUserId }),
  setProfileError: (profileError) => set({ profileError }),
  reset: () =>
    set({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      sessionChecked: true,
      bootstrappedUserId: null,
      profileError: null,
    }),
}));
