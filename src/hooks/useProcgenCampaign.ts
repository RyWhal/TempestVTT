import { useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useProcgenStore } from '../stores/procgenStore';
import {
  dbProcgenCampaignToCampaignWorld,
  dbProcgenOverrideToGMOverrideRecord,
  dbProcgenRoomStateToRoomStateRecord,
  dbProcgenSectionPreviewToProcgenSectionPreviewRecord,
  dbProcgenSectionToDungeonSectionRecord,
  dbSharedAssetToSharedAssetRecord,
  type CampaignWorld,
  type DbProcgenCampaign,
  type DbProcgenOverride,
  type DbProcgenRoomState,
  type DbProcgenSection,
  type DbProcgenSectionPreview,
  type DbSharedAsset,
} from '../types';

const loadCampaignScopedRows = async <T>(table: string, campaignId: string): Promise<T[]> => {
  const { data, error } = await supabase
    .from(table)
    .select('*')
    .eq('campaign_id', campaignId)
    .order('created_at', { ascending: true });

  if (error) {
    throw error;
  }

  return (data as T[] | null) ?? [];
};

const loadSharedAssets = async (): Promise<DbSharedAsset[]> => {
  const { data, error } = await supabase
    .from('shared_assets')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) {
    throw error;
  }

  return (data as DbSharedAsset[] | null) ?? [];
};

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Failed to load DunGEN campaign state';

export const hydrateProcgenCampaignBySession = async (
  sessionId: string
): Promise<CampaignWorld | null> => {
  const store = useProcgenStore.getState();
  store.setLoading(true);
  store.setError(null);

  try {
    const { data, error } = await supabase
      .from('procgen_campaigns')
      .select('*')
      .eq('session_id', sessionId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      useProcgenStore.getState().clearProcgenState();
      return null;
    }

    const campaign = dbProcgenCampaignToCampaignWorld(data as DbProcgenCampaign);

    const [sections, roomStates, overrides, sectionPreviews, sharedAssets] = await Promise.all([
      loadCampaignScopedRows<DbProcgenSection>('procgen_sections', campaign.id),
      loadCampaignScopedRows<DbProcgenRoomState>('procgen_room_states', campaign.id),
      loadCampaignScopedRows<DbProcgenOverride>('procgen_overrides', campaign.id),
      loadCampaignScopedRows<DbProcgenSectionPreview>('procgen_section_previews', campaign.id),
      loadSharedAssets(),
    ]);

    useProcgenStore.getState().hydrateProcgenState({
      campaign,
      sections: sections.map(dbProcgenSectionToDungeonSectionRecord),
      roomStates: roomStates.map(dbProcgenRoomStateToRoomStateRecord),
      overrides: overrides.map(dbProcgenOverrideToGMOverrideRecord),
      sectionPreviews: sectionPreviews.map(dbProcgenSectionPreviewToProcgenSectionPreviewRecord),
      sharedAssets: sharedAssets.map(dbSharedAssetToSharedAssetRecord),
    });

    return campaign;
  } catch (error) {
    const errorMessage = getErrorMessage(error);
    useProcgenStore.getState().clearProcgenState();
    useProcgenStore.getState().setError(errorMessage);
    return null;
  }
};

export const useProcgenCampaign = () => {
  const campaign = useProcgenStore((state) => state.campaign);
  const activeSectionId = useProcgenStore((state) => state.activeSectionId);
  const isLoading = useProcgenStore((state) => state.isLoading);
  const error = useProcgenStore((state) => state.error);
  const sectionsById = useProcgenStore((state) => state.sectionsById);

  const loadCampaignBySession = useCallback(
    async (sessionId: string) => hydrateProcgenCampaignBySession(sessionId),
    []
  );

  const clearProcgenState = useCallback(() => {
    useProcgenStore.getState().clearProcgenState();
  }, []);

  return {
    campaign,
    activeSectionId,
    isLoading,
    error,
    sectionsById,
    loadCampaignBySession,
    clearProcgenState,
  };
};
