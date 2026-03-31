import type {
  CampaignWorld,
  DungeonGraph,
  DungeonSectionRecord,
  ProcgenSectionPreviewRecord,
} from '../../types';
import type {
  CampaignBookEntryStatus,
  CardinalDirection,
  GeneratedSection,
  GeneratedSectionContent,
  OverviewEdge,
  OverviewNode,
  OverviewViewer,
  SectionContentRerollScope,
  SectionContentRerollState,
} from '../types';
import { generateSection } from './sectionGenerator';
import {
  generateSectionContent,
  getNextContentRerollState,
} from './sectionContentGenerator';
import { resolveSectionProfile } from './sectionProfileResolver';
import { generateSectionLabel } from './sectionNaming';

const START_SECTION_ID = 'section_start_village';
const START_VILLAGE_NAME = 'Hometown';
const START_VILLAGE_WORLD_SEED = 'dungen-starting-village-v1';
const CARDINAL_DIRECTIONS: CardinalDirection[] = ['north', 'south', 'east', 'west'];

const DIRECTION_DELTAS: Record<CardinalDirection, { x: number; y: number }> = {
  north: { x: 0, y: -1 },
  south: { x: 0, y: 1 },
  east: { x: 1, y: 0 },
  west: { x: -1, y: 0 },
};

const OPPOSITE_DIRECTION: Record<CardinalDirection, CardinalDirection> = {
  north: 'south',
  south: 'north',
  east: 'west',
  west: 'east',
};

export interface CampaignSnapshot {
  campaign: CampaignWorld;
  sections: DungeonSectionRecord[];
  previews: ProcgenSectionPreviewRecord[];
  sectionPreviews: ProcgenSectionPreviewRecord[];
  roomStates: [];
  overrides: [];
  sharedAssets: [];
}

const createCampaignId = (sessionId: string) => `campaign_${sessionId}`;
const createSectionRecordId = (sectionId: string) => `section_record_${sectionId}`;
const createPreviewId = (sectionId: string) => `preview_${sectionId}`;
const toCoordinateKey = (coordinates: { x: number; y: number }) =>
  `${coordinates.x},${coordinates.y}`;
const DEFAULT_CONTENT_REROLL_STATE: SectionContentRerollState = {
  summary: 0,
  npcs: 0,
  creatures: 0,
  encounters: 0,
  shops: 0,
  hazards: 0,
  rumors: 0,
};

const getSectionCoordinates = (section: DungeonSectionRecord) =>
  (section.generationState.coordinates ?? { x: 0, y: 0 }) as { x: number; y: number };

const getPreviewCoordinates = (preview: ProcgenSectionPreviewRecord) =>
  (preview.previewState.coordinates ?? { x: 0, y: 0 }) as { x: number; y: number };

const resolveProfileForCoordinates = ({
  worldSeed,
  coordinates,
  graphDepth,
  requestedSectionKind,
  forcedSettlementProfileId,
  siblingBiomeIds,
  siblingSettlementProfileIds,
}: {
  worldSeed: string;
  coordinates: { x: number; y: number };
  graphDepth?: number;
  requestedSectionKind?: 'exploration' | 'settlement';
  forcedSettlementProfileId?: string | null;
  siblingBiomeIds?: string[];
  siblingSettlementProfileIds?: string[];
}) =>
  resolveSectionProfile({
    worldSeed,
    coordinates,
    graphDepth,
    requestedSectionKind,
    forcedSettlementProfileId: forcedSettlementProfileId ?? undefined,
    siblingBiomeIds,
    siblingSettlementProfileIds,
  });

const getPreviewAdjacentFromSectionIds = (preview: ProcgenSectionPreviewRecord) => {
  const ids = new Set<string>();

  if (preview.fromSectionId) {
    ids.add(preview.fromSectionId);
  }

  const adjacentIds = preview.previewState.adjacentFromSectionIds as string[] | undefined;
  for (const id of adjacentIds ?? []) {
    ids.add(id);
  }

  return [...ids];
};

