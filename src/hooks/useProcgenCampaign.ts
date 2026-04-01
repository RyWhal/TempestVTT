import { useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { CampaignSnapshot } from '../procgen/engine/campaignFlow';
import { createMapBakeOrchestrator } from '../procgen/bake/MapBakeOrchestrator';
import { getMapBakeContentSignature, loadMapBakeContent } from '../procgen/bake/AssetRegistryLoader';
import { buildSemanticMapFromGeneratedSection } from '../procgen/bake/GeneratedSectionSemanticAdapter';
import { createInlineArtifactWriter } from '../procgen/bake/inlineArtifactWriter';
import { loadLocalCampaignSnapshot } from '../procgen/integration/localCampaignPersistence';
import { buildSectionRenderPayload } from '../procgen/map/buildSectionRenderPayload';
import type { MapBakeJobState } from '../procgen/bake/SemanticMapTypes';
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
  type DungeonSectionRecord,
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

let sharedAssetsCache: DbSharedAsset[] | null = null;
let sharedAssetsInFlight: Promise<DbSharedAsset[]> | null = null;

export const resetSharedAssetsCacheForTests = () => {
  sharedAssetsCache = null;
  sharedAssetsInFlight = null;
};

const loadSharedAssets = async (): Promise<DbSharedAsset[]> => {
  if (sharedAssetsCache) {
    return sharedAssetsCache;
  }

  if (sharedAssetsInFlight) {
    return sharedAssetsInFlight;
  }

  sharedAssetsInFlight = (async () => {
    const { data, error } = await supabase
      .from('shared_assets')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) {
      throw error;
    }

    const rows = (data as DbSharedAsset[] | null) ?? [];
    sharedAssetsCache = rows;
    return rows;
  })();

  try {
    return await sharedAssetsInFlight;
  } finally {
    sharedAssetsInFlight = null;
  }
};

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Failed to load DunGEN campaign state';

const hydrateSnapshotIntoProcgenStore = (snapshot: CampaignSnapshot) => {
  useProcgenStore.getState().hydrateProcgenState({
    campaign: snapshot.campaign,
    sections: snapshot.sections,
    roomStates: [],
    overrides: [],
    sectionPreviews: snapshot.previews,
    sharedAssets: [],
  });
};

const hydrateProvidedSnapshot = (snapshot: CampaignSnapshot | null): CampaignWorld | null => {
  if (!snapshot) {
    return null;
  }

  hydrateSnapshotIntoProcgenStore(snapshot);
  return snapshot.campaign;
};

const getSnapshotLatestTimestamp = (snapshot: CampaignSnapshot): number => {
  const timestampCandidates = [
    snapshot.campaign.updatedAt,
    snapshot.campaign.createdAt,
    ...snapshot.sections.flatMap((section) => [section.updatedAt, section.createdAt]),
    ...snapshot.previews.flatMap((preview) => [preview.updatedAt, preview.createdAt]),
  ];

  return timestampCandidates.reduce((latest, candidate) => {
    const parsed = candidate ? Date.parse(candidate) : Number.NaN;
    if (Number.isNaN(parsed)) {
      return latest;
    }

    return Math.max(latest, parsed);
  }, 0);
};

const shouldPreferLocalSnapshot = ({
  localSnapshot,
  remoteSnapshot,
}: {
  localSnapshot: CampaignSnapshot | null;
  remoteSnapshot: CampaignSnapshot;
}) => {
  if (!localSnapshot) {
    return false;
  }

  if (localSnapshot.sections.length > remoteSnapshot.sections.length) {
    return true;
  }

  if (
    localSnapshot.sections.length === remoteSnapshot.sections.length &&
    localSnapshot.previews.length > remoteSnapshot.previews.length
  ) {
    return true;
  }

  const localLatestTimestamp = getSnapshotLatestTimestamp(localSnapshot);
  const remoteLatestTimestamp = getSnapshotLatestTimestamp(remoteSnapshot);

  return (
    localLatestTimestamp > remoteLatestTimestamp &&
    localSnapshot.sections.length >= remoteSnapshot.sections.length &&
    localSnapshot.previews.length >= remoteSnapshot.previews.length
  );
};

type PersistCampaignSnapshotResult =
  | { success: true; campaignId: string }
  | { success: false; error: string };

