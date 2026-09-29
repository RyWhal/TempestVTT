import { create } from 'zustand';
import type { PlayerAccentReservation } from '../lib/playerAccents';
export const usePlayerAccentsStore = create<{
  sessionId: string | null;
  reservations: PlayerAccentReservation[];
  error: string | null;
  setReservations: (sessionId: string, reservations: PlayerAccentReservation[]) => void;
  reset: () => void;
}>((set) => ({
  sessionId: null, reservations: [], error: null,
  setReservations: (sessionId, reservations) => set({ sessionId, reservations, error: null }),
  reset: () => set({ sessionId: null, reservations: [], error: null }),
}));
