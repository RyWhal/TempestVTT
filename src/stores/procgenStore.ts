import { create } from 'zustand';
import type {
  CampaignWorld,
  DungeonSectionRecord,
  GMOverrideRecord,
  ProcgenSectionPreviewRecord,
  RoomStateRecord,
  SharedAssetRecord,
} from '../types';
import { createEmptyProcgenStoreState } from '../procgen/state/defaultCampaignState';
import type { ProcgenStoreState } from '../procgen/state/procgenStoreTypes';

interface ProcgenHydrationPayload {
  campaign: CampaignWorld | null;
  sections: DungeonSectionRecord[];
  roomStates: RoomStateRecord[];
  overrides: GMOverrideRecord[];
  sectionPreviews: ProcgenSectionPreviewRecord[];
  sharedAssets: SharedAssetRecord[];
}

interface ProcgenStoreActions {
  setCampaign: (campaign: CampaignWorld | null) => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
  setActiveSectionId: (sectionId: string | null) => void;
  hydrateProcgenState: (payload: ProcgenHydrationPayload) => void;
  clearProcgenState: () => void;
}

const indexById = <T extends { id: string }>(items: T[]) =>
  Object.fromEntries(items.map((item) => [item.id, item])) as Record<string, T>;

export const useProcgenStore = create<ProcgenStoreState & ProcgenStoreActions>()((set) => ({
  ...createEmptyProcgenStoreState(),

  setCampaign: (campaign) =>
    set((state) => ({
      campaign,
      activeSectionId: campaign?.activeSectionId ?? state.activeSectionId,
    })),

  setLoading: (isLoading) => set({ isLoading }),

  setError: (error) => set({ error }),

  setActiveSectionId: (sectionId) =>
    set((state) => ({
      activeSectionId: sectionId,
      campaign: state.campaign ? { ...state.campaign, activeSectionId: sectionId } : state.campaign,
    })),

  hydrateProcgenState: ({
    campaign,
    sections,
    roomStates,
    overrides,
    sectionPreviews,
    sharedAssets,
  }) =>
    set({
      campaign,
      sectionsById: indexById(sections),
      roomStatesById: indexById(roomStates),
      overridesById: indexById(overrides),
      sectionPreviewsById: indexById(sectionPreviews),
      sharedAssetsByKey: Object.fromEntries(sharedAssets.map((asset) => [asset.assetKey, asset])),
      activeSectionId: campaign?.activeSectionId ?? null,
      isLoading: false,
      error: null,
    }),

  clearProcgenState: () => set(createEmptyProcgenStoreState()),
}));
