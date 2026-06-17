// src/lib/store.ts — État global (Zustand)
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from './api';

interface AuthState {
  user:    User | null;
  token:   string | null;
  isAuth:  boolean;
  setAuth: (user: User, token: string) => void;
  logout:  () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user:   null,
      token:  null,
      isAuth: false,
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
    }),
    { name: 'gl-auth' },
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
