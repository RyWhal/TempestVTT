import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpenText, Map, Route, Sparkles } from 'lucide-react';
import { Button } from '../shared/Button';
import { useSessionStore } from '../../stores/sessionStore';
import { useProcgenStore } from '../../stores/procgenStore';
import { useMapStore } from '../../stores/mapStore';
import { useMap } from '../../hooks/useMap';
import {
  buildOverviewGraph,
  type CampaignSnapshot,
  createSnapshotFromStore,
  createStarterCampaignSnapshot,
  getOrderedPreviews,
  getOrderedVisitedSections,
  rerollPreviewContent,
  updateCampaignBookEntryStatus,
  visitSectionPreview,
} from '../../procgen/engine/campaignFlow';
import { createGeneratedMapFromSection } from '../../procgen/integration/mapAdapter';
import { resolveLaunchSectionId } from '../../procgen/integration/navigationPolicy';
import type {
  CampaignBookEntryStatus,
  GeneratedCampaignBookEntry,
  GeneratedSection,
  GeneratedSectionContent,
  OverviewNode,
  SectionContentRerollScope,
} from '../../procgen/types';

interface DunGENCampaignViewProps {
  snapshotOverride?: CampaignSnapshot | null;
}

const GRID_STEP = 116;
const NODE_SIZE = 86;

type BookFocus =
  | { kind: 'section'; id: string }
  | { kind: 'preview'; id: string };

type CampaignBookTab =
  | 'narrative'
  | 'npcs'
  | 'creatures'
  | 'encounters'
  | 'shops'
  | 'items'
  | 'hazards'
  | 'hooks';

type SurfaceTab = 'overview' | 'campaign_book';

const CAMPAIGN_BOOK_TAB_LABELS: Record<CampaignBookTab, string> = {
  narrative: 'Narrative',
  npcs: 'NPCs',
  creatures: 'Creatures',
  encounters: 'Encounters',
  shops: 'Shops',
  items: 'Items',
  hazards: 'Hazards',
  hooks: 'Hooks',
};

const ENTRY_TYPE_TO_TAB: Record<GeneratedCampaignBookEntry['type'], CampaignBookTab> = {
  read_aloud_intro: 'narrative',
  area_impression: 'narrative',
  room_scene: 'narrative',
  npc_profile: 'npcs',
  npc_roleplay_note: 'npcs',
  creature_seed: 'creatures',
  encounter_seed: 'encounters',
  shop_seed: 'shops',
  item_seed: 'items',
  hazard_seed: 'hazards',
  hook_seed: 'hooks',
};

const ENTRY_STATUS_LABELS: Record<CampaignBookEntryStatus, string> = {
  suggested: 'Suggested',
  accepted: 'Accepted',
  crossed_out: 'Crossed Out',
  gm_added: 'GM Added',
};

const getEntryStatusClasses = (status: CampaignBookEntryStatus) => {
  switch (status) {
    case 'accepted':
      return 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200';
    case 'crossed_out':
      return 'border-rose-500/30 bg-rose-500/10 text-rose-200';
    case 'gm_added':
      return 'border-tempest-400/40 bg-tempest-500/10 text-tempest-100';
    case 'suggested':
    default:
      return 'border-storm-700 bg-storm-900 text-storm-300';
  }
};

const getEntryPlaceholder = (entry: GeneratedCampaignBookEntry) => {
  switch (entry.type) {
    case 'read_aloud_intro':
      return '[AI Generated intro goes here]';
    case 'area_impression':
    case 'room_scene':
      return '[AI Generated room prose goes here]';
    case 'creature_seed':
      return '[AI Generated creature image/token]';
    case 'npc_profile':
      return '[AI Generated NPC portrait/token]';
    default:
      return null;
  }
};

const getGeneratedSection = (section: {
  generationState: Record<string, unknown>;
}): GeneratedSection | null => {
  const generatedSection = section.generationState.generatedSection;
  return generatedSection && typeof generatedSection === 'object'
    ? (generatedSection as GeneratedSection)
    : null;
};

const getGeneratedContent = (state: Record<string, unknown>): GeneratedSectionContent | null => {
  const generatedContent = state.generatedContent;
  return generatedContent && typeof generatedContent === 'object'
    ? (generatedContent as GeneratedSectionContent)
    : null;
};

const getVisitIndex = (generationState: Record<string, unknown>) => {
  const visitIndex = generationState.visitIndex;
  return typeof visitIndex === 'number' ? visitIndex : 0;
};

