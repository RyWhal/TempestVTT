import type { CampaignWorld, DungeonGraph } from '../../types';
import type { ProcgenStoreState } from './procgenStoreTypes';

interface CreateProcgenCampaignWorldInput {
  id: string;
  sessionId: string;
  worldSeed: string;
  name: string;
  campaignGoalId?: string | null;
  difficultyModel?: string;
  toneProfile?: Record<string, unknown>;
  startingSectionId?: string | null;
}

export const createEmptyDungeonGraph = (): DungeonGraph => ({
  nodes: [],
  edges: [],
});

export const createProcgenCampaignWorld = ({
  id,
  sessionId,
  worldSeed,
  name,
  campaignGoalId = null,
  difficultyModel = 'distance_scaled_balanced',
  toneProfile = {},
  startingSectionId = null,
}: CreateProcgenCampaignWorldInput): CampaignWorld => {
  const timestamp = new Date().toISOString();

  return {
    id,
    sessionId,
    name,
    worldSeed,
    campaignGoalId,
    difficultyModel,
    toneProfile,
    startingSectionId,
    activeSectionId: null,
    dungeonGraph: createEmptyDungeonGraph(),
    generationState: {},
    presentationState: {},
    createdAt: timestamp,
    updatedAt: timestamp,
  };
};

export const createEmptyProcgenStoreState = (): ProcgenStoreState => ({
  campaign: null,
  sectionsById: {},
  roomStatesById: {},
  overridesById: {},
  sectionPreviewsById: {},
  sharedAssetsByKey: {},
  activeSectionId: null,
  isLoading: false,
  error: null,
});
