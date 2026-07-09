// src/lib/store.ts — État global (Zustand)
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from './api';

interface AuthState {
  user:    User | null;
  token:   string | null;
  isAuth:  boolean;
  // Vrai une fois que zustand/persist a fini de relire 'gl-auth' depuis localStorage.
  // La réhydratation est asynchrone : tant que ce flag est faux, isAuth peut encore
  // valoir sa valeur par défaut (false) même si une session valide existe en storage.
  hasHydrated: boolean;
  setAuth: (user: User, token: string) => void;
  logout:  () => void;
  setHasHydrated: (v: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user:   null,
      token:  null,
      isAuth: false,
      hasHydrated: false,
      setAuth: (user, token) => {
        localStorage.setItem('gl_token', token);
        localStorage.setItem('gl_user', JSON.stringify(user));
        set({ user, token, isAuth: true });
      },
      logout: () => {
        localStorage.removeItem('gl_token');
        localStorage.removeItem('gl_user');
        set({ user: null, token: null, isAuth: false });
      },
      setHasHydrated: (v) => set({ hasHydrated: v }),
    }),
    {
      name: 'gl-auth',
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    },
  ),
);

// ── Store UI (sidebar, modales) ───────────────────────────────
interface UiState {
  sidebarOpen: boolean;
  toggleSidebar: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  sidebarOpen: true,
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
}));