type BakeSectionFloorCacheResult =
  | {
      success: true;
      renderPayloadCache: Record<string, unknown>;
      persistenceError?: string;
    }
  | { success: false; error: string };

const LOCAL_BAKE_MAX_CHUNKS_PER_INVOCATION = 32;
const LOCAL_BAKE_MAX_INVOCATIONS = 8;

const isLocalBrowserRuntime = () =>
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

const isPersistableChunkUrl = (value: unknown): value is string =>
  typeof value === 'string' &&
  value.length > 0 &&
  !value.startsWith('blob:') &&
  !value.startsWith('data:');

const hasEphemeralChunkUrls = (renderPayloadCache: Record<string, unknown>) => {
  const bakedFloor = renderPayloadCache.bakedFloor;

  if (!bakedFloor || typeof bakedFloor !== 'object') {
    return false;
  }

  const chunks = (bakedFloor as { chunks?: Array<Record<string, unknown>> }).chunks;
  if (!Array.isArray(chunks)) {
    return false;
  }

  return chunks.some((chunk) => {
    const imageUrl = chunk.imageUrl;
    return (
      typeof imageUrl === 'string' &&
      (imageUrl.startsWith('blob:') || imageUrl.startsWith('data:'))
    );
  });
};

const toPersistedRenderPayloadCache = (renderPayloadCache: Record<string, unknown> | null) => {
  if (!renderPayloadCache) {
    return null;
  }

  const compactCache: Record<string, unknown> = {};
  const bakedFloor =
    renderPayloadCache.bakedFloor && typeof renderPayloadCache.bakedFloor === 'object'
      ? (renderPayloadCache.bakedFloor as Record<string, unknown>)
      : null;

  if (bakedFloor) {
    const chunks = Array.isArray(bakedFloor.chunks)
      ? bakedFloor.chunks
          .filter((chunk): chunk is Record<string, unknown> => Boolean(chunk) && typeof chunk === 'object')
          .map((chunk) => {
            const compactChunk: Record<string, unknown> = {
              chunkX: typeof chunk.chunkX === 'number' ? chunk.chunkX : 0,
              chunkY: typeof chunk.chunkY === 'number' ? chunk.chunkY : 0,
              x: typeof chunk.x === 'number' ? chunk.x : 0,
              y: typeof chunk.y === 'number' ? chunk.y : 0,
              widthPx: typeof chunk.widthPx === 'number' ? chunk.widthPx : 0,
              heightPx: typeof chunk.heightPx === 'number' ? chunk.heightPx : 0,
            };

            if (typeof chunk.imagePath === 'string' && chunk.imagePath.length > 0) {
              compactChunk.imagePath = chunk.imagePath;
            }

            if (isPersistableChunkUrl(chunk.imageUrl)) {
              compactChunk.imageUrl = chunk.imageUrl;
            }

            return compactChunk;
          })
      : [];

    compactCache.bakedFloor = {
      status: typeof bakedFloor.status === 'string' ? bakedFloor.status : 'pending',
      chunkSizePx: typeof bakedFloor.chunkSizePx === 'number' ? bakedFloor.chunkSizePx : 0,
      tileResolutionPx:
        typeof bakedFloor.tileResolutionPx === 'number' ? bakedFloor.tileResolutionPx : 0,
      floorCellsPerChunk:
        typeof bakedFloor.floorCellsPerChunk === 'number' ? bakedFloor.floorCellsPerChunk : 0,
      chunks,
    };
  }

  const bakeJobState =
    renderPayloadCache.bakeJobState && typeof renderPayloadCache.bakeJobState === 'object'
      ? (renderPayloadCache.bakeJobState as Record<string, unknown>)
      : null;

  if (bakeJobState) {
    compactCache.bakeJobState = {
      status: typeof bakeJobState.status === 'string' ? bakeJobState.status : undefined,
      contentSignature:
        typeof bakeJobState.contentSignature === 'string' ? bakeJobState.contentSignature : undefined,
    };
  }

  return compactCache;
};