const getPreviewDirectionForSection = (
  preview: ProcgenSectionPreviewRecord,
  fromSectionRecordId: string | null
): CardinalDirection | null => {
  const mappedDirections = preview.previewState.branchDirectionsBySectionId as
    | Record<string, CardinalDirection>
    | undefined;

  if (fromSectionRecordId && mappedDirections?.[fromSectionRecordId]) {
    return mappedDirections[fromSectionRecordId];
  }

  return preview.direction as CardinalDirection | null;
};

const getPreviewReturnDirectionForSection = (
  preview: ProcgenSectionPreviewRecord,
  fromSectionRecordId: string | null
): CardinalDirection | null => {
  const mappedDirections = preview.previewState.returnDirectionsBySectionId as
    | Record<string, CardinalDirection>
    | undefined;

  if (fromSectionRecordId && mappedDirections?.[fromSectionRecordId]) {
    return mappedDirections[fromSectionRecordId];
  }

  return (preview.previewState.returnDirection as CardinalDirection | undefined) ?? null;
};

const mergePreviewAdjacency = ({
  preview,
  fromSectionRecordId,
  direction,
  playerVisibility,
}: {
  preview: ProcgenSectionPreviewRecord;
  fromSectionRecordId: string;
  direction: CardinalDirection;
  playerVisibility: 'unknown' | 'known_unvisited';
}): ProcgenSectionPreviewRecord => {
  const adjacentFromSectionIds = new Set(getPreviewAdjacentFromSectionIds(preview));
  adjacentFromSectionIds.add(fromSectionRecordId);

  const existingBranchDirections = (preview.previewState.branchDirectionsBySectionId as
    | Record<string, CardinalDirection>
    | undefined) ?? {};
  const existingReturnDirections = (preview.previewState.returnDirectionsBySectionId as
    | Record<string, CardinalDirection>
    | undefined) ?? {};

  if (preview.fromSectionId && preview.direction) {
    existingBranchDirections[preview.fromSectionId] = preview.direction as CardinalDirection;
  }

  if (preview.fromSectionId && preview.previewState.returnDirection) {
    existingReturnDirections[preview.fromSectionId] =
      preview.previewState.returnDirection as CardinalDirection;
  }

  return {
    ...preview,
    previewState: {
      ...preview.previewState,
      adjacentFromSectionIds: [...adjacentFromSectionIds],
      branchDirectionsBySectionId: {
        ...existingBranchDirections,
        [fromSectionRecordId]: direction,
      },
      returnDirectionsBySectionId: {
        ...existingReturnDirections,
        [fromSectionRecordId]: OPPOSITE_DIRECTION[direction],
      },
      playerVisibility:
        preview.previewState.playerVisibility === 'known_unvisited' ||
        playerVisibility === 'known_unvisited'
          ? 'known_unvisited'
          : 'unknown',
    },
    updatedAt: new Date().toISOString(),
  };
};

const appendGraphNode = (graph: DungeonGraph, sectionId: string): DungeonGraph => ({
  ...graph,
  nodes: graph.nodes.includes(sectionId) ? graph.nodes : [...graph.nodes, sectionId],
});

const appendGraphEdge = (
  graph: DungeonGraph,
  fromSectionId: string,
  direction: CardinalDirection,
  toSectionId: string
): DungeonGraph => {
  const edgeId = `${fromSectionId}:${direction}:${toSectionId}`;
  const existing = graph.edges.some(
    (edge) =>
      `${edge.fromSectionId}:${edge.fromConnectionId}:${edge.toSectionId}` === edgeId
  );

  if (existing) {
    return graph;
  }

  return {
    nodes: graph.nodes.includes(toSectionId) ? graph.nodes : [...graph.nodes, toSectionId],
    edges: [
      ...graph.edges,
      {
        fromSectionId,
        fromConnectionId: direction,
        toSectionId,
        toConnectionId: OPPOSITE_DIRECTION[direction],
      },
    ],
  };
};