const isPreviewAdjacentToSection = (
  preview: { fromSectionId: string | null; previewState: Record<string, unknown> },
  sectionRecordId: string
) => {
  if (preview.fromSectionId === sectionRecordId) {
    return true;
  }

  const adjacentIds = preview.previewState.adjacentFromSectionIds;
  return Array.isArray(adjacentIds) && adjacentIds.includes(sectionRecordId);
};

const getPreviewDirectionForSection = (
  preview: { direction: string | null; previewState: Record<string, unknown> },
  sectionRecordId: string
) => {
  const branchDirections = preview.previewState.branchDirectionsBySectionId;

  if (
    branchDirections &&
    typeof branchDirections === 'object' &&
    !Array.isArray(branchDirections) &&
    typeof (branchDirections as Record<string, unknown>)[sectionRecordId] === 'string'
  ) {
    return String((branchDirections as Record<string, unknown>)[sectionRecordId]);
  }

  return preview.direction ?? 'unknown';
};

const formatList = (values: string[], fallback: string) => {
  const filtered = values.filter(Boolean);
  return filtered.length > 0 ? filtered.join(', ') : fallback;
};

const toSentenceCase = (value: string) =>
  value.length > 0 ? `${value.charAt(0).toUpperCase()}${value.slice(1)}` : value;