const toPersistedSectionGenerationState = (generationState: Record<string, unknown>) => {
  if (!isLocalBrowserRuntime()) {
    return generationState;
  }

  return {
    generatedSection:
      generationState.generatedSection && typeof generationState.generatedSection === 'object'
        ? generationState.generatedSection
        : undefined,
    generatedContent:
      generationState.generatedContent && typeof generationState.generatedContent === 'object'
        ? generationState.generatedContent
        : undefined,
    contentRerollState:
      generationState.contentRerollState && typeof generationState.contentRerollState === 'object'
        ? generationState.contentRerollState
        : undefined,
    sectionProfile:
      generationState.sectionProfile && typeof generationState.sectionProfile === 'object'
        ? generationState.sectionProfile
        : undefined,
    settlementArchetypeId:
      typeof generationState.settlementArchetypeId === 'string' || generationState.settlementArchetypeId === null
        ? generationState.settlementArchetypeId
        : undefined,
    coordinates:
      generationState.coordinates && typeof generationState.coordinates === 'object'
        ? generationState.coordinates
        : undefined,
    visitIndex: typeof generationState.visitIndex === 'number' ? generationState.visitIndex : undefined,
    enteredFromDirection:
      typeof generationState.enteredFromDirection === 'string' || generationState.enteredFromDirection === null
        ? generationState.enteredFromDirection
        : undefined,
    sectionKind: typeof generationState.sectionKind === 'string' ? generationState.sectionKind : undefined,
  };
};

const toPersistedPreviewState = (previewState: Record<string, unknown>) => {
  if (!isLocalBrowserRuntime()) {
    return previewState;
  }

  return {
    generatedSection:
      previewState.generatedSection && typeof previewState.generatedSection === 'object'
        ? previewState.generatedSection
        : undefined,
    generatedContent:
      previewState.generatedContent && typeof previewState.generatedContent === 'object'
        ? previewState.generatedContent
        : undefined,
    contentRerollState:
      previewState.contentRerollState && typeof previewState.contentRerollState === 'object'
        ? previewState.contentRerollState
        : undefined,
    sectionProfile:
      previewState.sectionProfile && typeof previewState.sectionProfile === 'object'
        ? previewState.sectionProfile
        : undefined,
    settlementArchetypeId:
      typeof previewState.settlementArchetypeId === 'string' || previewState.settlementArchetypeId === null
        ? previewState.settlementArchetypeId
        : undefined,
    coordinates:
      previewState.coordinates && typeof previewState.coordinates === 'object'
        ? previewState.coordinates
        : undefined,
    label: typeof previewState.label === 'string' ? previewState.label : undefined,
    parentSectionId:
      typeof previewState.parentSectionId === 'string' ? previewState.parentSectionId : undefined,
    playerVisibility:
      typeof previewState.playerVisibility === 'string' ? previewState.playerVisibility : undefined,
    returnDirection:
      typeof previewState.returnDirection === 'string' ? previewState.returnDirection : undefined,
    adjacentFromSectionIds: Array.isArray(previewState.adjacentFromSectionIds)
      ? previewState.adjacentFromSectionIds
      : undefined,
    branchDirectionsBySectionId:
      previewState.branchDirectionsBySectionId && typeof previewState.branchDirectionsBySectionId === 'object'
        ? previewState.branchDirectionsBySectionId
        : undefined,
    returnDirectionsBySectionId:
      previewState.returnDirectionsBySectionId && typeof previewState.returnDirectionsBySectionId === 'object'
        ? previewState.returnDirectionsBySectionId
        : undefined,
  };
};

const hasRenderableBakedChunks = (bakedFloor: unknown): boolean => {
  if (!bakedFloor || typeof bakedFloor !== 'object') {
    return false;
  }

  const chunks = (bakedFloor as { chunks?: Array<Record<string, unknown>> }).chunks;
  if (!Array.isArray(chunks) || chunks.length === 0) {
    return false;
  }

  return chunks.some(
    (chunk) =>
      (typeof chunk.imageUrl === 'string' && chunk.imageUrl.length > 0) ||
      (Array.isArray(chunk.tileSprites) && chunk.tileSprites.length > 0)
  );
};

const toDbDungeonGraph = (graph: CampaignWorld['dungeonGraph']) => ({
  nodes: graph.nodes,
  edges: graph.edges.map((edge) => ({
    from_section_id: edge.fromSectionId,
    from_connection_id: edge.fromConnectionId,
    to_section_id: edge.toSectionId,
    to_connection_id: edge.toConnectionId,
  })),
});

