import type {
  CampaignWorld,
  DungeonSectionRecord,
  GMOverrideRecord,
  ProcgenSectionPreviewRecord,
  RoomStateRecord,
  SharedAssetRecord,
} from '../../types';

export interface ProcgenStoreState {
  campaign: CampaignWorld | null;
  sectionsById: Record<string, DungeonSectionRecord>;
  roomStatesById: Record<string, RoomStateRecord>;
  overridesById: Record<string, GMOverrideRecord>;
  sectionPreviewsById: Record<string, ProcgenSectionPreviewRecord>;
  sharedAssetsByKey: Record<string, SharedAssetRecord>;
  activeSectionId: string | null;
  isLoading: boolean;
  error: string | null;
}
