import { describe, expect, it } from 'vitest';
import {
  createEmptyProcgenStoreState,
  createProcgenCampaignWorld,
} from '../state/defaultCampaignState';

describe('defaultCampaignState', () => {
  it('creates an empty procgen store state with separate records for canonical entities', () => {
    const state = createEmptyProcgenStoreState();

    expect(state.campaign).toBeNull();
    expect(state.sectionsById).toEqual({});
    expect(state.roomStatesById).toEqual({});
    expect(state.overridesById).toEqual({});
    expect(state.sectionPreviewsById).toEqual({});
    expect(state.sharedAssetsByKey).toEqual({});
    expect(state.activeSectionId).toBeNull();
    expect(state.isLoading).toBe(false);
    expect(state.error).toBeNull();
  });

  it('creates a campaign world draft with empty graph and separate generation/presentation state', () => {
    const campaign = createProcgenCampaignWorld({
      id: 'camp_test_001',
      sessionId: 'session_001',
      worldSeed: 'world_ironbell_042',
      name: 'The Bloom Beneath',
    });

    expect(campaign.id).toBe('camp_test_001');
    expect(campaign.sessionId).toBe('session_001');
    expect(campaign.worldSeed).toBe('world_ironbell_042');
    expect(campaign.dungeonGraph).toEqual({
      nodes: [],
      edges: [],
    });
    expect(campaign.activeSectionId).toBeNull();
    expect(campaign.generationState).toEqual({});
    expect(campaign.presentationState).toEqual({});
  });
});