const translatePreviewStateSectionReferences = (
  previewState: Record<string, unknown>,
  translateSectionRecordId: (recordId: string | null) => string | null
) => {
  const adjacentFromSectionIds = Array.isArray(previewState.adjacentFromSectionIds)
    ? previewState.adjacentFromSectionIds
        .map((value) => (typeof value === 'string' ? translateSectionRecordId(value) : null))
        .filter((value): value is string => Boolean(value))
    : previewState.adjacentFromSectionIds;

  const branchDirectionsBySectionId =
    previewState.branchDirectionsBySectionId &&
    typeof previewState.branchDirectionsBySectionId === 'object'
      ? Object.fromEntries(
          Object.entries(previewState.branchDirectionsBySectionId as Record<string, unknown>).map(
            ([recordId, direction]) => [translateSectionRecordId(recordId) ?? recordId, direction]
          )
        )
      : previewState.branchDirectionsBySectionId;

  const returnDirectionsBySectionId =
    previewState.returnDirectionsBySectionId &&
    typeof previewState.returnDirectionsBySectionId === 'object'
      ? Object.fromEntries(
          Object.entries(previewState.returnDirectionsBySectionId as Record<string, unknown>).map(
            ([recordId, direction]) => [translateSectionRecordId(recordId) ?? recordId, direction]
          )
        )
      : previewState.returnDirectionsBySectionId;

  return {
    ...previewState,
    adjacentFromSectionIds,
    branchDirectionsBySectionId,
    returnDirectionsBySectionId,
  };
};

