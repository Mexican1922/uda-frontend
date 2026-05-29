import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { User } from "../types";
import { clientCache } from "../services/cache";

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  setAuth: (user: User, access: string, refresh: string) => void;
  setUser: (user: User) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,

      setAuth: (user, access, refresh) => {
        localStorage.setItem("uda_access", access);
        localStorage.setItem("uda_refresh", refresh);
        set({ user, accessToken: access, refreshToken: refresh, isAuthenticated: true });
      },

      setUser: (user) => set({ user }),

      logout: () => {
        localStorage.removeItem("uda_access");
        localStorage.removeItem("uda_refresh");
        clientCache.clear(); // clear all per-user cached data on logout
        set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false });
      },
    }),
    { name: "uda-auth", partialize: (s) => ({ user: s.user, accessToken: s.accessToken, refreshToken: s.refreshToken, isAuthenticated: s.isAuthenticated }) }
  )
);
