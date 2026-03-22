import type {
  CampaignWorld,
  DungeonGraph,
  DungeonSectionRecord,
  ProcgenSectionPreviewRecord,
} from '../../types';
import type {
  CardinalDirection,
  OverviewEdge,
  OverviewNode,
  OverviewViewer,
} from '../types';
import { generateSection } from './sectionGenerator';

const START_SECTION_ID = 'section_start_village';
const START_VILLAGE_NAME = 'Bellrest';
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

const sectionLabelForDirection = (direction: CardinalDirection) =>
  ({
    north: 'North Road',
    south: 'South Road',
    east: 'East Road',
    west: 'West Road',
  })[direction];

const nestedSectionLabelForDirection = (direction: CardinalDirection) =>
  ({
    north: 'Northern Reach',
    south: 'Southern Reach',
    east: 'Eastern Reach',
    west: 'Western Reach',
  })[direction];

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
  enteredFromDirection,
  sectionKind,
}: {
  campaignId: string;
  sectionId: string;
  name: string;
  worldSeed: string;
  visitIndex: number;
  coordinates: { x: number; y: number };
  enteredFromDirection: CardinalDirection | null;
  sectionKind: 'exploration' | 'settlement';
}): DungeonSectionRecord => {
  const generatedSection = generateSection({
    worldSeed,
    sectionId,
    sectionKind,
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
      coordinates,
      visitIndex,
      enteredFromDirection,
      sectionKind,
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
  worldSeed,
  playerVisibility,
  label,
}: {
  campaignId: string;
  fromSectionId: string;
  parentSectionId: string;
  sectionId: string;
  direction: CardinalDirection;
  coordinates: { x: number; y: number };
  worldSeed: string;
  playerVisibility: 'known_unvisited' | 'unknown';
  label: string;
}): ProcgenSectionPreviewRecord => {
  const generatedSection = generateSection({
    worldSeed,
    sectionId,
    sectionKind: 'exploration',
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
      coordinates,
      label,
      parentSectionId,
      playerVisibility,
      returnDirection: OPPOSITE_DIRECTION[direction],
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
    enteredFromDirection: null,
    sectionKind: 'settlement',
  });

  const previews = CARDINAL_DIRECTIONS.map((direction) => {
    const delta = DIRECTION_DELTAS[direction];
    const sectionId = `${START_SECTION_ID}_${direction}`;

    return createPreviewRecord({
      campaignId,
      fromSectionId: startingSection.id,
      parentSectionId: START_SECTION_ID,
      sectionId,
      direction,
      coordinates: delta,
      worldSeed,
      playerVisibility: 'known_unvisited',
      label: sectionLabelForDirection(direction),
    });
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
  previewId: string
): CampaignSnapshot => {
  const preview = snapshot.previews.find((candidate) => candidate.id === previewId);

  if (!preview) {
    return snapshot;
  }

  const previewCoordinates = (preview.previewState.coordinates ?? { x: 0, y: 0 }) as {
    x: number;
    y: number;
  };
  const enteredFromDirection = preview.previewState.returnDirection as CardinalDirection;
  const visitIndex = snapshot.sections.length;
  const sectionRecord = createSectionRecord({
    campaignId: snapshot.campaign.id,
    sectionId: preview.sectionStubId,
    name: String(preview.previewState.label ?? preview.sectionStubId),
    worldSeed: snapshot.campaign.worldSeed,
    visitIndex,
    coordinates: previewCoordinates,
    enteredFromDirection,
    sectionKind: 'exploration',
  });

  const remainingPreviews = snapshot.previews.filter((candidate) => candidate.id !== previewId);

  const outboundDirections = CARDINAL_DIRECTIONS.filter(
    (direction) => direction !== enteredFromDirection
  );

  const newPreviews = outboundDirections.map((direction) => {
    const delta = DIRECTION_DELTAS[direction];
    const sectionId = `${preview.sectionStubId}_${direction}`;

    return createPreviewRecord({
      campaignId: snapshot.campaign.id,
      fromSectionId: sectionRecord.id,
      parentSectionId: preview.sectionStubId,
      sectionId,
      direction,
      coordinates: {
        x: previewCoordinates.x + delta.x,
        y: previewCoordinates.y + delta.y,
      },
      worldSeed: snapshot.campaign.worldSeed,
      playerVisibility: 'unknown',
      label: nestedSectionLabelForDirection(direction),
    });
  });

  let dungeonGraph = appendGraphNode(snapshot.campaign.dungeonGraph, preview.sectionStubId);

  for (const previewRecord of newPreviews) {
    dungeonGraph = appendGraphEdge(
      appendGraphNode(dungeonGraph, previewRecord.sectionStubId),
      preview.sectionStubId,
      previewRecord.direction as CardinalDirection,
      previewRecord.sectionStubId
    );
  }

  const nextPreviews = [...remainingPreviews, ...newPreviews];
  const campaign: CampaignWorld = {
    ...snapshot.campaign,
    activeSectionId: preview.sectionStubId,
    dungeonGraph,
    updatedAt: new Date().toISOString(),
  };

  return {
    campaign,
    sections: [...snapshot.sections, sectionRecord],
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
