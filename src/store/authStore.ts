import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { User } from "../types";
import { clientCache } from "../services/cache";

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isGuest: boolean;
  setAuth: (user: User, access: string, refresh: string) => void;
  setUser: (user: User) => void;
  continueAsGuest: () => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isGuest: false,

      setAuth: (user, access, refresh) => {
        localStorage.setItem("uda_access", access);
        localStorage.setItem("uda_refresh", refresh);
        localStorage.removeItem("uda_guest");
        set({ user, accessToken: access, refreshToken: refresh, isAuthenticated: true, isGuest: false });
      },

      setUser: (user) => set({ user }),

      // Browse-only mode: no token, no account. Public endpoints (search,
      // trending, albums, artist) work; library/history actions are gated.
      continueAsGuest: () => {
        localStorage.setItem("uda_guest", "1");
        set({ isGuest: true, isAuthenticated: false, user: null, accessToken: null, refreshToken: null });
      },

      logout: () => {
        localStorage.removeItem("uda_access");
        localStorage.removeItem("uda_refresh");
        localStorage.removeItem("uda_guest");
        clientCache.clear(); // clear all per-user cached data on logout
        set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false, isGuest: false });
      },
    }),
    { name: "uda-auth", partialize: (s) => ({ user: s.user, accessToken: s.accessToken, refreshToken: s.refreshToken, isAuthenticated: s.isAuthenticated, isGuest: s.isGuest }) }
  )
);