export const persistCampaignSnapshotBySession = async ({
  sessionId,
  snapshot,
}: {
  sessionId: string;
  snapshot: CampaignSnapshot;
}): Promise<PersistCampaignSnapshotResult> => {
  try {
    const { data: existingCampaign, error: existingCampaignError } = await supabase
      .from('procgen_campaigns')
      .select('*')
      .eq('session_id', sessionId)
      .maybeSingle();

    if (existingCampaignError) {
      throw existingCampaignError;
    }

    const campaignPayload = {
      session_id: sessionId,
      name: snapshot.campaign.name,
      world_seed: snapshot.campaign.worldSeed,
      campaign_goal_id: snapshot.campaign.campaignGoalId,
      difficulty_model: snapshot.campaign.difficultyModel,
      tone_profile: snapshot.campaign.toneProfile,
      starting_section_id: snapshot.campaign.startingSectionId,
      active_section_id: snapshot.campaign.activeSectionId,
      dungeon_graph: toDbDungeonGraph(snapshot.campaign.dungeonGraph),
      generation_state: snapshot.campaign.generationState,
      presentation_state: snapshot.campaign.presentationState,
    };

    const campaignMutation = existingCampaign
      ? supabase
          .from('procgen_campaigns')
          .update(campaignPayload)
          .eq('id', existingCampaign.id)
          .select()
          .single()
      : supabase.from('procgen_campaigns').insert(campaignPayload).select().single();

    const { data: persistedCampaign, error: campaignMutationError } = await campaignMutation;

    if (campaignMutationError || !persistedCampaign) {
      throw campaignMutationError ?? new Error('Failed to persist campaign');
    }

    const campaignId = (persistedCampaign as DbProcgenCampaign).id;
    const sectionRows = snapshot.sections.map((section) => ({
      campaign_id: campaignId,
      section_id: section.sectionId,
      name: section.name,
      state: section.state,
      primary_biome_id: section.primaryBiomeId,
      secondary_biome_ids: section.secondaryBiomeIds,
      layout_type: section.layoutType,
      grid: {
        width: section.grid.width,
        height: section.grid.height,
        tile_size_ft: section.grid.tileSizeFt,
      },
      room_ids: section.roomIds,
      entrance_connection_ids: section.entranceConnectionIds,
      exit_connection_ids: section.exitConnectionIds,
      generation_state: toPersistedSectionGenerationState(section.generationState),
      presentation_state: section.presentationState,
      override_state: section.overrideState,
      render_payload_cache: toPersistedRenderPayloadCache(section.renderPayloadCache),
      locked_at: section.lockedAt,
    }));

    if (sectionRows.length > 0) {
      const { error: sectionUpsertError } = await supabase
        .from('procgen_sections')
        .upsert(sectionRows, { onConflict: 'campaign_id,section_id' });

      if (sectionUpsertError) {
        throw sectionUpsertError;
      }
    }

    const { data: persistedSections, error: persistedSectionsError } = await supabase
      .from('procgen_sections')
      .select('*')
      .eq('campaign_id', campaignId)
      .order('created_at', { ascending: true });

    if (persistedSectionsError) {
      throw persistedSectionsError;
    }

    const recordIdToSemanticSectionId = new Map(
      snapshot.sections.map((section) => [section.id, section.sectionId])
    );
    const semanticSectionIdToPersistedRowId = new Map(
      ((persistedSections as DbProcgenSection[] | null) ?? []).map((section) => [
        section.section_id,
        section.id,
      ])
    );
    const translateSectionRecordId = (recordId: string | null) => {
      if (!recordId) {
        return null;
      }

      const semanticSectionId = recordIdToSemanticSectionId.get(recordId);
      if (semanticSectionId) {
        return semanticSectionIdToPersistedRowId.get(semanticSectionId) ?? null;
      }

      return recordId;
    };

    const { data: existingPreviews, error: existingPreviewsError } = await supabase
      .from('procgen_section_previews')
      .select('id, section_stub_id')
      .eq('campaign_id', campaignId);

    if (existingPreviewsError) {
      throw existingPreviewsError;
    }

    const previewRows = snapshot.previews.map((preview) => ({
      campaign_id: campaignId,
      from_section_id: translateSectionRecordId(preview.fromSectionId),
      section_stub_id: preview.sectionStubId,
      direction: preview.direction,
        preview_state: toPersistedPreviewState(
          translatePreviewStateSectionReferences(preview.previewState, translateSectionRecordId)
        ),
    }));

    if (previewRows.length > 0) {
      const { error: previewUpsertError } = await supabase
        .from('procgen_section_previews')
        .upsert(previewRows, { onConflict: 'campaign_id,section_stub_id' });

      if (previewUpsertError) {
        throw previewUpsertError;
      }
    }

    const activePreviewStubIds = new Set(snapshot.previews.map((preview) => preview.sectionStubId));
    const stalePreviewIds = ((existingPreviews as Pick<DbProcgenSectionPreview, 'id' | 'section_stub_id'>[] | null) ?? [])
      .filter((preview) => !activePreviewStubIds.has(preview.section_stub_id))
      .map((preview) => preview.id);

    if (stalePreviewIds.length > 0) {
      const { error: previewDeleteError } = await supabase
        .from('procgen_section_previews')
        .delete()
        .in('id', stalePreviewIds);

      if (previewDeleteError) {
        throw previewDeleteError;
      }
    }

    const { error: campaignTouchError } = await supabase
      .from('procgen_campaigns')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', campaignId);

    if (campaignTouchError) {
      throw campaignTouchError;
    }

    return {
      success: true,
      campaignId,
    };
  } catch (error) {
    return {
      success: false,
      error: getErrorMessage(error),
    };
  }
};

export const hydrateProcgenCampaignBySession = async (
  sessionId: string
): Promise<CampaignWorld | null> => {
  const store = useProcgenStore.getState();
  store.setLoading(true);
  store.setError(null);
  const localSnapshot = loadLocalCampaignSnapshot(sessionId);

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
      const localCampaign = hydrateProvidedSnapshot(localSnapshot);
      if (localCampaign) {
        return localCampaign;
      }

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

    if (sections.length === 0) {
      const localCampaign = hydrateProvidedSnapshot(localSnapshot);
      if (localCampaign) {
        return localCampaign;
      }
    }

    const remoteSnapshot: CampaignSnapshot = {
      campaign,
      sections: sections.map(dbProcgenSectionToDungeonSectionRecord),
      previews: sectionPreviews.map(dbProcgenSectionPreviewToProcgenSectionPreviewRecord),
      sectionPreviews: sectionPreviews.map(dbProcgenSectionPreviewToProcgenSectionPreviewRecord),
      roomStates: [],
      overrides: [],
      sharedAssets: [],
    };

    if (shouldPreferLocalSnapshot({ localSnapshot, remoteSnapshot })) {
      return hydrateProvidedSnapshot(localSnapshot);
    }

    useProcgenStore.getState().hydrateProcgenState({
      campaign,
      sections: remoteSnapshot.sections,
      roomStates: roomStates.map(dbProcgenRoomStateToRoomStateRecord),
      overrides: overrides.map(dbProcgenOverrideToGMOverrideRecord),
      sectionPreviews: remoteSnapshot.previews,
      sharedAssets: sharedAssets.map(dbSharedAssetToSharedAssetRecord),
    });

    return campaign;
  } catch (error) {
    const localCampaign = hydrateProvidedSnapshot(localSnapshot);
    if (localCampaign) {
      useProcgenStore.getState().setError(null);
      return localCampaign;
    }

    const errorMessage = getErrorMessage(error);
    useProcgenStore.getState().clearProcgenState();
    useProcgenStore.getState().setError(errorMessage);
    return null;
  }
};