export const DunGENCampaignView: React.FC<DunGENCampaignViewProps> = ({ snapshotOverride = null }) => {
  const navigate = useNavigate();
  const session = useSessionStore((state) => state.session);
  const currentUser = useSessionStore((state) => state.currentUser);
  const campaign = useProcgenStore((state) => state.campaign);
  const sectionsById = useProcgenStore((state) => state.sectionsById);
  const sectionPreviewsById = useProcgenStore((state) => state.sectionPreviewsById);
  const activeSectionId = useProcgenStore((state) => state.activeSectionId);
  const hydrateProcgenState = useProcgenStore((state) => state.hydrateProcgenState);
  const setActiveSectionId = useProcgenStore((state) => state.setActiveSectionId);
  const maps = useMapStore((state) => state.maps);
  const activeMap = useMapStore((state) => state.activeMap);
  const setMaps = useMapStore((state) => state.setMaps);
  const setActiveMap = useMapStore((state) => state.setActiveMap);
  const { setMapActive } = useMap();
  const [bookFocus, setBookFocus] = useState<BookFocus | null>(null);
  const [activeBookTab, setActiveBookTab] = useState<CampaignBookTab>('narrative');
  const [activeSurfaceTab, setActiveSurfaceTab] = useState<SurfaceTab>('campaign_book');

  useEffect(() => {
    if (!session || !currentUser || campaign) {
      return;
    }

    const snapshot = createStarterCampaignSnapshot({
      sessionId: session.id,
      campaignName: `${session.name} Campaign`,
      worldSeed: `world_${session.id}`,
    });

    hydrateProcgenState(snapshot);
  }, [session, currentUser, campaign, hydrateProcgenState]);

  const snapshot = useMemo(() => {
    if (snapshotOverride) {
      return snapshotOverride;
    }

    if (!campaign) {
      return null;
    }

    return createSnapshotFromStore({
      campaign,
      sections: Object.values(sectionsById),
      previews: Object.values(sectionPreviewsById),
    });
  }, [campaign, sectionsById, sectionPreviewsById, snapshotOverride]);

  const visitedSections = useMemo(
    () => (snapshot ? getOrderedVisitedSections(snapshot) : []),
    [snapshot]
  );
  const renderedCampaign = snapshot?.campaign ?? campaign;
  const previews = useMemo(
    () => (snapshot ? getOrderedPreviews(snapshot) : []),
    [snapshot]
  );
  const overviewGraph = useMemo(
    () => (snapshot ? buildOverviewGraph(snapshot, 'gm') : { nodes: [], edges: [] }),
    [snapshot]
  );

  const currentTableSectionId =
    activeMap?.sourceType === 'generated' ? activeMap.generatedSectionId : null;
  const resolvedActiveSectionId =
    currentTableSectionId ?? activeSectionId ?? renderedCampaign?.activeSectionId ?? null;
  const activeSection =
    visitedSections.find((section) => section.sectionId === resolvedActiveSectionId) ?? visitedSections[0] ?? null;
  const adjacentPreviews = useMemo(
    () =>
      activeSection
        ? previews.filter((preview) => isPreviewAdjacentToSection(preview, activeSection.id))
        : [],
    [activeSection, previews]
  );

  useEffect(() => {
    if (!activeSection) {
      return;
    }

    setBookFocus((currentFocus) => {
      if (
        currentFocus?.kind === 'preview' &&
        adjacentPreviews.some((preview) => preview.id === currentFocus.id)
      ) {
        return currentFocus;
      }

      return {
        kind: 'section',
        id: activeSection.sectionId,
      };
    });
  }, [activeSection, adjacentPreviews]);

  const focusedPreview =
    bookFocus?.kind === 'preview'
      ? adjacentPreviews.find((preview) => preview.id === bookFocus.id) ??
        previews.find((preview) => preview.id === bookFocus.id) ??
        null
      : null;
  const focusedSection =
    bookFocus?.kind === 'section'
      ? visitedSections.find((section) => section.sectionId === bookFocus.id) ?? activeSection
      : focusedPreview
        ? null
        : activeSection;
  const focusedContent =
    (focusedPreview ? getGeneratedContent(focusedPreview.previewState) : null) ??
    (focusedSection ? getGeneratedContent(focusedSection.generationState) : null);
  const focusedName = focusedPreview
    ? String(focusedPreview.previewState.label ?? focusedPreview.sectionStubId)
    : focusedSection?.name ?? activeSection?.name ?? 'Section';
  const focusedGeneratedSection =
    (focusedPreview?.previewState.generatedSection as GeneratedSection | undefined) ??
    (focusedSection ? getGeneratedSection(focusedSection) ?? undefined : undefined);
  const focusedBook = focusedContent?.campaignBook ?? null;
  const focusedBookEntries = focusedBook?.entries ?? [];
  const groupedBookEntries = useMemo(
    () =>
      focusedBookEntries.reduce<Record<CampaignBookTab, GeneratedCampaignBookEntry[]>>(
        (groups, entry) => {
          groups[ENTRY_TYPE_TO_TAB[entry.type]].push(entry);
          return groups;
        },
        {
          narrative: [],
          npcs: [],
          creatures: [],
          encounters: [],
          shops: [],
          items: [],
          hazards: [],
          hooks: [],
        }
      ),
    [focusedBookEntries]
  );
  const visibleBookEntries = groupedBookEntries[activeBookTab];
  const groupedNpcCards = useMemo(() => {
    if (!focusedBook) {
      return [];
    }

    return focusedBook.persistentNpcs
      .map((npc) => {
        const profileEntry =
          groupedBookEntries.npcs.find(
            (entry) => entry.type === 'npc_profile' && entry.relatedNpcIds.includes(npc.id)
          ) ?? null;
        const roleplayEntries = groupedBookEntries.npcs.filter(
          (entry) => entry.type === 'npc_roleplay_note' && entry.relatedNpcIds.includes(npc.id)
        );
        const appearance = focusedBook.npcAppearances.find((candidate) => candidate.npcId === npc.id) ?? null;

        if (!profileEntry && roleplayEntries.length === 0) {
          return null;
        }

        return {
          npc,
          appearance,
          profileEntry,
          roleplayEntries,
        };
      })
      .filter(
        (
          value
        ): value is {
          npc: NonNullable<(typeof focusedBook.persistentNpcs)[number]>;
          appearance: NonNullable<(typeof focusedBook.npcAppearances)[number]> | null;
          profileEntry: GeneratedCampaignBookEntry | null;
          roleplayEntries: GeneratedCampaignBookEntry[];
        } => value !== null
      );
  }, [focusedBook, groupedBookEntries]);
  const focusedBiome = focusedContent?.biomeName ?? focusedGeneratedSection?.primaryBiomeId ?? 'unknown';
  const focusedLayout = focusedGeneratedSection?.layoutType ?? focusedSection?.layoutType ?? 'unknown';
  const focusedRoomCount = focusedGeneratedSection?.rooms.length ?? focusedSection?.roomIds.length ?? 0;

  const graphBounds = overviewGraph.nodes.reduce(
    (bounds, node) => ({
      minX: Math.min(bounds.minX, node.x),
      maxX: Math.max(bounds.maxX, node.x),
      minY: Math.min(bounds.minY, node.y),
      maxY: Math.max(bounds.maxY, node.y),
    }),
    { minX: 0, maxX: 0, minY: 0, maxY: 0 }
  );

  const graphWidth = (graphBounds.maxX - graphBounds.minX + 1) * GRID_STEP + NODE_SIZE;
  const graphHeight = (graphBounds.maxY - graphBounds.minY + 1) * GRID_STEP + NODE_SIZE;

  const getNodePosition = (node: OverviewNode) => ({
    left: (node.x - graphBounds.minX) * GRID_STEP + 24,
    top: (node.y - graphBounds.minY) * GRID_STEP + 24,
  });

  const handleVisitPreview = (previewId: string) => {
    if (!snapshot) {
      return;
    }

    const nextSnapshot = visitSectionPreview(snapshot, previewId, activeSection?.id ?? null);
    hydrateProcgenState(nextSnapshot);
    const visitedPreview = nextSnapshot.sections[nextSnapshot.sections.length - 1];
    if (visitedPreview) {
      setBookFocus({
        kind: 'section',
        id: visitedPreview.sectionId,
      });
    }
  };

  const handlePreviewFocus = (previewId: string) => {
    setBookFocus({
      kind: 'preview',
      id: previewId,
    });
  };

  const handleRerollPreviewScope = (scope: SectionContentRerollScope) => {
    if (!snapshot || !focusedPreview) {
      return;
    }

    const nextSnapshot = rerollPreviewContent(snapshot, focusedPreview.id, scope);
    hydrateProcgenState(nextSnapshot);
    setBookFocus({
      kind: 'preview',
      id: focusedPreview.id,
    });
  };

  const handleCampaignBookEntryStatus = (
    entryId: string,
    status: CampaignBookEntryStatus
  ) => {
    if (!snapshot || !bookFocus) {
      return;
    }

    const nextSnapshot = updateCampaignBookEntryStatus(snapshot, bookFocus, entryId, status);
    hydrateProcgenState(nextSnapshot);
  };

  const handleCampaignBookEntriesStatus = (
    entryIds: string[],
    status: CampaignBookEntryStatus
  ) => {
    if (!snapshot || !bookFocus || entryIds.length === 0) {
      return;
    }

    const nextSnapshot = entryIds.reduce(
      (currentSnapshot, entryId) =>
        updateCampaignBookEntryStatus(currentSnapshot, bookFocus, entryId, status),
      snapshot
    );
    hydrateProcgenState(nextSnapshot);
  };

  const handleLaunchToPlay = () => {
    if (!session || visitedSections.length === 0) {
      return;
    }

    const launchSectionId = resolveLaunchSectionId({
      activeSectionId: activeSection?.sectionId ?? activeSectionId ?? null,
    });

    const generatedMaps = visitedSections
      .map((section) => {
        const generatedSection = getGeneratedSection(section);

        if (!generatedSection) {
          return null;
        }

        return createGeneratedMapFromSection({
          mapId: `generated:${section.sectionId}`,
          sessionId: session.id,
          section: generatedSection,
          name: section.name,
        });
      })
      .filter((map): map is NonNullable<typeof map> => map !== null)
      .map((map, index) => ({ ...map, sortOrder: index }));

    const preservedMaps = maps.filter((map) => map.sourceType !== 'generated');
    const nextMaps = [
      ...preservedMaps,
      ...generatedMaps.filter(
        (generatedMap) => !preservedMaps.some((existingMap) => existingMap.id === generatedMap.id)
      ),
    ];

    setMaps(nextMaps);

    const nextActiveMap =
      generatedMaps.find((map) => map.generatedSectionId === launchSectionId) ??
      generatedMaps[0] ??
      null;

    setActiveMap(nextActiveMap);
    navigate('/play');
  };

  if (!snapshot || !renderedCampaign || !activeSection) {
    return (
      <div className="space-y-4 rounded-3xl border border-storm-800 bg-storm-900 p-6">
        <h1 className="text-3xl font-semibold">DunGEN Campaign Surface</h1>
        <p className="max-w-2xl text-sm text-storm-300">
          {session && currentUser
            ? 'Preparing DunGEN campaign surface...'
            : 'Join or create a table session first. This thin first flow uses your current session shell to preview the campaign and launch generated sections into play.'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 rounded-3xl border border-storm-800 bg-storm-900 p-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-storm-700 bg-storm-950 px-3 py-1 text-xs uppercase tracking-[0.22em] text-storm-400">
            <Sparkles className="h-4 w-4" />
            DunGEN Campaign
          </div>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">{renderedCampaign.name}</h1>
            <p className="mt-2 max-w-3xl text-sm text-storm-300">
              Root village at visit index <strong>0</strong>, with GM read-ahead previews on
              every outward branch. Visited sections keep their tab index on revisit, and the
              campaign book stays available for both current and preview content.
            </p>
          </div>
        </div>

        <div className="flex gap-3">
          <Button variant="secondary" onClick={() => navigate('/DunGEN')}>
            Back
          </Button>
          <Button variant="primary" onClick={handleLaunchToPlay} disabled={!session || !currentUser}>
            Launch To Play
          </Button>
        </div>
      </header>

      <section className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-storm-300">
          <Map className="h-4 w-4" />
          Visited Sections
        </div>
        <div className="flex flex-wrap gap-3">
          {visitedSections.map((section) => {
            const visitIndex = getVisitIndex(section.generationState);
            const isActive = section.sectionId === activeSection.sectionId;

            return (
              <button
                key={section.id}
                onClick={async () => {
                  setActiveSectionId(section.sectionId);
                  const generatedMap = maps.find(
                    (map) => map.sourceType === 'generated' && map.generatedSectionId === section.sectionId
                  );

                  if (generatedMap) {
                    await setMapActive(generatedMap.id);
                  }

                  setBookFocus({
                    kind: 'section',
                    id: section.sectionId,
                  });
                }}
                className={`rounded-2xl border px-4 py-3 text-left transition-colors ${
                  isActive
                    ? 'border-tempest-400 bg-tempest-500/10 text-tempest-100'
                    : 'border-storm-800 bg-storm-900 text-storm-300 hover:border-storm-700 hover:bg-storm-850'
                }`}
              >
                <div className="text-xs uppercase tracking-[0.2em] text-storm-500">
                  Index {visitIndex}
                </div>
                <div className="mt-1 text-sm font-medium">{section.name}</div>
              </button>
            );
          })}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setActiveSurfaceTab('overview')}
            className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
              activeSurfaceTab === 'overview'
                ? 'border-tempest-400 bg-tempest-500/15 text-tempest-100'
                : 'border-storm-800 bg-storm-900 text-storm-400 hover:border-storm-700 hover:text-storm-200'
            }`}
          >
            Overview
          </button>
          <button
            type="button"
            onClick={() => setActiveSurfaceTab('campaign_book')}
            className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
              activeSurfaceTab === 'campaign_book'
                ? 'border-tempest-400 bg-tempest-500/15 text-tempest-100'
                : 'border-storm-800 bg-storm-900 text-storm-400 hover:border-storm-700 hover:text-storm-200'
            }`}
          >
            Campaign Book
          </button>
        </div>
      </section>

      {activeSurfaceTab === 'overview' ? (
        <section className="rounded-3xl border border-storm-800 bg-storm-900 p-5">
          <div className="mb-4 flex items-center gap-2 text-sm font-medium text-storm-300">
            <Route className="h-4 w-4" />
            Overview
          </div>

          <div className="overflow-x-auto">
            <div
              className="relative rounded-2xl border border-storm-850 bg-storm-950"
              style={{ width: `${graphWidth + 48}px`, height: `${graphHeight + 48}px` }}
            >
              <svg className="absolute inset-0 h-full w-full" aria-hidden="true">
                {overviewGraph.edges.map((edge) => {
                  const fromNode = overviewGraph.nodes.find(
                    (node) => node.sectionId === edge.fromSectionId
                  );
                  const toNode = overviewGraph.nodes.find(
                    (node) => node.sectionId === edge.toSectionId
                  );

                  if (!fromNode || !toNode) {
                    return null;
                  }

                  const fromPosition = getNodePosition(fromNode);
                  const toPosition = getNodePosition(toNode);

                  return (
                    <line
                      key={edge.id}
                      x1={fromPosition.left + NODE_SIZE / 2}
                      y1={fromPosition.top + NODE_SIZE / 2}
                      x2={toPosition.left + NODE_SIZE / 2}
                      y2={toPosition.top + NODE_SIZE / 2}
                      stroke={edge.state === 'preview' ? 'rgba(160,174,192,0.35)' : 'rgba(98,194,255,0.45)'}
                      strokeWidth="3"
                      strokeDasharray={edge.state === 'preview' ? '8 6' : undefined}
                    />
                  );
                })}
              </svg>

              {overviewGraph.nodes.map((node) => {
                const position = getNodePosition(node);
                const isActive = node.sectionId === activeSection.sectionId;

                return (
                  <div
                    key={node.sectionId}
                    className={`absolute flex h-[${NODE_SIZE}px] w-[${NODE_SIZE}px] flex-col items-center justify-center rounded-2xl border text-center shadow-sm`}
                    style={{
                      width: `${NODE_SIZE}px`,
                      height: `${NODE_SIZE}px`,
                      left: `${position.left}px`,
                      top: `${position.top}px`,
                      borderColor: isActive
                        ? 'rgba(98,194,255,0.85)'
                        : node.state === 'preview'
                          ? 'rgba(88,102,126,0.9)'
                          : node.state === 'known_unvisited'
                            ? 'rgba(120,132,150,0.8)'
                            : 'rgba(68,196,140,0.8)',
                      background:
                        node.state === 'preview'
                          ? 'rgba(31,41,55,0.7)'
                          : node.state === 'known_unvisited'
                            ? 'rgba(63,73,89,0.9)'
                            : isActive
                              ? 'rgba(33,94,161,0.35)'
                              : 'rgba(17,67,57,0.88)',
                    }}
                  >
                    <div className="px-2 text-[11px] uppercase tracking-[0.18em] text-storm-400">
                      {node.state === 'visited' ? `#${node.visitIndex ?? 0}` : node.state.replace('_', ' ')}
                    </div>
                    <div className="px-2 text-sm font-medium text-storm-100">{node.label}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      ) : null}

      {activeSurfaceTab === 'campaign_book' ? (
        <section className="space-y-6">
          <div className="rounded-3xl border border-storm-800 bg-storm-900 p-5">
            <div className="mb-4 flex items-center gap-2 text-sm font-medium text-storm-300">
              <BookOpenText className="h-4 w-4" />
              Campaign Book
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border border-storm-850 bg-storm-950 p-4">
                <div className="text-xs uppercase tracking-[0.22em] text-storm-500">
                  {focusedPreview ? 'Preview Entry' : 'Visited Entry'}
                </div>
                <h2 className="mt-2 text-xl font-semibold text-storm-50">{focusedName}</h2>
                <p className="mt-2 text-sm text-storm-300">
                  Biome: <strong>{focusedBiome}</strong> · Layout: <strong>{focusedLayout}</strong> · Rooms:{' '}
                  <strong>{focusedRoomCount}</strong>
                </p>
                <p className="mt-2 text-sm text-storm-400">
                  {focusedContent?.summary ?? 'Generated section summary will appear here.'}
                </p>
                {focusedContent?.settlementArchetypeName ? (
                  <p className="mt-2 text-xs uppercase tracking-[0.18em] text-storm-500">
                    Settlement Profile · {focusedContent.settlementArchetypeName}
                  </p>
                ) : null}
                {focusedPreview ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button size="sm" variant="secondary" onClick={() => handleRerollPreviewScope('all')}>
                      Reroll All
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => handleRerollPreviewScope('creatures')}>
                      Reroll Creatures
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => handleRerollPreviewScope('encounters')}>
                      Reroll Encounters
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => handleRerollPreviewScope('shops')}>
                      Reroll Shops
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => handleRerollPreviewScope('rumors')}>
                      Reroll Rumors
                    </Button>
                    <Button size="sm" variant="primary" onClick={() => handleVisitPreview(focusedPreview.id)}>
                      Visit Preview
                    </Button>
                  </div>
                ) : (
                  <p className="mt-4 text-xs text-storm-500">
                    Locked-section rerolls can come later through explicit GM override flow.
                  </p>
                )}
              </div>

              <div className="rounded-2xl border border-storm-850 bg-storm-950 p-4">
                <div className="text-xs uppercase tracking-[0.22em] text-storm-500">
                  Table Of Contents
                </div>
                <div className="mt-3 space-y-3">
                  {visitedSections.map((section) => (
                    <button
                      key={section.id}
                      type="button"
                      onClick={() =>
                        setBookFocus({
                          kind: 'section',
                          id: section.sectionId,
                        })
                      }
                      className="w-full rounded-xl border border-storm-900 bg-storm-925 p-3 text-left"
                    >
                      <div className="text-sm font-medium text-storm-100">{section.name}</div>
                      <div className="mt-1 text-xs text-storm-400">
                        Visit index {getVisitIndex(section.generationState)} · {section.primaryBiomeId} ·{' '}
                        {section.roomIds.length} rooms
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-storm-850 bg-storm-950 p-4">
                <div className="text-xs uppercase tracking-[0.22em] text-storm-500">
                  Upcoming Previews
                </div>
                <div className="mt-3 space-y-3">
                  {adjacentPreviews.map((preview) => (
                    <div key={preview.id} className="rounded-xl border border-storm-900 bg-storm-925 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-medium text-storm-100">
                            {String(preview.previewState.label ?? preview.sectionStubId)}
                          </div>
                          <div className="mt-1 text-xs uppercase tracking-[0.18em] text-storm-500">
                            {getPreviewDirectionForSection(preview, activeSection?.id ?? '')} branch
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" variant="secondary" onClick={() => handlePreviewFocus(preview.id)}>
                            Preview
                          </Button>
                          <Button size="sm" variant="secondary" onClick={() => handleVisitPreview(preview.id)}>
                            Visit
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {adjacentPreviews.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-storm-800 bg-storm-925 p-3 text-sm text-storm-500">
                      No adjacent previews from the current active section.
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="rounded-2xl border border-storm-850 bg-storm-950 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs uppercase tracking-[0.22em] text-storm-500">
                      Campaign Entries
                    </div>
                    <div className="mt-2 text-sm text-storm-300">
                      Biome <span className="font-medium text-storm-100">{focusedBiome}</span> · Tone{' '}
                      <span className="font-medium text-storm-100">{focusedContent?.tone ?? 'Unknown'}</span>
                    </div>
                  </div>
                  <div className="text-xs text-storm-500">
                    {focusedBookEntries.length} entr{focusedBookEntries.length === 1 ? 'y' : 'ies'}
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {(Object.keys(CAMPAIGN_BOOK_TAB_LABELS) as CampaignBookTab[]).map((tab) => {
                    const count = groupedBookEntries[tab].length;
                    return (
                      <button
                        key={tab}
                        type="button"
                        onClick={() => setActiveBookTab(tab)}
                        className={`rounded-full border px-3 py-1.5 text-xs uppercase tracking-[0.16em] transition-colors ${
                          activeBookTab === tab
                            ? 'border-tempest-400 bg-tempest-500/15 text-tempest-100'
                            : 'border-storm-800 bg-storm-925 text-storm-400 hover:border-storm-700 hover:text-storm-200'
                        }`}
                      >
                        {CAMPAIGN_BOOK_TAB_LABELS[tab]} · {count}
                      </button>
                    );
                  })}
                </div>

                <div className="mt-4 space-y-3">
                  {activeBookTab === 'npcs' && groupedNpcCards.length > 0 ? (
                    groupedNpcCards.map(({ npc, appearance, profileEntry, roleplayEntries }) => {
                      const entryIds = [
                        ...(profileEntry ? [profileEntry.id] : []),
                        ...roleplayEntries.map((entry) => entry.id),
                      ];
                      const representativeStatus =
                        profileEntry?.status ?? roleplayEntries[0]?.status ?? 'suggested';
                      const placeholder = '[AI Generated NPC portrait/token]';
                      const dossierLines = [
                        {
                          label: 'Backstory',
                          value: npc.baselineBackstory,
                        },
                        {
                          label: 'Appearance',
                          value: npc.appearanceSummary,
                        },
                        {
                          label: 'Voice',
                          value: `Sounds ${npc.voice}.`,
                        },
                        {
                          label: 'Mannerisms',
                          value: formatList(
                            npc.mannerisms.map((mannerism) => toSentenceCase(mannerism)),
                            'No clear mannerisms yet.'
                          ),
                        },
                        {
                          label: 'Wants',
                          value: appearance?.wantsFromPlayers
                            ? toSentenceCase(appearance.wantsFromPlayers)
                            : toSentenceCase(npc.motivations[0] ?? 'Keep control of the situation'),
                        },
                        {
                          label: 'Needs',
                          value: appearance?.needs[0]
                            ? toSentenceCase(appearance.needs[0])
                            : 'A reason to trust the party.',
                        },
                        {
                          label: 'Secret',
                          value: npc.secrets[0] ? toSentenceCase(npc.secrets[0]) : 'No private angle yet.',
                        },
                        {
                          label: 'Knows',
                          value: appearance?.knows[0]
                            ? toSentenceCase(appearance.knows[0])
                            : toSentenceCase(npc.rumorKnowledge[0] ?? 'More than they first admit'),
                        },
                        {
                          label: 'Offers',
                          value: appearance?.offers[0]
                            ? toSentenceCase(appearance.offers[0])
                            : 'Practical local help.',
                        },
                        {
                          label: 'Roleplay',
                          value: appearance?.framing
                            ? toSentenceCase(appearance.framing)
                            : 'Play them as careful and observant.',
                        },
                        {
                          label: 'Current pressure',
                          value: appearance?.roleInSection
                            ? toSentenceCase(appearance.roleInSection)
                            : 'Watching local trouble closely.',
                        },
                      ];

                      return (
                        <article
                          key={npc.id}
                          className={`rounded-xl border p-4 ${getEntryStatusClasses(representativeStatus)}`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="text-sm font-medium text-storm-50">
                                {npc.name}
                                {npc.roleName ? `, ${npc.roleName}` : ''}
                              </div>
                              {profileEntry?.summary ? (
                                <div className="mt-1 text-xs uppercase tracking-[0.14em] text-storm-400">
                                  {profileEntry.summary}
                                </div>
                              ) : null}
                            </div>
                            <div className="rounded-full border border-current/30 px-2 py-1 text-[10px] uppercase tracking-[0.18em]">
                              {ENTRY_STATUS_LABELS[representativeStatus]}
                            </div>
                          </div>

                          <ul
                            className={`mt-3 space-y-2 text-sm leading-6 ${
                              representativeStatus === 'crossed_out'
                                ? 'text-storm-500 line-through'
                                : 'text-storm-200'
                            }`}
                          >
                            {dossierLines.map((line) => (
                              <li key={`${npc.id}:${line.label}`} className="flex gap-2">
                                <span className="text-storm-500">•</span>
                                <span>
                                  <span className="font-medium text-storm-100">{line.label}:</span>{' '}
                                  {line.value}
                                </span>
                              </li>
                            ))}
                          </ul>

                          <div className="mt-3 rounded-lg border border-dashed border-storm-700/70 bg-storm-950/60 px-3 py-2 text-xs uppercase tracking-[0.18em] text-storm-500">
                            {placeholder}
                          </div>

                          <div className="mt-3 flex flex-wrap gap-2">
                            {[
                              'npc',
                              'profile',
                              ...(npc.roleId ? [npc.roleId] : []),
                              ...(appearance ? ['roleplay'] : []),
                            ].map((tag) => (
                              <span
                                key={`${npc.id}:${tag}`}
                                className="rounded-full border border-storm-800 bg-storm-950/70 px-2 py-1 text-[10px] uppercase tracking-[0.16em] text-storm-500"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>

                          <div className="mt-4 flex flex-wrap gap-2">
                            <Button
                              size="sm"
                              variant={representativeStatus === 'accepted' ? 'primary' : 'secondary'}
                              onClick={() => handleCampaignBookEntriesStatus(entryIds, 'accepted')}
                            >
                              Accept
                            </Button>
                            <Button
                              size="sm"
                              variant={representativeStatus === 'crossed_out' ? 'danger' : 'secondary'}
                              onClick={() => handleCampaignBookEntriesStatus(entryIds, 'crossed_out')}
                            >
                              Cross Out
                            </Button>
                            {representativeStatus !== 'suggested' ? (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleCampaignBookEntriesStatus(entryIds, 'suggested')}
                              >
                                Reset
                              </Button>
                            ) : null}
                          </div>
                        </article>
                      );
                    })
                  ) : visibleBookEntries.length > 0 ? (
                    visibleBookEntries.map((entry) => {
                      const placeholder = getEntryPlaceholder(entry);
                      const isCrossedOut = entry.status === 'crossed_out';

                      return (
                        <article
                          key={entry.id}
                          className={`rounded-xl border p-4 ${getEntryStatusClasses(entry.status)}`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="text-sm font-medium text-storm-50">{entry.title}</div>
                              {entry.summary ? (
                                <div className="mt-1 text-xs uppercase tracking-[0.14em] text-storm-400">
                                  {entry.summary}
                                </div>
                              ) : null}
                            </div>
                            <div className="rounded-full border border-current/30 px-2 py-1 text-[10px] uppercase tracking-[0.18em]">
                              {ENTRY_STATUS_LABELS[entry.status]}
                            </div>
                          </div>

                          <p
                            className={`mt-3 text-sm leading-6 ${
                              isCrossedOut ? 'text-storm-500 line-through' : 'text-storm-200'
                            }`}
                          >
                            {entry.body}
                          </p>

                          {placeholder ? (
                            <div className="mt-3 rounded-lg border border-dashed border-storm-700/70 bg-storm-950/60 px-3 py-2 text-xs uppercase tracking-[0.18em] text-storm-500">
                              {placeholder}
                            </div>
                          ) : null}

                          {entry.tags.length > 0 ? (
                            <div className="mt-3 flex flex-wrap gap-2">
                              {entry.tags.map((tag) => (
                                <span
                                  key={`${entry.id}:${tag}`}
                                  className="rounded-full border border-storm-800 bg-storm-950/70 px-2 py-1 text-[10px] uppercase tracking-[0.16em] text-storm-500"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          ) : null}

                          <div className="mt-4 flex flex-wrap gap-2">
                            <Button
                              size="sm"
                              variant={entry.status === 'accepted' ? 'primary' : 'secondary'}
                              onClick={() => handleCampaignBookEntryStatus(entry.id, 'accepted')}
                            >
                              Accept
                            </Button>
                            <Button
                              size="sm"
                              variant={entry.status === 'crossed_out' ? 'danger' : 'secondary'}
                              onClick={() => handleCampaignBookEntryStatus(entry.id, 'crossed_out')}
                            >
                              Cross Out
                            </Button>
                            {entry.status !== 'suggested' ? (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleCampaignBookEntryStatus(entry.id, 'suggested')}
                              >
                                Reset
                              </Button>
                            ) : null}
                          </div>
                        </article>
                      );
                    })
                  ) : (
                    <div className="rounded-xl border border-dashed border-storm-800 bg-storm-925 p-4 text-sm text-storm-500">
                      No {CAMPAIGN_BOOK_TAB_LABELS[activeBookTab].toLowerCase()} entries generated for this section yet.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
};
