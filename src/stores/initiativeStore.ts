import { create } from 'zustand';
import type { InitiativeEntry, InitiativeRollLog } from '../types';

interface InitiativeState {
  entries: InitiativeEntry[];
  rollLogs: InitiativeRollLog[];
  setEntries: (entries: InitiativeEntry[]) => void;
  upsertEntry: (entry: InitiativeEntry) => void;
  removeEntry: (id: string) => void;
  setRollLogs: (logs: InitiativeRollLog[]) => void;
  addRollLog: (log: InitiativeRollLog) => void;
  clearInitiativeState: () => void;
}

const sortEntries = (entries: InitiativeEntry[]) =>
  [...entries].sort((a, b) => {
    if (a.phase !== b.phase) return a.phase === 'fast' ? -1 : 1;
    const aTotal = a.total ?? -999;
    const bTotal = b.total ?? -999;
    if (aTotal !== bTotal) return bTotal - aTotal;
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });

const sortLogs = (logs: InitiativeRollLog[]) =>
  [...logs].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

export const useInitiativeStore = create<InitiativeState>()((set) => ({
  entries: [],
  rollLogs: [],
  setEntries: (entries) => set({ entries: sortEntries(entries) }),
  upsertEntry: (entry) =>
    set((state) => ({
      entries: sortEntries([
        ...state.entries.filter((existing) => existing.id !== entry.id),
        entry,
      ]),
    })),
  removeEntry: (id) =>
    set((state) => ({ entries: state.entries.filter((entry) => entry.id !== id) })),
  setRollLogs: (rollLogs) => set({ rollLogs: sortLogs(rollLogs).slice(0, 200) }),
  addRollLog: (log) =>
    set((state) => ({ rollLogs: sortLogs([log, ...state.rollLogs]).slice(0, 200) })),
  clearInitiativeState: () => set({ entries: [], rollLogs: [] }),
}));