export const bakeSectionFloorCache = async (
  section: DungeonSectionRecord
): Promise<BakeSectionFloorCacheResult> => {
  const generatedSection = section.generationState.generatedSection;

  if (!generatedSection) {
    return { success: false, error: 'Section is missing generated geometry' };
  }

  const previousCache = section.renderPayloadCache ?? {};
  const content = loadMapBakeContent();
  const expectedContentSignature = getMapBakeContentSignature(content);
  const storedBakeState =
    previousCache.bakeJobState && typeof previousCache.bakeJobState === 'object'
      ? (previousCache.bakeJobState as MapBakeJobState)
      : null;
  const previousBakeState =
    storedBakeState?.contentSignature === expectedContentSignature &&
    hasRenderableBakedChunks(previousCache.bakedFloor)
      ? storedBakeState
      : null;

  const orchestrator = createMapBakeOrchestrator({
    content,
    artifactWriter: createInlineArtifactWriter(),
  });

  const semanticMap = buildSemanticMapFromGeneratedSection(generatedSection);
  const renderPayload = buildSectionRenderPayload(generatedSection);
  let nextPreviousState = previousBakeState;
  let result = await orchestrator.runBake({
    semanticMap,
    renderPayload,
    previousState: nextPreviousState,
    maxChunksPerInvocation: LOCAL_BAKE_MAX_CHUNKS_PER_INVOCATION,
  });

  let invocationCount = 1;
  while (
    result.jobState.status === 'running' &&
    invocationCount < LOCAL_BAKE_MAX_INVOCATIONS
  ) {
    nextPreviousState = result.jobState;
    result = await orchestrator.runBake({
      semanticMap,
      renderPayload,
      previousState: nextPreviousState,
      maxChunksPerInvocation: LOCAL_BAKE_MAX_CHUNKS_PER_INVOCATION,
    });
    invocationCount += 1;
  }

  if (result.jobState.status !== 'complete') {
    return {
      success: false,
      error: `Bake did not complete after ${invocationCount} local invocation(s)`,
    };
  }

  const renderPayloadCache = {
    ...previousCache,
    bakedFloor: result.jobState.bakedFloor,
    bakeManifest: result.manifest,
    bakeJobState: result.jobState,
  };

  useProcgenStore.getState().updateSectionRenderPayloadCache({
    sectionRecordId: section.id,
    renderPayloadCache,
  });

  if (isLocalBrowserRuntime() && hasEphemeralChunkUrls(renderPayloadCache)) {
    return { success: true, renderPayloadCache };
  }

  const { error } = await supabase
    .from('procgen_sections')
    .update({ render_payload_cache: toPersistedRenderPayloadCache(renderPayloadCache) })
    .eq('id', section.id);

  if (error) {
    return {
      success: true,
      renderPayloadCache,
      persistenceError: error.message,
    };
  }

  return { success: true, renderPayloadCache };
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

  const bakeSectionFloorCacheAction = useCallback(
    async (section: DungeonSectionRecord) => bakeSectionFloorCache(section),
    []
  );

  return {
    campaign,
    activeSectionId,
    isLoading,
    error,
    sectionsById,
    loadCampaignBySession,
    bakeSectionFloorCache: bakeSectionFloorCacheAction,
    clearProcgenState,
  };
};
