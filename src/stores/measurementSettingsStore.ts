import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useMeasurementSettingsStore = create<{
  showOthers: boolean;
  privateMeasurement: boolean;
  setShowOthers: (value: boolean) => void;
  setPrivateMeasurement: (value: boolean) => void;
}>()(persist((set) => ({
  showOthers: true,
  privateMeasurement: false,
  setShowOthers: (showOthers) => set({ showOthers }),
  setPrivateMeasurement: (privateMeasurement) => set({ privateMeasurement }),
}), { name: 'tempest-measurement-settings' }));
