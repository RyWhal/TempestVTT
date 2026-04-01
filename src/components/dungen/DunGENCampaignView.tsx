import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpenText, Map, Route, Sparkles } from 'lucide-react';
import { Button } from '../shared/Button';
import { Input } from '../shared/Input';
import { useToast } from '../shared/Toast';
import { useSessionStore } from '../../stores/sessionStore';
import { useProcgenStore } from '../../stores/procgenStore';
import { useMapStore } from '../../stores/mapStore';
import { useMap } from '../../hooks/useMap';
import {
  persistCampaignSnapshotBySession,
  useProcgenCampaign,
} from '../../hooks/useProcgenCampaign';
import { useSession } from '../../hooks/useSession';
import { getMapBakeContentSignature, loadMapBakeContent } from '../../procgen/bake/AssetRegistryLoader';
import { ensureSectionsHaveCurrentBakedFloors } from '../../procgen/integration/bakeReadiness';
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
import { resolveLaunchSectionId } from '../../procgen/integration/navigationPolicy';
import { saveLocalCampaignSnapshot } from '../../procgen/integration/localCampaignPersistence';
import { contentRegistry } from '../../procgen/content/contentRegistry';
import { resolveDisplayedBiomeName } from './biomeDisplay';
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

const GRID_STEP_X = 196;
const GRID_STEP_Y = 118;
const NODE_WIDTH = 148;
const NODE_WIDTH_WIDE = 184;
const NODE_WIDTH_MAX = 220;
const NODE_HEIGHT = 82;

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

const formatList = (values: string[], fallback: string) => {
  const filtered = values.filter(Boolean);
  return filtered.length > 0 ? filtered.join(', ') : fallback;
};
const asString = (value: unknown, fallback = '') =>
  typeof value === 'string' ? value : fallback;
const asStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];

const toSentenceCase = (value: string) =>
  value.length > 0 ? `${value.charAt(0).toUpperCase()}${value.slice(1)}` : value;

const humanizeId = (value: string) => value.split('_').join(' ');
const uniqueValues = (values: string[]) => [...new Set(values.filter(Boolean))];
const CURRENT_BAKE_CONTENT_SIGNATURE = getMapBakeContentSignature(loadMapBakeContent());
const isMissingProcgenRelationError = (message: string) =>
  message.includes('42P01') ||
  message.toLowerCase().includes('does not exist') ||
  message.includes('procgen_campaigns') ||
  message.includes('procgen_sections') ||
  message.includes('procgen_section_previews');
const getProcgenPersistenceUnavailableMessage = (errorMessage: string) =>
  isMissingProcgenRelationError(errorMessage)
    ? 'Supabase procgen tables are unavailable, so Endless Dungeon is using browser-local state for this session.'
    : 'Supabase procgen persistence is unavailable, so Endless Dungeon is using browser-local state for this session.';

const createDraftCampaignSnapshot = (campaignName: string) =>
  createStarterCampaignSnapshot({
    sessionId: 'draft_session',
    campaignName,
    worldSeed: 'world_endless_dungeon_draft',
  });

const humanizeOverviewLabel = (value: string) =>
  value
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim();
const splitOverviewLabel = (value: string) => {
  const normalized = humanizeOverviewLabel(value);
  const words = normalized.split(' ').filter(Boolean);

  if (words.length <= 1) {
    return [normalized];
  }

  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= 13 || current.length === 0) {
      current = next;
      continue;
    }

    lines.push(current);
    current = word;
  }

  if (current) {
    lines.push(current);
  }

  if (lines.length <= 2) {
    return lines;
  }

  const firstLine = lines[0];
  const secondLine = lines.slice(1).join(' ');

  if (secondLine.length <= 16) {
    return [firstLine, secondLine];
  }

  return [normalized];
};

const getOverviewNodeWidth = (value: string) => {
  const labelLines = splitOverviewLabel(value);
  const longestLineLength = labelLines.reduce(
    (longest, line) => Math.max(longest, line.length),
    0
  );

  if (longestLineLength <= 9) {
    return NODE_WIDTH;
  }

  const computedWidth = NODE_WIDTH + (longestLineLength - 9) * 8;
  return Math.max(NODE_WIDTH_WIDE, Math.min(NODE_WIDTH_MAX, computedWidth));
};
const formatAbilitySummary = (abilities: {
  str: number;
  dex: number;
  con: number;
  int: number;
  wis: number;
  cha: number;
}) =>
  [
    ['STR', abilities.str],
    ['DEX', abilities.dex],
    ['CON', abilities.con],
    ['INT', abilities.int],
    ['WIS', abilities.wis],
    ['CHA', abilities.cha],
  ] as const;

