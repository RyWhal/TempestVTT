import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Session, SessionPlayer, Character } from '../types';

interface CurrentUser {
  username: string;
  characterId: string | null;
  isGm: boolean;
}

interface SessionState {
  // Core session data
  session: Session | null;
  currentUser: CurrentUser | null;
  players: SessionPlayer[];

  // Connection status
  connectionStatus: 'connected' | 'connecting' | 'reconnecting' | 'disconnected';

  // Actions
  setSession: (session: Session | null) => void;
  updateSession: (updates: Partial<Session>) => void;
  setCurrentUser: (user: CurrentUser | null) => void;
  updateCurrentUser: (updates: Partial<CurrentUser>) => void;
  setPlayers: (players: SessionPlayer[]) => void;
  addPlayer: (player: SessionPlayer) => void;
  removePlayer: (playerId: string) => void;
  updatePlayer: (playerId: string, updates: Partial<SessionPlayer>) => void;
  setConnectionStatus: (status: SessionState['connectionStatus']) => void;
  clearSession: () => void;
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      // Initial state
      session: null,
      currentUser: null,
      players: [],
      connectionStatus: 'disconnected',

      // Actions
      setSession: (session) => set({ session }),

      updateSession: (updates) =>
        set((state) => ({
          session: state.session ? { ...state.session, ...updates } : null,
        })),

      setCurrentUser: (user) => set({ currentUser: user }),

      updateCurrentUser: (updates) =>
        set((state) => ({
          currentUser: state.currentUser
            ? { ...state.currentUser, ...updates }
            : null,
        })),

      setPlayers: (players) => set({ players }),

      addPlayer: (player) =>
        set((state) => ({
          players: [...state.players.filter((p) => p.id !== player.id), player],
        })),

      removePlayer: (playerId) =>
        set((state) => ({
          players: state.players.filter((p) => p.id !== playerId),
        })),

      updatePlayer: (playerId, updates) =>
        set((state) => ({
          players: state.players.map((p) =>
            p.id === playerId ? { ...p, ...updates } : p
          ),
        })),

      setConnectionStatus: (status) => set({ connectionStatus: status }),

      clearSession: () =>
        set({
          session: null,
          currentUser: null,
          players: [],
          connectionStatus: 'disconnected',
        }),
    }),
    {
      name: 'tempest-table-session',
      partialize: (state) => ({
        // Only persist essential data for session reconnection
        session: state.session
          ? { id: state.session.id, code: state.session.code, name: state.session.name }
          : null,
        currentUser: state.currentUser
          ? {
              username: state.currentUser.username,
              characterId: state.currentUser.characterId,
              isGm: state.currentUser.isGm,
            }
          : null,
      }),
    }
  )
);

// Selector hooks for commonly used derived state
export const useIsGM = () => useSessionStore((state) => state.currentUser?.isGm ?? false);
export const useUsername = () => useSessionStore((state) => state.currentUser?.username ?? '');
export const useSessionCode = () => useSessionStore((state) => state.session?.code ?? '');
export const useConnectionStatus = () => useSessionStore((state) => state.connectionStatus);

// Helper to check if a character is claimed by the current user
export const useIsMyCharacter = (character: Character | null) => {
  const username = useUsername();
  return character?.claimedByUsername === username;
};
