import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface DiceSettingsState {
  showDiceAnimations: boolean;
  setShowDiceAnimations: (enabled: boolean) => void;
}

/** Personal device preference, independent of the shared session and other players. */
export const useDiceSettingsStore = create<DiceSettingsState>()(
  persist(
    (set) => ({
      showDiceAnimations: true,
      setShowDiceAnimations: (enabled) => set({ showDiceAnimations: enabled }),
    }),
    { name: 'tempest-dice-settings' },
  ),
);