export const DunGENCampaignView: React.FC<DunGENCampaignViewProps> = ({ snapshotOverride = null }) => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const session = useSessionStore((state) => state.session);
  const currentUser = useSessionStore((state) => state.currentUser);
  const setSession = useSessionStore((state) => state.setSession);
  const setCurrentUser = useSessionStore((state) => state.setCurrentUser);
  const campaign = useProcgenStore((state) => state.campaign);
  const hydrateProcgenState = useProcgenStore((state) => state.hydrateProcgenState);
  const sectionsById = useProcgenStore((state) => state.sectionsById);
  const sectionPreviewsById = useProcgenStore((state) => state.sectionPreviewsById);
  const activeSectionId = useProcgenStore((state) => state.activeSectionId);
  const maps = useMapStore((state) => state.maps);
  const activeMap = useMapStore((state) => state.activeMap);
  const { setMapActive } = useMap();
  const { createSession, syncGeneratedSessionState } = useSession();
  const { bakeSectionFloorCache, loadCampaignBySession } = useProcgenCampaign();
  const [bookFocus, setBookFocus] = useState<BookFocus | null>(null);
  const [activeBookTab, setActiveBookTab] = useState<CampaignBookTab>('narrative');
  const [activeSurfaceTab, setActiveSurfaceTab] = useState<SurfaceTab>('campaign_book');
  const [isLaunchingToPlay, setIsLaunchingToPlay] = useState(false);
  const [draftCampaignName, setDraftCampaignName] = useState('Endless Dungeon Campaign');
  const [draftGmName, setDraftGmName] = useState(() => currentUser?.username ?? '');
  const [draftSnapshot, setDraftSnapshot] = useState<CampaignSnapshot | null>(() =>
    createDraftCampaignSnapshot('Endless Dungeon Campaign')
  );
  const [lastUsableSnapshot, setLastUsableSnapshot] = useState<CampaignSnapshot | null>(() =>
    createDraftCampaignSnapshot('Endless Dungeon Campaign')
  );
  const snapshotPersistenceQueueRef = useRef<Promise<boolean>>(Promise.resolve(true));

  useEffect(() => {
    if (!currentUser?.username || draftGmName.length > 0) {
      return;
    }

    setDraftGmName(currentUser.username);
  }, [currentUser?.username, draftGmName]);

  useEffect(() => {
    if (!draftSnapshot || snapshotOverride || campaign) {
      return;
    }

    const nextCampaignName = draftCampaignName.trim() || 'Endless Dungeon Campaign';
    if (draftSnapshot.campaign.name === nextCampaignName) {
      return;
    }

    setDraftSnapshot({
      ...draftSnapshot,
      campaign: {
        ...draftSnapshot.campaign,
        name: nextCampaignName,
        updatedAt: new Date().toISOString(),
      },
    });
  }, [campaign, draftCampaignName, draftSnapshot, snapshotOverride]);

  const storeBackedSnapshot = useMemo(() => {
    if (!campaign) {
      return null;
    }

    const sections = Object.values(sectionsById);
    if (sections.length === 0) {
      return null;
    }

    return createSnapshotFromStore({
      campaign,
      sections,
      previews: Object.values(sectionPreviewsById),
    });
  }, [campaign, sectionsById, sectionPreviewsById]);

  const snapshot = useMemo(() => {
    if (snapshotOverride) {
      return snapshotOverride;
    }

    return storeBackedSnapshot ?? draftSnapshot ?? lastUsableSnapshot;
  }, [draftSnapshot, lastUsableSnapshot, snapshotOverride, storeBackedSnapshot]);

  useEffect(() => {
    if (!snapshot) {
      return;
    }

    if (getOrderedVisitedSections(snapshot).length === 0) {
      return;
    }

    setLastUsableSnapshot(snapshot);
  }, [snapshot]);

  const isLinkedCampaignSession =
    Boolean(campaign && session?.id && campaign.sessionId === session.id);
  const usesDraftSnapshot = !snapshotOverride && !campaign && draftSnapshot !== null;

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
    isLinkedCampaignSession && activeMap?.sourceType === 'generated'
      ? activeMap.generatedSectionId
      : null;
  const resolvedActiveSectionId =
    activeSectionId ?? currentTableSectionId ?? renderedCampaign?.activeSectionId ?? null;
  const activeSection =
    visitedSections.find((section) => section.sectionId === resolvedActiveSectionId) ?? visitedSections[0] ?? null;
  const linkedSessionName = campaign?.sessionId === session?.id ? session?.name ?? null : null;
  const linkedJoinCode = campaign?.sessionId === session?.id ? session?.code ?? null : null;
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
  const groupedCreatureCards = useMemo(() => {
    if (!focusedContent) {
      return [];
    }

    return focusedContent.creatures
      .map((creature) => {
        const entry =
          groupedBookEntries.creatures.find(
            (candidate) =>
              candidate.type === 'creature_seed' && candidate.relatedCreatureIds.includes(creature.id)
          ) ?? null;

        if (!entry) {
          return null;
        }

        return { creature, entry };
      })
      .filter(
        (
          value
        ): value is {
          creature: NonNullable<(typeof focusedContent.creatures)[number]>;
          entry: GeneratedCampaignBookEntry;
        } => value !== null
      );
  }, [focusedContent, groupedBookEntries]);
  const groupedEncounterCards = useMemo(() => {
    if (!focusedContent) {
      return [];
    }

    return focusedContent.encounters
      .map((encounter) => {
        const entry =
          groupedBookEntries.encounters.find(
            (candidate) => candidate.type === 'encounter_seed' && candidate.title === encounter.title
          ) ?? null;

        if (!entry) {
          return null;
        }

        return { encounter, entry };
      })
      .filter(
        (
          value
        ): value is {
          encounter: NonNullable<(typeof focusedContent.encounters)[number]>;
          entry: GeneratedCampaignBookEntry;
        } => value !== null
      );
  }, [focusedContent, groupedBookEntries]);
  const groupedShopCards = useMemo(() => {
    if (!focusedContent) {
      return [];
    }

    return focusedContent.shops
      .map((shop) => {
        const entry =
          groupedBookEntries.shops.find(
            (candidate) => candidate.type === 'shop_seed' && candidate.relatedShopIds.includes(shop.id)
          ) ?? null;

        if (!entry) {
          return null;
        }

        return { shop, entry };
      })
      .filter(
        (
          value
        ): value is {
          shop: NonNullable<(typeof focusedContent.shops)[number]>;
          entry: GeneratedCampaignBookEntry;
        } => value !== null
      );
  }, [focusedContent, groupedBookEntries]);
  const groupedHazardCards = useMemo(() => {
    if (!focusedContent) {
      return [];
    }

    return focusedContent.hazards
      .map((hazard) => {
        const entry =
          groupedBookEntries.hazards.find(
            (candidate) => candidate.type === 'hazard_seed' && candidate.title === hazard.name
          ) ?? null;

        if (!entry) {
          return null;
        }

        return { hazard, entry };
      })
      .filter(
        (
          value
        ): value is {
          hazard: NonNullable<(typeof focusedContent.hazards)[number]>;
          entry: GeneratedCampaignBookEntry;
        } => value !== null
      );
  }, [focusedContent, groupedBookEntries]);
  const groupedHookCards = useMemo(() => {
    if (!focusedContent) {
      return [];
    }

    return focusedContent.hooks
      .map((hook) => {
        const entry =
          groupedBookEntries.hooks.find(
            (candidate) => candidate.type === 'hook_seed' && candidate.title === hook.title
          ) ?? null;

        if (!entry) {
          return null;
        }

        return { hook, entry };
      })
      .filter(
        (
          value
        ): value is {
          hook: NonNullable<(typeof focusedContent.hooks)[number]>;
          entry: GeneratedCampaignBookEntry;
        } => value !== null
      );
  }, [focusedContent, groupedBookEntries]);
  const groupedItemCards = useMemo(() => {
    const itemTemplates = contentRegistry.loadPack('item_tables').itemTemplates;
    const itemTemplateByName = new globalThis.Map(
      itemTemplates.map((item) => [String(item.name), item] as const)
    );
    const itemEntries = groupedBookEntries.items.filter((entry) => entry.type === 'item_seed');

    return itemEntries.map((entry) => {
      const template =
        itemTemplateByName.get(entry.title) ??
        itemTemplates.find((candidate) => String(candidate.id) === entry.title) ??
        null;

      return { entry, template };
    });
  }, [groupedBookEntries]);
  const biomeNamesById = useMemo(
    () =>
      new globalThis.Map(
        contentRegistry
          .loadPack('biomes')
          .biomes.map((biome) => [biome.id, biome.name ?? biome.id] as const)
      ),
    []
  );
  const focusedBiome = resolveDisplayedBiomeName({
    biomeId: focusedGeneratedSection?.primaryBiomeId ?? focusedSection?.primaryBiomeId ?? null,
    contentBiomeName: focusedContent?.biomeName ?? null,
    biomeNamesById,
  });
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

  const widestNodeWidth = overviewGraph.nodes.reduce(
    (widest, node) => Math.max(widest, getOverviewNodeWidth(node.label)),
    NODE_WIDTH
  );
  const graphWidth = (graphBounds.maxX - graphBounds.minX + 1) * GRID_STEP_X + widestNodeWidth;
  const graphHeight = (graphBounds.maxY - graphBounds.minY + 1) * GRID_STEP_Y + NODE_HEIGHT;

  const getNodePosition = (node: OverviewNode) => ({
    left: (node.x - graphBounds.minX) * GRID_STEP_X + 24,
    top: (node.y - graphBounds.minY) * GRID_STEP_Y + 24,
  });

  const adjacentPreviewSectionIds = useMemo(
    () => new Set(adjacentPreviews.map((preview) => preview.sectionStubId)),
    [adjacentPreviews]
  );
  const adjacentPreviewBySectionId = useMemo(
    () => new globalThis.Map(adjacentPreviews.map((preview) => [preview.sectionStubId, preview.id])),
    [adjacentPreviews]
  );

  const persistAndReloadCampaign = async (
    nextSnapshot: CampaignSnapshot,
    targetSessionId: string
  ) => {
    saveLocalCampaignSnapshot({
      sessionId: targetSessionId,
      snapshot: nextSnapshot,
    });

    const persistenceResult = await persistCampaignSnapshotBySession({
      sessionId: targetSessionId,
      snapshot: nextSnapshot,
    });

    if (!persistenceResult.success) {
      hydrateProcgenState(nextSnapshot);
      showToast(getProcgenPersistenceUnavailableMessage(persistenceResult.error), 'success');
      return true;
    }

    const loadedCampaign = await loadCampaignBySession(targetSessionId);
    if (!loadedCampaign) {
      showToast('Failed to reload Endless Dungeon campaign state.', 'error');
      return false;
    }

    setDraftSnapshot(null);
    return true;
  };

  const applySnapshot = async (nextSnapshot: CampaignSnapshot) => {
    if (usesDraftSnapshot) {
      setDraftSnapshot(nextSnapshot);
      return true;
    }

    hydrateProcgenState(nextSnapshot);

    if (!isLinkedCampaignSession || !session?.id) {
      return true;
    }

    const queuedPersistence = snapshotPersistenceQueueRef.current
      .catch(() => true)
      .then(() => persistAndReloadCampaign(nextSnapshot, session.id));

    snapshotPersistenceQueueRef.current = queuedPersistence;
    return queuedPersistence;
  };

  const handleSelectVisitedSection = async (sectionId: string) => {
    if (snapshot) {
      const nextSnapshot = {
        ...snapshot,
        campaign: {
          ...snapshot.campaign,
          activeSectionId: sectionId,
          updatedAt: new Date().toISOString(),
        },
      };
      void applySnapshot(nextSnapshot);
    }

    const generatedMap =
      isLinkedCampaignSession
        ? maps.find((map) => map.sourceType === 'generated' && map.generatedSectionId === sectionId) ?? null
        : null;

    if (generatedMap) {
      await setMapActive(generatedMap.id);
    }

    setBookFocus({
      kind: 'section',
      id: sectionId,
    });
  };

  const handleVisitPreview = (previewId: string) => {
    if (!snapshot) {
      return;
    }

    const nextSnapshot = visitSectionPreview(snapshot, previewId, activeSection?.id ?? null);
    void applySnapshot(nextSnapshot);
    setActiveSurfaceTab('campaign_book');
    const visitedPreview = nextSnapshot.sections[nextSnapshot.sections.length - 1];
    if (visitedPreview) {
      setBookFocus({
        kind: 'section',
        id: visitedPreview.sectionId,
      });
    }
  };

  const handlePreviewFocus = (previewId: string) => {
    setActiveSurfaceTab('campaign_book');
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
    void applySnapshot(nextSnapshot);
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
    void applySnapshot(nextSnapshot);
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
    void applySnapshot(nextSnapshot);
  };

  const handleLaunchToPlay = () => {
    if (!snapshot || visitedSections.length === 0) {
      return;
    }

    const isCreatingLinkedSession = !isLinkedCampaignSession;
    const initialPlayUrl = isCreatingLinkedSession ? '/play?launching=1' : '/play';
    const pendingPlayWindow =
      typeof window !== 'undefined'
        ? window.open(initialPlayUrl, '_blank')
        : null;

    const buildGeneratedMaps = async () => {
      setIsLaunchingToPlay(true);
      try {
        let targetSession = isLinkedCampaignSession ? session : null;
        let targetUser = isLinkedCampaignSession ? currentUser : null;
        let playWindowUrl = initialPlayUrl;
        const nextCampaignName = draftCampaignName.trim() || renderedCampaign?.name || 'Endless Dungeon Campaign';

        if (!targetSession || !targetUser) {
          const trimmedGmName = draftGmName.trim();
          if (!nextCampaignName || !trimmedGmName) {
            pendingPlayWindow?.close();
            showToast('Campaign Name and GM Name are required before launch.', 'error');
            return;
          }

          const createResult = await createSession(nextCampaignName, trimmedGmName, {
            activateSession: false,
          });
          if (!createResult.success) {
            pendingPlayWindow?.close();
            showToast(createResult.error || 'Failed to create session for Endless Dungeon.', 'error');
            return;
          }

          targetSession = createResult.session ?? null;
          targetUser = createResult.currentUser ?? null;

          if (!targetSession || !targetUser) {
            pendingPlayWindow?.close();
            showToast('Session creation completed without session state.', 'error');
            return;
          }
        }

        const bakedSections = await ensureSectionsHaveCurrentBakedFloors({
          sections: visitedSections,
          expectedContentSignature: CURRENT_BAKE_CONTENT_SIGNATURE,
          bakeSectionFloorCache,
        });

        const nextSnapshot: CampaignSnapshot = {
          ...snapshot,
          campaign: {
            ...snapshot.campaign,
            sessionId: targetSession.id,
            name: nextCampaignName,
            activeSectionId:
              resolveLaunchSectionId({
                activeSectionId:
                  currentTableSectionId ??
                  activeSection?.sectionId ??
                  activeSectionId ??
                  renderedCampaign?.activeSectionId ??
                  null,
              }) ?? snapshot.campaign.activeSectionId,
            updatedAt: new Date().toISOString(),
          },
          sections: bakedSections,
        };

        const persisted = await persistAndReloadCampaign(nextSnapshot, targetSession.id);
        if (!persisted) {
          pendingPlayWindow?.close();
          return;
        }

        if (!isLinkedCampaignSession) {
          setSession(targetSession);
          setCurrentUser(targetUser);
        }

        if (isCreatingLinkedSession) {
          playWindowUrl = `/play?autojoin=1&code=${encodeURIComponent(
            targetSession.code
          )}&username=${encodeURIComponent(targetUser.username)}`;
        } else {
          playWindowUrl = '/play';
        }

        if (pendingPlayWindow && !pendingPlayWindow.closed) {
          pendingPlayWindow.location.replace(playWindowUrl);
        } else if (typeof window !== 'undefined') {
          window.open(playWindowUrl, '_blank');
        }

        void syncGeneratedSessionState(targetSession.id);
        showToast(`Endless Dungeon launched. Code: ${targetSession.code}`, 'success');
      } catch (error) {
        pendingPlayWindow?.close();
        console.error('Launch To Play failed', error);
        showToast('Failed to launch Endless Dungeon into Tempest Table.', 'error');
      } finally {
        setIsLaunchingToPlay(false);
      }
    };

    void buildGeneratedMaps();
  };

  if (!snapshot || !renderedCampaign || !activeSection) {
    return (
      <div className="tempest-panel space-y-4 p-6">
        <div className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-950 px-3 py-1 text-xs uppercase tracking-[0.22em] text-tempest-300">
          <Sparkles className="h-4 w-4" />
          Endless Dungeon
        </div>
        <h1 className="text-3xl font-semibold text-slate-100">Endless Dungeon Campaign Surface</h1>
        <p className="max-w-2xl text-sm text-slate-400">
          {session && currentUser
            ? 'Preparing Endless Dungeon campaign surface...'
            : 'Endless Dungeon setup is moving to a standalone campaign flow. For now, you can still launch generated sections into Tempest Table from here.'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {!isLinkedCampaignSession ? (
        <section className="tempest-panel space-y-4 p-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-950 px-3 py-1 text-xs uppercase tracking-[0.22em] text-tempest-300">
            <Sparkles className="h-4 w-4" />
            Endless Dungeon
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold text-slate-100">Prepare your campaign launch</h2>
            <p className="max-w-3xl text-sm text-slate-400">
              Build the campaign here first. When you launch, Endless Dungeon will create a
              Tempest Table session, generate a join code, and open the live table in a second tab.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Input
              label="Campaign Name"
              value={draftCampaignName}
              onChange={(event) => setDraftCampaignName(event.target.value)}
              placeholder="e.g., The Bloom Beneath"
            />
            <Input
              label="GM Name"
              value={draftGmName}
              onChange={(event) => setDraftGmName(event.target.value)}
              placeholder="e.g., GameMaster"
            />
          </div>
          <div className="flex flex-wrap gap-3">
            <Button variant="primary" onClick={handleLaunchToPlay} disabled={isLaunchingToPlay}>
              {isLaunchingToPlay ? 'Launching…' : 'Launch Into Tempest Table'}
            </Button>
            <Button variant="secondary" onClick={() => navigate('/play')}>
              Tempest Table Hub
            </Button>
          </div>
        </section>
      ) : (
        <section className="tempest-panel space-y-4 p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-950 px-3 py-1 text-xs uppercase tracking-[0.22em] text-tempest-300">
                <Sparkles className="h-4 w-4" />
                Live Tempest Link
              </div>
              <h2 className="text-2xl font-semibold text-slate-100">{linkedSessionName}</h2>
              <p className="text-sm text-slate-400">
                GM: <strong>{currentUser?.username ?? draftGmName}</strong> · Join Code:{' '}
                <strong>{linkedJoinCode ?? 'Pending'}</strong>
              </p>
            </div>
            <div className="flex gap-3">
              <Button variant="secondary" onClick={handleLaunchToPlay} disabled={isLaunchingToPlay}>
                {isLaunchingToPlay ? 'Opening…' : 'Open Live Table'}
              </Button>
              <Button variant="ghost" onClick={() => navigate('/play')}>
                Go To /play
              </Button>
            </div>
          </div>
        </section>
      )}

      {isLinkedCampaignSession ? (
        <header className="tempest-panel flex flex-col gap-4 p-6">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-950 px-3 py-1 text-xs uppercase tracking-[0.22em] text-tempest-300">
              <Sparkles className="h-4 w-4" />
              Endless Dungeon
            </div>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-slate-100">{renderedCampaign.name}</h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-400">
                Root village at visit index <strong>0</strong>, with GM read-ahead previews on
                every outward branch. Visited sections keep their tab index on revisit, and the
                campaign book stays available for both current and preview content.
              </p>
            </div>
          </div>
        </header>
      ) : null}

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
                onClick={() => void handleSelectVisitedSection(section.sectionId)}
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

      <section>
        <div className="relative z-10 -mb-px">
          <div className="flex items-end gap-1">
            <button
              type="button"
              onClick={() => setActiveSurfaceTab('overview')}
              className={`relative rounded-t-2xl rounded-b-none border px-6 py-3 text-base font-medium transition-all ${
                activeSurfaceTab === 'overview'
                  ? '-mb-px border-storm-700 border-b-storm-900 bg-storm-900 text-tempest-100 shadow-[0_-8px_24px_rgba(5,15,30,0.18)]'
                  : 'border-storm-800 bg-storm-925 text-storm-400 hover:border-storm-700 hover:bg-storm-900 hover:text-storm-200'
              }`}
            >
              Overview
            </button>
            <button
              type="button"
              onClick={() => setActiveSurfaceTab('campaign_book')}
              className={`relative rounded-t-2xl rounded-b-none border px-6 py-3 text-base font-medium transition-all ${
                activeSurfaceTab === 'campaign_book'
                  ? '-mb-px border-storm-700 border-b-storm-900 bg-storm-900 text-tempest-100 shadow-[0_-8px_24px_rgba(5,15,30,0.18)]'
                  : 'border-storm-800 bg-storm-925 text-storm-400 hover:border-storm-700 hover:bg-storm-900 hover:text-storm-200'
              }`}
            >
              Campaign Book
            </button>
          </div>
        </div>

      {activeSurfaceTab === 'overview' ? (
          <section className="rounded-b-3xl rounded-tr-3xl rounded-tl-none border border-storm-800 bg-storm-900 p-5">
            <div className="mb-4 flex items-center gap-2 text-sm font-medium text-storm-300">
              <Route className="h-4 w-4" />
              Overview
            </div>

            <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-storm-400">
              <span className="uppercase tracking-[0.18em] text-storm-500">Key</span>
              <span className="inline-flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-sm bg-emerald-700" />
                Current location
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-sm bg-sky-800" />
                Previously visited
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-sm bg-slate-600" />
                Adjacent preview
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-sm bg-slate-900" />
                Inaccessible preview
              </span>
            </div>

            <div className="overflow-x-auto">
              <div className="min-w-full" style={{ minHeight: `${graphHeight + 48}px` }}>
                <div
                  className="relative mx-auto rounded-2xl border border-storm-850 bg-storm-950"
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
                    const fromNodeWidth = getOverviewNodeWidth(fromNode.label);
                    const toNodeWidth = getOverviewNodeWidth(toNode.label);

                    return (
                      <line
                        key={edge.id}
                        x1={fromPosition.left + fromNodeWidth / 2}
                        y1={fromPosition.top + NODE_HEIGHT / 2}
                        x2={toPosition.left + toNodeWidth / 2}
                        y2={toPosition.top + NODE_HEIGHT / 2}
                        stroke={edge.state === 'preview' ? 'rgba(120,132,150,0.32)' : 'rgba(98,194,255,0.3)'}
                        strokeWidth="2.5"
                        strokeDasharray={edge.state === 'preview' ? '8 6' : undefined}
                      />
                    );
                  })}
                  </svg>

                  {overviewGraph.nodes.map((node) => {
                    const position = getNodePosition(node);
                    const nodeWidth = getOverviewNodeWidth(node.label);
                    const isCurrent = node.sectionId === activeSection.sectionId;
                    const isVisited = node.state === 'visited' && !isCurrent;
                    const isAdjacentPreview = adjacentPreviewSectionIds.has(node.sectionId);
                    const isPreview = node.state !== 'visited';
                    const isDimmedPreview = isPreview && !isAdjacentPreview;
                    const isClickablePreview = isAdjacentPreview;

                    let nodeBorder = 'rgba(88,102,126,0.95)';
                    let nodeBackground = 'rgba(15,23,42,1)';
                    if (isCurrent) {
                      nodeBorder = 'rgba(34,197,94,0.95)';
                      nodeBackground = 'rgba(18,84,63,1)';
                    } else if (isVisited) {
                      nodeBorder = 'rgba(96,165,250,0.95)';
                      nodeBackground = 'rgba(20,62,117,1)';
                    } else if (isClickablePreview) {
                      nodeBorder = 'rgba(148,163,184,0.95)';
                      nodeBackground = 'rgba(51,65,85,1)';
                    } else if (isDimmedPreview) {
                      nodeBorder = 'rgba(71,85,105,0.95)';
                      nodeBackground = 'rgba(15,23,42,1)';
                    }

                    const labelLines = splitOverviewLabel(node.label);
                    const hasWrappedLabel = labelLines.length > 1;
                    const longestLabelLine = Math.max(...labelLines.map((line) => line.length));
                    const nodeBadge = isCurrent
                      ? 'Current'
                      : isVisited
                        ? `Visited #${node.visitIndex ?? 0}`
                        : isClickablePreview
                          ? 'Preview'
                          : null;

                    const handleNodeClick = () => {
                      if (isCurrent || isVisited) {
                        void handleSelectVisitedSection(node.sectionId);
                        return;
                      }
                      if (isClickablePreview) {
                        const previewId = adjacentPreviewBySectionId.get(node.sectionId);
                        if (previewId) {
                          handlePreviewFocus(previewId);
                        }
                      }
                    };

                    return (
                      <button
                        key={node.sectionId}
                        type="button"
                        onClick={handleNodeClick}
                        disabled={isDimmedPreview}
                        className={`absolute flex flex-col justify-center rounded-xl border px-3 text-left shadow-sm transition-all ${
                          isDimmedPreview
                            ? 'cursor-default'
                            : 'hover:-translate-y-0.5 hover:shadow-[0_8px_18px_rgba(5,15,30,0.24)]'
                        } ${isClickablePreview || isVisited || isCurrent ? 'cursor-pointer' : ''}`}
                        style={{
                          width: `${nodeWidth}px`,
                          height: `${NODE_HEIGHT}px`,
                          left: `${position.left}px`,
                          top: `${position.top}px`,
                          borderColor: nodeBorder,
                          background: nodeBackground,
                        }}
                      >
                        {nodeBadge ? (
                          <div className="text-[10px] uppercase tracking-[0.18em] text-storm-300">
                            {nodeBadge}
                          </div>
                        ) : null}
                        <div
                          className={`font-bold leading-tight text-storm-50 ${
                            hasWrappedLabel
                              ? nodeBadge
                                ? 'mt-1 text-[0.98rem]'
                                : 'text-[1rem]'
                              : longestLabelLine > 12
                                ? nodeBadge
                                  ? 'mt-1 text-[0.95rem]'
                                  : 'text-[0.98rem]'
                                : nodeBadge
                                  ? 'mt-1 text-[1rem]'
                                  : 'text-[1.05rem]'
                          }`}
                        >
                          {labelLines.map((line, index) => (
                            <div key={`${node.sectionId}:label:${index}`}>{line}</div>
                          ))}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>
      ) : null}

      {activeSurfaceTab === 'campaign_book' ? (
        <section className="space-y-6 rounded-b-3xl rounded-tr-3xl rounded-tl-none border border-storm-800 bg-storm-900 p-5">
            <div className="mb-4 flex items-center gap-2 text-sm font-medium text-storm-300">
              <BookOpenText className="h-4 w-4" />
              Campaign Book
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border border-storm-850 bg-storm-950 p-4">
                <div className="text-xs uppercase tracking-[0.22em] text-storm-500">
                  Table Of Contents
                </div>
                <div className="mt-3 max-h-56 space-y-2 overflow-y-auto pr-1">
                  {visitedSections.map((section) => (
                    (() => {
                      const isFocused =
                        bookFocus?.kind === 'section'
                          ? bookFocus.id === section.sectionId
                          : activeSection.sectionId === section.sectionId;

                      return (
                    <button
                      key={section.id}
                      type="button"
                      onClick={() =>
                        setBookFocus({
                          kind: 'section',
                          id: section.sectionId,
                        })
                      }
                      className={`w-full rounded-xl border px-3 py-2 text-left transition-colors ${
                        isFocused
                          ? 'border-tempest-500/50 bg-tempest-500/10'
                          : 'border-storm-900 bg-storm-925 hover:border-storm-700 hover:bg-storm-900'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-base font-bold text-storm-100">
                            {section.name}
                          </div>
                          <div className="mt-0.5 text-[11px] text-storm-400">
                            Index {getVisitIndex(section.generationState)} · {section.primaryBiomeId} ·{' '}
                            {section.roomIds.length} rooms
                          </div>
                        </div>
                        {isFocused ? (
                          <div className="shrink-0 rounded-full border border-tempest-500/40 bg-tempest-500/10 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-tempest-200">
                            Open
                          </div>
                        ) : null}
                      </div>
                    </button>
                      );
                    })()
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-storm-850 bg-storm-950 p-4">
                <div className="text-xs uppercase tracking-[0.22em] text-storm-500">
                  {focusedPreview ? 'Preview Entry' : 'Visited Entry'}
                </div>
                <h2 className="mt-2 text-2xl font-bold text-storm-50">{focusedName}</h2>
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

              <div>
                <div className="relative z-10 -mb-px">
                  <div className="flex items-end gap-1">
                    {(Object.keys(CAMPAIGN_BOOK_TAB_LABELS) as CampaignBookTab[]).map((tab) => {
                      return (
                        <button
                          key={tab}
                          type="button"
                          onClick={() => setActiveBookTab(tab)}
                          className={`relative rounded-t-2xl rounded-b-none border px-5 py-3 text-sm font-medium uppercase tracking-[0.16em] transition-all ${
                            activeBookTab === tab
                              ? '-mb-px border-storm-700 border-b-storm-950 bg-storm-950 text-tempest-100 shadow-[0_-8px_24px_rgba(5,15,30,0.18)]'
                              : 'border-storm-800 bg-storm-925 text-storm-400 hover:border-storm-700 hover:bg-storm-900 hover:text-storm-200'
                          }`}
                        >
                          {CAMPAIGN_BOOK_TAB_LABELS[tab]}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="rounded-b-2xl rounded-t-none border border-storm-850 bg-storm-950 p-4">
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
                      const roleplayNotes = [
                        appearance?.framing ? toSentenceCase(appearance.framing) : '',
                        appearance?.roleInSection ? toSentenceCase(appearance.roleInSection) : '',
                      ].filter(Boolean);
                      const detailSections = [
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
                          label: 'Equipment',
                          value: formatList(npc.equipment.map(toSentenceCase), 'No gear noted.'),
                        },
                        {
                          label: 'Roleplay notes',
                          value:
                            roleplayNotes.length > 0
                              ? roleplayNotes.join(' ')
                              : 'Play them as careful and observant.',
                        },
                      ];
                      const combatStats = [
                        { label: 'AC', value: String(npc.resolvedStats.ac) },
                        { label: 'HP', value: String(npc.resolvedStats.hp) },
                        { label: 'Speed', value: String(npc.resolvedStats.speed) },
                        { label: 'PB', value: `+${npc.resolvedStats.proficiencyBonus}` },
                      ];
                      const abilityStats = formatAbilitySummary(npc.resolvedStats.abilities);
                      const actions =
                        npc.actions.length > 0
                          ? npc.actions.map(
                              (action) =>
                                `${action.name}: ${typeof action.damage === 'string' ? action.damage : action.name}`
                            )
                          : [];

                      return (
                        <article
                          key={npc.id}
                          className={`rounded-xl border p-4 ${getEntryStatusClasses(representativeStatus)}`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="text-2xl font-bold tracking-tight text-storm-50">
                                {npc.name}
                                {npc.roleName ? `, ${npc.roleName}` : ''}
                              </div>
                            </div>
                            <div className="rounded-full border border-current/30 px-2 py-1 text-[10px] uppercase tracking-[0.18em]">
                              {ENTRY_STATUS_LABELS[representativeStatus]}
                            </div>
                          </div>

                          <div className="mt-3 grid gap-2 sm:grid-cols-4">
                            {combatStats.map((stat) => (
                              <div
                                key={`${npc.id}:combat:${stat.label}`}
                                className="rounded-lg border border-storm-800 bg-storm-950/50 px-3 py-2"
                              >
                                <div className="text-[10px] uppercase tracking-[0.18em] text-storm-500">
                                  {stat.label}
                                </div>
                                <div className="mt-1 text-base font-medium text-storm-50">{stat.value}</div>
                              </div>
                            ))}
                          </div>

                          <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
                            {abilityStats.map(([label, value]) => (
                              <div
                                key={`${npc.id}:ability:${label}`}
                                className="rounded-lg border border-storm-800 bg-storm-950/50 px-2 py-2 text-center"
                              >
                                <div className="text-[10px] uppercase tracking-[0.18em] text-storm-500">
                                  {label}
                                </div>
                                <div className="mt-1 text-sm font-medium text-storm-50">{value}</div>
                              </div>
                            ))}
                          </div>

                          <div className="mt-3 grid gap-3 lg:grid-cols-2">
                            {detailSections.map((line) => (
                              <div
                                key={`${npc.id}:${line.label}`}
                                className={`rounded-lg border border-storm-800 bg-storm-950/40 px-3 py-2 text-sm leading-6 ${
                                  representativeStatus === 'crossed_out'
                                    ? 'text-storm-500 line-through'
                                    : 'text-storm-200'
                                }`}
                              >
                                <div className="text-[10px] uppercase tracking-[0.18em] text-storm-500">
                                  {line.label}
                                </div>
                                <div className="mt-1">{line.value}</div>
                              </div>
                            ))}
                            <div
                              className={`rounded-lg border border-storm-800 bg-storm-950/40 px-3 py-2 text-sm leading-6 ${
                                representativeStatus === 'crossed_out'
                                  ? 'text-storm-500 line-through'
                                  : 'text-storm-200'
                              }`}
                            >
                              <div className="text-[10px] uppercase tracking-[0.18em] text-storm-500">
                                Skills
                              </div>
                              <div className="mt-1">
                                {formatList(npc.resolvedStats.skills, 'No standout skills noted.')}
                              </div>
                            </div>
                            {actions.length > 0 ? (
                              <div
                                className={`rounded-lg border border-storm-800 bg-storm-950/40 px-3 py-2 text-sm leading-6 ${
                                  representativeStatus === 'crossed_out'
                                    ? 'text-storm-500 line-through'
                                    : 'text-storm-200'
                                }`}
                              >
                                <div className="text-[10px] uppercase tracking-[0.18em] text-storm-500">
                                  Actions
                                </div>
                                <div className="mt-1">{formatList(actions, 'No actions recorded.')}</div>
                              </div>
                            ) : null}
                          </div>

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
                  ) : activeBookTab === 'creatures' && groupedCreatureCards.length > 0 ? (
                    groupedCreatureCards.map(({ creature, entry }) => {
                      const placeholder = '[AI Generated creature image/token]';
                      const combatStats = [
                        { label: 'AC', value: String(creature.resolvedStats.ac) },
                        { label: 'HP', value: String(creature.resolvedStats.hp) },
                        { label: 'Speed', value: String(creature.resolvedStats.speed) },
                        { label: 'CR', value: String(creature.resolvedStats.cr) },
                      ];
                      const abilityStats = formatAbilitySummary(creature.resolvedStats.abilities);
                      const behaviorNotes = uniqueValues([
                        toSentenceCase(creature.temperament),
                        ...creature.behaviorAdjustments.map((value) => toSentenceCase(humanizeId(value))),
                      ]);
                      const specialTraits = uniqueValues(
                        creature.traits.filter(
                          (trait) =>
                            !creature.behaviorAdjustments.some(
                              (behavior) => humanizeId(behavior).toLowerCase() === trait.toLowerCase()
                            )
                        )
                      );
                      const detailSections = [
                        {
                          label: 'Size',
                          value: toSentenceCase(creature.sizeClass),
                        },
                        {
                          label: 'Appearance',
                          value: formatList(
                            creature.visualKeywords.map(toSentenceCase),
                            'No visible details noted.'
                          ),
                        },
                        {
                          label: 'Behavior',
                          value: formatList(behaviorNotes, 'No unusual behavior adjustments noted.'),
                        },
                        {
                          label: 'Special traits',
                          value: formatList(specialTraits.map(toSentenceCase), 'No standout traits noted.'),
                        },
                        {
                          label: 'Actions',
                          value:
                            creature.actions.length > 0
                              ? formatList(
                                  creature.actions.map((action) => `${action.name}: ${action.summary}`),
                                  'No actions recorded.'
                                )
                              : 'No actions recorded.',
                        },
                        {
                          label: 'Possible salvage',
                          value: formatList(creature.lootTags.map(toSentenceCase), 'No obvious salvage.'),
                        },
                      ];

                      return (
                        <article
                          key={creature.id}
                          className={`rounded-xl border p-4 ${getEntryStatusClasses(entry.status)}`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="text-2xl font-bold tracking-tight text-storm-50">
                                {creature.name}
                              </div>
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

                          <div className="mt-3 grid gap-2 sm:grid-cols-4">
                            {combatStats.map((stat) => (
                              <div
                                key={`${creature.id}:combat:${stat.label}`}
                                className="rounded-lg border border-storm-800 bg-storm-950/50 px-3 py-2"
                              >
                                <div className="text-[10px] uppercase tracking-[0.18em] text-storm-500">
                                  {stat.label}
                                </div>
                                <div className="mt-1 text-base font-medium text-storm-50">{stat.value}</div>
                              </div>
                            ))}
                          </div>

                          <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
                            {abilityStats.map(([label, value]) => (
                              <div
                                key={`${creature.id}:ability:${label}`}
                                className="rounded-lg border border-storm-800 bg-storm-950/50 px-2 py-2 text-center"
                              >
                                <div className="text-[10px] uppercase tracking-[0.18em] text-storm-500">
                                  {label}
                                </div>
                                <div className="mt-1 text-sm font-medium text-storm-50">{value}</div>
                              </div>
                            ))}
                          </div>

                          <div className="mt-3 grid gap-3 lg:grid-cols-2">
                            {detailSections.map((line) => (
                              <div
                                key={`${creature.id}:${line.label}`}
                                className={`rounded-lg border border-storm-800 bg-storm-950/40 px-3 py-2 text-sm leading-6 ${
                                  entry.status === 'crossed_out'
                                    ? 'text-storm-500 line-through'
                                    : 'text-storm-200'
                                }`}
                              >
                                <div className="text-[10px] uppercase tracking-[0.18em] text-storm-500">
                                  {line.label}
                                </div>
                                <div className="mt-1">{line.value}</div>
                              </div>
                            ))}
                          </div>

                          <div className="mt-3 rounded-lg border border-dashed border-storm-700/70 bg-storm-950/60 px-3 py-2 text-xs uppercase tracking-[0.18em] text-storm-500">
                            {placeholder}
                          </div>

                          <div className="mt-3 flex flex-wrap gap-2">
                            {uniqueValues(['creature', creature.familyId, creature.role, ...creature.variantIds]).map(
                              (tag) => (
                                <span
                                  key={`${creature.id}:${tag}`}
                                  className="rounded-full border border-storm-800 bg-storm-950/70 px-2 py-1 text-[10px] uppercase tracking-[0.16em] text-storm-500"
                                >
                                  {tag}
                                </span>
                              )
                            )}
                          </div>

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
                  ) : activeBookTab === 'encounters' && groupedEncounterCards.length > 0 ? (
                    groupedEncounterCards.map(({ encounter, entry }) => {
                      const detailSections = [
                        { label: 'Type', value: toSentenceCase(encounter.threatLevel) },
                        { label: 'Situation', value: encounter.summary },
                        { label: 'GM framing', value: encounter.detail },
                        {
                          label: 'Possible participants',
                          value: formatList(
                            entry.relatedCreatureIds
                              .map((creatureId) =>
                                focusedContent?.creatures.find((creature) => creature.id === creatureId)?.name ?? ''
                              )
                              .filter(Boolean),
                            'Use locals, hazards, or nearby creatures as needed.'
                          ),
                        },
                      ];

                      return (
                        <article
                          key={encounter.id}
                          className={`rounded-xl border p-4 ${getEntryStatusClasses(entry.status)}`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="text-2xl font-bold tracking-tight text-storm-50">
                                {encounter.title}
                              </div>
                              <div className="mt-1 text-xs uppercase tracking-[0.14em] text-storm-400">
                                {encounter.threatLevel} pressure
                              </div>
                            </div>
                            <div className="rounded-full border border-current/30 px-2 py-1 text-[10px] uppercase tracking-[0.18em]">
                              {ENTRY_STATUS_LABELS[entry.status]}
                            </div>
                          </div>

                          <div className="mt-3 grid gap-3 lg:grid-cols-2">
                            {detailSections.map((line) => (
                              <div
                                key={`${encounter.id}:${line.label}`}
                                className={`rounded-lg border border-storm-800 bg-storm-950/40 px-3 py-2 text-sm leading-6 ${
                                  entry.status === 'crossed_out'
                                    ? 'text-storm-500 line-through'
                                    : 'text-storm-200'
                                }`}
                              >
                                <div className="text-[10px] uppercase tracking-[0.18em] text-storm-500">
                                  {line.label}
                                </div>
                                <div className="mt-1">{line.value}</div>
                              </div>
                            ))}
                          </div>

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
                  ) : activeBookTab === 'shops' && groupedShopCards.length > 0 ? (
                    groupedShopCards.map(({ shop, entry }) => {
                      const detailSections = [
                        { label: 'Keeper', value: shop.ownerName },
                        {
                          label: 'Services',
                          value: formatList(shop.services.map(toSentenceCase), 'No services noted.'),
                        },
                        {
                          label: 'Featured stock',
                          value: formatList(shop.featuredStock, 'No standout stock noted.'),
                        },
                        { label: 'Description', value: shop.description },
                        { label: 'Current pressure', value: shop.pressure },
                      ];

                      return (
                        <article
                          key={shop.id}
                          className={`rounded-xl border p-4 ${getEntryStatusClasses(entry.status)}`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="text-2xl font-bold tracking-tight text-storm-50">
                                {shop.name}
                              </div>
                              <div className="mt-1 text-xs uppercase tracking-[0.14em] text-storm-400">
                                shop · {humanizeId(shop.shopTypeId)}
                              </div>
                            </div>
                            <div className="rounded-full border border-current/30 px-2 py-1 text-[10px] uppercase tracking-[0.18em]">
                              {ENTRY_STATUS_LABELS[entry.status]}
                            </div>
                          </div>

                          <div className="mt-3 grid gap-3 lg:grid-cols-2">
                            {detailSections.map((line) => (
                              <div
                                key={`${shop.id}:${line.label}`}
                                className={`rounded-lg border border-storm-800 bg-storm-950/40 px-3 py-2 text-sm leading-6 ${
                                  entry.status === 'crossed_out'
                                    ? 'text-storm-500 line-through'
                                    : 'text-storm-200'
                                }`}
                              >
                                <div className="text-[10px] uppercase tracking-[0.18em] text-storm-500">
                                  {line.label}
                                </div>
                                <div className="mt-1">{line.value}</div>
                              </div>
                            ))}
                          </div>

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
                  ) : activeBookTab === 'items' && groupedItemCards.length > 0 ? (
                    groupedItemCards.map(({ entry, template }) => {
                      const templateRecord = template as Record<string, unknown> | null;
                      const detailSections = [
                        {
                          label: 'Category',
                          value: templateRecord
                            ? `${humanizeId(String(templateRecord.category_id ?? 'unknown'))} · ${humanizeId(
                                String(templateRecord.subcategory_id ?? 'unknown')
                              )}`
                            : 'Flexible item seed',
                        },
                        {
                          label: 'Rarity',
                          value: templateRecord ? humanizeId(String(templateRecord.rarity ?? 'standard')) : 'Unknown',
                        },
                        {
                          label: 'Value',
                          value: templateRecord
                            ? `${String(templateRecord.base_value ?? '?')} · ${humanizeId(
                                String(templateRecord.value_scale ?? 'common')
                              )}`
                            : 'Use table judgment',
                        },
                        {
                          label: 'Description',
                          value: templateRecord
                            ? String(templateRecord.description ?? entry.body)
                            : entry.body,
                        },
                        {
                          label: 'Trade tags',
                          value: templateRecord
                            ? formatList(asStringArray(templateRecord.trade_tags).map(toSentenceCase), 'No trade tags.')
                            : 'No trade tags.',
                        },
                        {
                          label: 'Usage notes',
                          value: templateRecord
                            ? toSentenceCase(
                                asString(templateRecord.usage_notes) ||
                                  asString(templateRecord.magic_effect_summary) ||
                                  'Flexible clue, bargaining chip, or local curiosity.'
                              )
                            : entry.summary ?? 'Flexible clue, bargaining chip, or local curiosity.',
                        },
                      ];

                      return (
                        <article
                          key={entry.id}
                          className={`rounded-xl border p-4 ${getEntryStatusClasses(entry.status)}`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="text-2xl font-bold tracking-tight text-storm-50">
                                {entry.title}
                              </div>
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

                          <div className="mt-3 grid gap-3 lg:grid-cols-2">
                            {detailSections.map((line) => (
                              <div
                                key={`${entry.id}:${line.label}`}
                                className={`rounded-lg border border-storm-800 bg-storm-950/40 px-3 py-2 text-sm leading-6 ${
                                  entry.status === 'crossed_out'
                                    ? 'text-storm-500 line-through'
                                    : 'text-storm-200'
                                }`}
                              >
                                <div className="text-[10px] uppercase tracking-[0.18em] text-storm-500">
                                  {line.label}
                                </div>
                                <div className="mt-1">{line.value}</div>
                              </div>
                            ))}
                          </div>

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
                  ) : activeBookTab === 'hazards' && groupedHazardCards.length > 0 ? (
                    groupedHazardCards.map(({ hazard, entry }) => (
                      <article
                        key={hazard.id}
                        className={`rounded-xl border p-4 ${getEntryStatusClasses(entry.status)}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-2xl font-bold tracking-tight text-storm-50">{hazard.name}</div>
                            <div className="mt-1 text-xs uppercase tracking-[0.14em] text-storm-400">
                              route pressure
                            </div>
                          </div>
                          <div className="rounded-full border border-current/30 px-2 py-1 text-[10px] uppercase tracking-[0.18em]">
                            {ENTRY_STATUS_LABELS[entry.status]}
                          </div>
                        </div>

                        <div className="mt-3 grid gap-3 lg:grid-cols-2">
                          {[
                            { label: 'Summary', value: hazard.summary },
                            { label: 'GM use', value: entry.body },
                          ].map((line) => (
                            <div
                              key={`${hazard.id}:${line.label}`}
                              className={`rounded-lg border border-storm-800 bg-storm-950/40 px-3 py-2 text-sm leading-6 ${
                                entry.status === 'crossed_out'
                                  ? 'text-storm-500 line-through'
                                  : 'text-storm-200'
                              }`}
                            >
                              <div className="text-[10px] uppercase tracking-[0.18em] text-storm-500">
                                {line.label}
                              </div>
                              <div className="mt-1">{line.value}</div>
                            </div>
                          ))}
                        </div>

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
                    ))
                  ) : activeBookTab === 'hooks' && groupedHookCards.length > 0 ? (
                    groupedHookCards.map(({ hook, entry }) => (
                      <article
                        key={hook.id}
                        className={`rounded-xl border p-4 ${getEntryStatusClasses(entry.status)}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-2xl font-bold tracking-tight text-storm-50">{hook.title}</div>
                            <div className="mt-1 text-xs uppercase tracking-[0.14em] text-storm-400">
                              source · {hook.source}
                            </div>
                          </div>
                          <div className="rounded-full border border-current/30 px-2 py-1 text-[10px] uppercase tracking-[0.18em]">
                            {ENTRY_STATUS_LABELS[entry.status]}
                          </div>
                        </div>

                        <div className="mt-3 grid gap-3 lg:grid-cols-2">
                          {[
                            { label: 'Prompt', value: hook.text },
                            { label: 'Use at the table', value: entry.body },
                          ].map((line) => (
                            <div
                              key={`${hook.id}:${line.label}`}
                              className={`rounded-lg border border-storm-800 bg-storm-950/40 px-3 py-2 text-sm leading-6 ${
                                entry.status === 'crossed_out'
                                  ? 'text-storm-500 line-through'
                                  : 'text-storm-200'
                              }`}
                            >
                              <div className="text-[10px] uppercase tracking-[0.18em] text-storm-500">
                                {line.label}
                              </div>
                              <div className="mt-1">{line.value}</div>
                            </div>
                          ))}
                        </div>

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
                    ))
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
      </section>
    </div>
  );
};