const createSectionRecord = ({
  campaignId,
  sectionId,
  name,
  worldSeed,
  visitIndex,
  coordinates,
  graphDepth,
  enteredFromDirection,
  sectionKind,
  settlementArchetypeId = null,
  sectionProfileOverride = null,
  generatedSectionOverride = null,
  generatedContentOverride = null,
  contentRerollState = DEFAULT_CONTENT_REROLL_STATE,
}: {
  campaignId: string;
  sectionId: string;
  name: string;
  worldSeed: string;
  visitIndex: number;
  coordinates: { x: number; y: number };
  graphDepth?: number;
  enteredFromDirection: CardinalDirection | null;
  sectionKind: 'exploration' | 'settlement';
  settlementArchetypeId?: string | null;
  sectionProfileOverride?: ReturnType<typeof resolveSectionProfile> | null;
  generatedSectionOverride?: GeneratedSection | null;
  generatedContentOverride?: GeneratedSectionContent | null;
  contentRerollState?: SectionContentRerollState;
}): DungeonSectionRecord => {
  const sectionProfile =
    sectionProfileOverride ??
    resolveProfileForCoordinates({
      worldSeed,
      coordinates,
      graphDepth,
      requestedSectionKind: sectionKind,
      forcedSettlementProfileId: settlementArchetypeId,
    });
  const generatedSection =
    generatedSectionOverride ??
    generateSection({
      worldSeed,
      sectionId,
      sectionProfile,
    });
  const generatedContent =
    generatedContentOverride ??
    generateSectionContent({
      section: generatedSection,
      sectionName: name,
      settlementArchetypeId: settlementArchetypeId ?? sectionProfile.settlementProfileId,
      rerollState: contentRerollState,
    });
  const timestamp = new Date().toISOString();

  return {
    id: createSectionRecordId(sectionId),
    campaignId,
    sectionId,
    name,
    state: 'locked',
    primaryBiomeId: generatedSection.primaryBiomeId,
    secondaryBiomeIds: [],
    layoutType: generatedSection.layoutType,
    grid: generatedSection.grid,
    roomIds: generatedSection.rooms.map((room) => room.roomId),
    entranceConnectionIds: generatedSection.entranceRoomIds,
    exitConnectionIds: generatedSection.exitRoomIds,
    generationState: {
      generatedSection,
      generatedContent,
      contentRerollState,
      settlementArchetypeId: settlementArchetypeId ?? sectionProfile.settlementProfileId,
      sectionProfile,
      coordinates,
      visitIndex,
      enteredFromDirection,
      sectionKind: generatedSection.sectionKind,
    },
    presentationState: {
      playerVisibility: 'visited',
    },
    overrideState: {},
    renderPayloadCache: null,
    lockedAt: timestamp,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
};

const createPreviewRecord = ({
  campaignId,
  fromSectionId,
  parentSectionId,
  sectionId,
  direction,
  coordinates,
  graphDepth,
  worldSeed,
  playerVisibility,
  label = null,
  settlementArchetypeId = null,
  sectionProfileOverride = null,
  siblingBiomeIds = [],
  siblingSettlementProfileIds = [],
  contentRerollState = DEFAULT_CONTENT_REROLL_STATE,
  reservedLabels = new Set<string>(),
}: {
  campaignId: string;
  fromSectionId: string;
  parentSectionId: string;
  sectionId: string;
  direction: CardinalDirection;
  coordinates: { x: number; y: number };
  graphDepth?: number;
  worldSeed: string;
  playerVisibility: 'known_unvisited' | 'unknown';
  label?: string | null;
  settlementArchetypeId?: string | null;
  sectionProfileOverride?: ReturnType<typeof resolveSectionProfile> | null;
  siblingBiomeIds?: string[];
  siblingSettlementProfileIds?: string[];
  contentRerollState?: SectionContentRerollState;
  reservedLabels?: Set<string>;
}): ProcgenSectionPreviewRecord => {
  const sectionProfile =
    sectionProfileOverride ??
    resolveProfileForCoordinates({
      worldSeed,
      coordinates,
      graphDepth,
      forcedSettlementProfileId: settlementArchetypeId,
      siblingBiomeIds,
      siblingSettlementProfileIds,
    });
  const generatedSection = generateSection({
    worldSeed,
    sectionId,
    sectionProfile,
  });
  const generatedLabel = label ?? generateSectionLabel({ worldSeed, sectionId, section: generatedSection });
  let resolvedLabel = generatedLabel;
  let duplicateIndex = 2;

  while (reservedLabels.has(resolvedLabel)) {
    resolvedLabel = `${generatedLabel} ${duplicateIndex}`;
    duplicateIndex += 1;
  }

  reservedLabels.add(resolvedLabel);
  const generatedContent = generateSectionContent({
    section: generatedSection,
    sectionName: resolvedLabel,
    settlementArchetypeId: settlementArchetypeId ?? sectionProfile.settlementProfileId,
    rerollState: contentRerollState,
  });
  const timestamp = new Date().toISOString();

  return {
    id: createPreviewId(sectionId),
    campaignId,
    fromSectionId,
    sectionStubId: sectionId,
    direction,
    previewState: {
      generatedSection,
      generatedContent,
      contentRerollState,
      settlementArchetypeId: settlementArchetypeId ?? sectionProfile.settlementProfileId,
      sectionProfile,
      coordinates,
      label: resolvedLabel,
      parentSectionId,
      playerVisibility,
      returnDirection: OPPOSITE_DIRECTION[direction],
      adjacentFromSectionIds: [fromSectionId],
      branchDirectionsBySectionId: {
        [fromSectionId]: direction,
      },
      returnDirectionsBySectionId: {
        [fromSectionId]: OPPOSITE_DIRECTION[direction],
      },
    },
    createdAt: timestamp,
    updatedAt: timestamp,
  };
};

const toSectionArray = (snapshot: CampaignSnapshot) => snapshot.sections;
const toPreviewArray = (snapshot: CampaignSnapshot) => snapshot.previews;

export const createStarterCampaignSnapshot = ({
  sessionId,
  campaignName,
  worldSeed,
}: {
  sessionId: string;
  campaignName: string;
  worldSeed: string;
}): CampaignSnapshot => {
  const campaignId = createCampaignId(sessionId);
  const startingSection = createSectionRecord({
    campaignId,
    sectionId: START_SECTION_ID,
    name: START_VILLAGE_NAME,
    worldSeed: START_VILLAGE_WORLD_SEED,
    visitIndex: 0,
    coordinates: { x: 0, y: 0 },
    graphDepth: 0,
    enteredFromDirection: null,
    sectionKind: 'settlement',
    settlementArchetypeId: 'waystop',
    sectionProfileOverride: resolveProfileForCoordinates({
      worldSeed: START_VILLAGE_WORLD_SEED,
      coordinates: { x: 0, y: 0 },
      graphDepth: 0,
      requestedSectionKind: 'settlement',
      forcedSettlementProfileId: 'waystop',
    }),
  });

  const reservedLabels = new Set([START_VILLAGE_NAME]);
  const usedBiomeIds: string[] = [];
  const usedSettlementProfileIds: string[] = [];
  const previews = CARDINAL_DIRECTIONS.map((direction) => {
    const delta = DIRECTION_DELTAS[direction];
    const sectionId = `${START_SECTION_ID}_${direction}`;

    const previewRecord = createPreviewRecord({
      campaignId,
      fromSectionId: startingSection.id,
      parentSectionId: START_SECTION_ID,
      sectionId,
      direction,
      coordinates: delta,
      graphDepth: 1,
      worldSeed,
      playerVisibility: 'known_unvisited',
      siblingBiomeIds: usedBiomeIds,
      siblingSettlementProfileIds: usedSettlementProfileIds,
      reservedLabels,
    });

    const sectionProfile = previewRecord.previewState.sectionProfile as
      | ReturnType<typeof resolveSectionProfile>
      | undefined;
    if (sectionProfile?.biomeProfileId) {
      usedBiomeIds.push(sectionProfile.biomeProfileId);
    }
    if (sectionProfile?.settlementProfileId) {
      usedSettlementProfileIds.push(sectionProfile.settlementProfileId);
    }

    return previewRecord;
  });

  let dungeonGraph: DungeonGraph = {
    nodes: [START_SECTION_ID],
    edges: [],
  };

  for (const preview of previews) {
    dungeonGraph = appendGraphEdge(
      appendGraphNode(dungeonGraph, preview.sectionStubId),
      START_SECTION_ID,
      preview.direction as CardinalDirection,
      preview.sectionStubId
    );
  }

  const timestamp = new Date().toISOString();
  const campaign: CampaignWorld = {
    id: campaignId,
    sessionId,
    name: campaignName,
    worldSeed,
    campaignGoalId: null,
    difficultyModel: 'distance_scaled_balanced',
    toneProfile: {},
    startingSectionId: START_SECTION_ID,
    activeSectionId: START_SECTION_ID,
    dungeonGraph,
    generationState: {
      previewMode: 'local_bootstrap',
    },
    presentationState: {
      currentTabSectionId: START_SECTION_ID,
    },
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  return {
    campaign,
    sections: [startingSection],
    previews,
    sectionPreviews: previews,
    roomStates: [],
    overrides: [],
    sharedAssets: [],
  };
};

export const visitSectionPreview = (
  snapshot: CampaignSnapshot,
  previewId: string,
  preferredFromSectionRecordId: string | null = null
): CampaignSnapshot => {
  const preview = snapshot.previews.find((candidate) => candidate.id === previewId);

  if (!preview) {
    return snapshot;
  }

  const previewCoordinates = getPreviewCoordinates(preview);
  const previewAdjacentFromIds = getPreviewAdjacentFromSectionIds(preview);
  const sourceSectionRecordId =
    (preferredFromSectionRecordId && previewAdjacentFromIds.includes(preferredFromSectionRecordId)
      ? preferredFromSectionRecordId
      : previewAdjacentFromIds[0]) ?? null;
  const sourceSectionRecord = snapshot.sections.find((section) => section.id === sourceSectionRecordId) ?? null;
  const sourceSectionId = sourceSectionRecord?.sectionId ?? null;
  const enteredFromDirection =
    getPreviewReturnDirectionForSection(preview, sourceSectionRecordId) ??
    (preview.previewState.returnDirection as CardinalDirection | undefined) ??
    'west';
  const travelDirection =
    getPreviewDirectionForSection(preview, sourceSectionRecordId) ??
    ((preview.direction as CardinalDirection | undefined) ?? OPPOSITE_DIRECTION[enteredFromDirection]);
  const existingVisitedSection = snapshot.sections.find(
    (section) =>
      toCoordinateKey(getSectionCoordinates(section)) === toCoordinateKey(previewCoordinates) &&
      section.sectionId !== preview.sectionStubId
  );
  const remainingPreviews = snapshot.previews.filter((candidate) => candidate.id !== previewId);

  if (existingVisitedSection) {
    const nextGraph =
      sourceSectionId !== null
        ? appendGraphEdge(
            appendGraphNode(snapshot.campaign.dungeonGraph, existingVisitedSection.sectionId),
            sourceSectionId,
            travelDirection,
            existingVisitedSection.sectionId
          )
        : snapshot.campaign.dungeonGraph;

    return {
      ...snapshot,
      campaign: {
        ...snapshot.campaign,
        activeSectionId: existingVisitedSection.sectionId,
        dungeonGraph: nextGraph,
        updatedAt: new Date().toISOString(),
      },
      previews: remainingPreviews,
      sectionPreviews: remainingPreviews,
    };
  }

  const visitIndex = snapshot.sections.length;
  const sectionRecord = createSectionRecord({
    campaignId: snapshot.campaign.id,
    sectionId: preview.sectionStubId,
    name: String(preview.previewState.label ?? preview.sectionStubId),
    worldSeed: snapshot.campaign.worldSeed,
    visitIndex,
    coordinates: previewCoordinates,
    graphDepth:
      (preview.previewState.sectionProfile as { graphDepth?: number } | undefined)?.graphDepth,
    enteredFromDirection,
    sectionKind:
      (preview.previewState.generatedSection as GeneratedSection | undefined)?.sectionKind ??
      'exploration',
    settlementArchetypeId:
      (preview.previewState.sectionProfile as { settlementProfileId?: string | null } | undefined)
        ?.settlementProfileId ?? null,
    sectionProfileOverride:
      (preview.previewState.sectionProfile as ReturnType<typeof resolveSectionProfile> | undefined) ??
      null,
    generatedSectionOverride: preview.previewState.generatedSection as GeneratedSection,
    generatedContentOverride: preview.previewState.generatedContent as GeneratedSectionContent,
    contentRerollState:
      (preview.previewState.contentRerollState as SectionContentRerollState | undefined) ??
      DEFAULT_CONTENT_REROLL_STATE,
  });

  const outboundDirections = CARDINAL_DIRECTIONS.filter(
    (direction) => direction !== enteredFromDirection
  );
  const nextGraphDepth =
    ((sectionRecord.generationState.sectionProfile as { graphDepth?: number } | undefined)
      ?.graphDepth ?? 0) + 1;
  let dungeonGraph = appendGraphNode(snapshot.campaign.dungeonGraph, preview.sectionStubId);
  let nextPreviews = [...remainingPreviews];
  const nextSections = [...snapshot.sections, sectionRecord];
  const reservedLabels = new Set<string>([
    ...nextSections.map((section) => section.name),
    ...nextPreviews.map((candidate) => String(candidate.previewState.label ?? candidate.sectionStubId)),
  ]);
  const siblingBiomeIds: string[] = nextPreviews
    .filter((candidate) => getPreviewAdjacentFromSectionIds(candidate).includes(sectionRecord.id))
    .map(
      (candidate) =>
        (candidate.previewState.sectionProfile as { biomeProfileId?: string } | undefined)
          ?.biomeProfileId
    )
    .filter((value): value is string => Boolean(value));
  const siblingSettlementProfileIds: string[] = nextPreviews
    .filter((candidate) => getPreviewAdjacentFromSectionIds(candidate).includes(sectionRecord.id))
    .map(
      (candidate) =>
        (candidate.previewState.sectionProfile as { settlementProfileId?: string | null } | undefined)
          ?.settlementProfileId ?? null
    )
    .filter((value): value is string => Boolean(value));

  for (const direction of outboundDirections) {
    const delta = DIRECTION_DELTAS[direction];
    const coordinates = {
      x: previewCoordinates.x + delta.x,
      y: previewCoordinates.y + delta.y,
    };
    const coordinateKey = toCoordinateKey(coordinates);
    const existingVisitedDestination = nextSections.find(
      (section) => toCoordinateKey(getSectionCoordinates(section)) === coordinateKey
    );

    if (existingVisitedDestination) {
      dungeonGraph = appendGraphEdge(
        appendGraphNode(dungeonGraph, existingVisitedDestination.sectionId),
        preview.sectionStubId,
        direction,
        existingVisitedDestination.sectionId
      );
      continue;
    }

    const existingPreviewIndex = nextPreviews.findIndex(
      (candidate) => toCoordinateKey(getPreviewCoordinates(candidate)) === coordinateKey
    );

    if (existingPreviewIndex >= 0) {
      const existingPreview = nextPreviews[existingPreviewIndex];
      nextPreviews[existingPreviewIndex] = mergePreviewAdjacency({
        preview: existingPreview,
        fromSectionRecordId: sectionRecord.id,
        direction,
        playerVisibility: 'unknown',
      });
      dungeonGraph = appendGraphEdge(
        appendGraphNode(dungeonGraph, existingPreview.sectionStubId),
        preview.sectionStubId,
        direction,
        existingPreview.sectionStubId
      );
      continue;
    }

    const sectionId = `${preview.sectionStubId}_${direction}`;
    const previewRecord = createPreviewRecord({
      campaignId: snapshot.campaign.id,
      fromSectionId: sectionRecord.id,
      parentSectionId: preview.sectionStubId,
      sectionId,
      direction,
      coordinates,
      graphDepth: nextGraphDepth,
      worldSeed: snapshot.campaign.worldSeed,
      playerVisibility: 'unknown',
      siblingBiomeIds,
      siblingSettlementProfileIds,
      reservedLabels,
    });

    const previewProfile = previewRecord.previewState.sectionProfile as
      | ReturnType<typeof resolveSectionProfile>
      | undefined;
    if (previewProfile?.biomeProfileId) {
      siblingBiomeIds.push(previewProfile.biomeProfileId);
    }
    if (previewProfile?.settlementProfileId) {
      siblingSettlementProfileIds.push(previewProfile.settlementProfileId);
    }

    nextPreviews.push(previewRecord);
    dungeonGraph = appendGraphEdge(
      appendGraphNode(dungeonGraph, previewRecord.sectionStubId),
      preview.sectionStubId,
      previewRecord.direction as CardinalDirection,
      previewRecord.sectionStubId
    );
  }

  const campaign: CampaignWorld = {
    ...snapshot.campaign,
    activeSectionId: preview.sectionStubId,
    dungeonGraph,
    updatedAt: new Date().toISOString(),
  };

  return {
    campaign,
    sections: nextSections,
    previews: nextPreviews,
    sectionPreviews: nextPreviews,
    roomStates: [],
    overrides: [],
    sharedAssets: [],
  };
};

export const buildOverviewGraph = (
  snapshot: CampaignSnapshot,
  viewer: OverviewViewer
): { nodes: OverviewNode[]; edges: OverviewEdge[] } => {
  const sectionNodes: OverviewNode[] = snapshot.sections.map((section) => ({
    sectionId: section.sectionId,
    label: section.name,
    x: Number((section.generationState.coordinates as { x?: number })?.x ?? 0),
    y: Number((section.generationState.coordinates as { y?: number })?.y ?? 0),
    state: 'visited',
    visitIndex: Number((section.generationState.visitIndex as number | undefined) ?? 0),
  }));

  const previewNodes: OverviewNode[] = snapshot.previews
    .filter((preview) => {
      if (viewer === 'gm') {
        return true;
      }

      return preview.previewState.playerVisibility === 'known_unvisited';
    })
    .map((preview) => ({
      sectionId: preview.sectionStubId,
      label: String(preview.previewState.label ?? preview.sectionStubId),
      x: Number((preview.previewState.coordinates as { x?: number })?.x ?? 0),
      y: Number((preview.previewState.coordinates as { y?: number })?.y ?? 0),
      state:
        viewer === 'gm'
          ? 'preview'
          : (preview.previewState.playerVisibility as 'known_unvisited'),
      visitIndex: null,
    }));

  const visibleSectionIds = new Set(
    [...sectionNodes, ...previewNodes].map((node) => node.sectionId)
  );

  const edges: OverviewEdge[] = snapshot.campaign.dungeonGraph.edges
    .filter(
      (edge) =>
        visibleSectionIds.has(edge.fromSectionId) && visibleSectionIds.has(edge.toSectionId)
    )
    .map((edge) => ({
      id: `${edge.fromSectionId}:${edge.fromConnectionId}:${edge.toSectionId}`,
      fromSectionId: edge.fromSectionId,
      toSectionId: edge.toSectionId,
      state: sectionNodes.some((node) => node.sectionId === edge.toSectionId)
        ? 'available'
        : 'preview',
    }));

  return {
    nodes: [...sectionNodes, ...previewNodes],
    edges,
  };
};

export const createSnapshotFromStore = ({
  campaign,
  sections,
  previews,
}: {
  campaign: CampaignWorld;
  sections: DungeonSectionRecord[];
  previews: ProcgenSectionPreviewRecord[];
}): CampaignSnapshot => ({
  campaign,
  sections,
  previews,
  sectionPreviews: previews,
  roomStates: [],
  overrides: [],
  sharedAssets: [],
});

export const getOrderedVisitedSections = (snapshot: CampaignSnapshot) =>
  [...toSectionArray(snapshot)].sort((left, right) => {
    const leftIndex = Number((left.generationState.visitIndex as number | undefined) ?? 0);
    const rightIndex = Number((right.generationState.visitIndex as number | undefined) ?? 0);
    return leftIndex - rightIndex;
  });

export const getOrderedPreviews = (snapshot: CampaignSnapshot) =>
  [...toPreviewArray(snapshot)].sort((left, right) => {
    const leftLabel = String(left.previewState.label ?? left.sectionStubId);
    const rightLabel = String(right.previewState.label ?? right.sectionStubId);
    return leftLabel.localeCompare(rightLabel);
  });

export const rerollPreviewContent = (
  snapshot: CampaignSnapshot,
  previewId: string,
  scope: SectionContentRerollScope
): CampaignSnapshot => {
  const nextPreviews = snapshot.previews.map((preview) => {
    if (preview.id !== previewId) {
      return preview;
    }

    const currentRerollState =
      (preview.previewState.contentRerollState as Partial<SectionContentRerollState> | undefined) ??
      DEFAULT_CONTENT_REROLL_STATE;
    const nextRerollState = getNextContentRerollState(currentRerollState, scope);
    const generatedSection = preview.previewState.generatedSection as GeneratedSection;
    const label = String(preview.previewState.label ?? preview.sectionStubId);

    return {
      ...preview,
      previewState: {
        ...preview.previewState,
        contentRerollState: nextRerollState,
        generatedContent: generateSectionContent({
          section: generatedSection,
          sectionName: label,
          settlementArchetypeId: (preview.previewState.settlementArchetypeId as string | null | undefined) ?? null,
          rerollState: nextRerollState,
        }),
      },
      updatedAt: new Date().toISOString(),
    };
  });

  return {
    ...snapshot,
    previews: nextPreviews,
    sectionPreviews: nextPreviews,
  };
};

const updateGeneratedContentEntryStatus = (
  generatedContent: GeneratedSectionContent,
  entryId: string,
  status: CampaignBookEntryStatus
): GeneratedSectionContent => {
  let didChange = false;
  const nextEntries = generatedContent.campaignBook.entries.map((entry) => {
    if (entry.id !== entryId || entry.status === status) {
      return entry;
    }

    didChange = true;
    return {
      ...entry,
      status,
    };
  });

  if (!didChange) {
    return generatedContent;
  }

  return {
    ...generatedContent,
    campaignBook: {
      ...generatedContent.campaignBook,
      entries: nextEntries,
    },
  };
};

export const updateCampaignBookEntryStatus = (
  snapshot: CampaignSnapshot,
  target: { kind: 'section'; id: string } | { kind: 'preview'; id: string },
  entryId: string,
  status: CampaignBookEntryStatus
): CampaignSnapshot => {
  if (target.kind === 'section') {
    let didChange = false;
    const nextSections = snapshot.sections.map((section) => {
      if (section.sectionId !== target.id) {
        return section;
      }

      const generatedContent = section.generationState.generatedContent as
        | GeneratedSectionContent
        | undefined;

      if (!generatedContent) {
        return section;
      }

      const nextGeneratedContent = updateGeneratedContentEntryStatus(
        generatedContent,
        entryId,
        status
      );

      if (nextGeneratedContent === generatedContent) {
        return section;
      }

      didChange = true;
      return {
        ...section,
        generationState: {
          ...section.generationState,
          generatedContent: nextGeneratedContent,
        },
        updatedAt: new Date().toISOString(),
      };
    });

    return didChange
      ? {
          ...snapshot,
          sections: nextSections,
        }
      : snapshot;
  }

  let didChange = false;
  const nextPreviews = snapshot.previews.map((preview) => {
    if (preview.id !== target.id) {
      return preview;
    }

    const generatedContent = preview.previewState.generatedContent as
      | GeneratedSectionContent
      | undefined;

    if (!generatedContent) {
      return preview;
    }

    const nextGeneratedContent = updateGeneratedContentEntryStatus(
      generatedContent,
      entryId,
      status
    );

    if (nextGeneratedContent === generatedContent) {
      return preview;
    }

    didChange = true;
    return {
      ...preview,
      previewState: {
        ...preview.previewState,
        generatedContent: nextGeneratedContent,
      },
      updatedAt: new Date().toISOString(),
    };
  });

  return didChange
    ? {
        ...snapshot,
        previews: nextPreviews,
        sectionPreviews: nextPreviews,
      }
    : snapshot;
};
