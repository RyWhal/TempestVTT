import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AdminState {
  sessionToken: string | null;
  lastActivity: string | null;

  // Actions
  setSessionToken: (token: string | null) => void;
  updateActivity: () => void;
  logout: () => void;
}

export const useAdminStore = create<AdminState>()(
  persist(
    (set) => ({
      sessionToken: null,
      lastActivity: null,

      setSessionToken: (token) =>
        set({
          sessionToken: token,
          lastActivity: token ? new Date().toISOString() : null,
        }),

      updateActivity: () =>
        set({ lastActivity: new Date().toISOString() }),

      logout: () =>
        set({
          sessionToken: null,
          lastActivity: null,
        }),
    }),
    {
      name: 'tempest-table-admin',
      partialize: (state) => ({
        sessionToken: state.sessionToken,
        lastActivity: state.lastActivity,
      }),
    }
  )
);

