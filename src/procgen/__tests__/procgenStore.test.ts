import { beforeEach, describe, expect, it } from 'vitest';
import { createProcgenCampaignWorld } from '../state/defaultCampaignState';
import { useProcgenStore } from '../../stores/procgenStore';

describe('procgenStore', () => {
  beforeEach(() => {
    useProcgenStore.getState().clearProcgenState();
  });

  it('hydrates campaign data into dedicated procgen state buckets', () => {
    const campaign = createProcgenCampaignWorld({
      id: 'campaign_001',
      sessionId: 'session_001',
      worldSeed: 'world_ironbell_042',
      name: 'The Bloom Beneath',
    });

    useProcgenStore.getState().hydrateProcgenState({
      campaign: {
        ...campaign,
        activeSectionId: 'section_start_001',
      },
      sections: [
        {
          id: 'section_record_001',
          campaignId: campaign.id,
          sectionId: 'section_start_001',
          name: 'The Blooming Chapel',
          state: 'preview',
          primaryBiomeId: 'fungal_warrens',
          secondaryBiomeIds: [],
          layoutType: 'central_hub',
          grid: { width: 100, height: 100, tileSizeFt: 5 },
          roomIds: ['room_001'],
          entranceConnectionIds: ['entrance_west_01'],
          exitConnectionIds: ['exit_east_01'],
          generationState: {},
          presentationState: {},
          overrideState: {},
          renderPayloadCache: null,
          lockedAt: null,
          createdAt: '2026-03-22T00:00:00.000Z',
          updatedAt: '2026-03-22T00:00:00.000Z',
        },
      ],
      roomStates: [],
      overrides: [],
      sectionPreviews: [],
      sharedAssets: [],
    });

    const state = useProcgenStore.getState();
    expect(state.campaign?.id).toBe('campaign_001');
    expect(state.activeSectionId).toBe('section_start_001');
    expect(state.sectionsById.section_record_001?.sectionId).toBe('section_start_001');
    expect(state.error).toBeNull();
  });

  it('clears all procgen state when requested', () => {
    const campaign = createProcgenCampaignWorld({
      id: 'campaign_001',
      sessionId: 'session_001',
      worldSeed: 'world_ironbell_042',
      name: 'The Bloom Beneath',
    });

    useProcgenStore.getState().setCampaign(campaign);
    useProcgenStore.getState().setLoading(true);
    useProcgenStore.getState().setError('bad state');

    useProcgenStore.getState().clearProcgenState();

    const state = useProcgenStore.getState();
    expect(state.campaign).toBeNull();
    expect(state.sectionsById).toEqual({});
    expect(state.activeSectionId).toBeNull();
    expect(state.isLoading).toBe(false);
    expect(state.error).toBeNull();
  });
});
