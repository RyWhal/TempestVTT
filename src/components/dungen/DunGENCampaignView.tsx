import React, { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpenText, Map, Route, Sparkles } from 'lucide-react';
import { Button } from '../shared/Button';
import { useSessionStore } from '../../stores/sessionStore';
import { useProcgenStore } from '../../stores/procgenStore';
import { useMapStore } from '../../stores/mapStore';
import {
  buildOverviewGraph,
  type CampaignSnapshot,
  createSnapshotFromStore,
  createStarterCampaignSnapshot,
  getOrderedPreviews,
  getOrderedVisitedSections,
  visitSectionPreview,
} from '../../procgen/engine/campaignFlow';
import { createGeneratedMapFromSection } from '../../procgen/integration/mapAdapter';
import type { GeneratedSection, OverviewNode } from '../../procgen/types';

interface DunGENCampaignViewProps {
  snapshotOverride?: CampaignSnapshot | null;
}

const GRID_STEP = 116;
const NODE_SIZE = 86;

const getGeneratedSection = (section: {
  generationState: Record<string, unknown>;
}): GeneratedSection | null => {
  const generatedSection = section.generationState.generatedSection;
  return generatedSection && typeof generatedSection === 'object'
    ? (generatedSection as GeneratedSection)
    : null;
};

const getVisitIndex = (generationState: Record<string, unknown>) => {
  const visitIndex = generationState.visitIndex;
  return typeof visitIndex === 'number' ? visitIndex : 0;
};

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
  const setMaps = useMapStore((state) => state.setMaps);
  const setActiveMap = useMapStore((state) => state.setActiveMap);

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

  const activeSection =
    visitedSections.find((section) => section.sectionId === activeSectionId) ?? visitedSections[0] ?? null;

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

    const nextSnapshot = visitSectionPreview(snapshot, previewId);
    hydrateProcgenState(nextSnapshot);
  };

  const handleLaunchToPlay = () => {
    if (!session || visitedSections.length === 0) {
      return;
    }

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
      generatedMaps.find((map) => map.generatedSectionId === (activeSection?.sectionId ?? activeSectionId)) ??
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
                onClick={() => setActiveSectionId(section.sectionId)}
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

      <div className="grid gap-6 xl:grid-cols-[1.25fr_0.95fr]">
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

        <section className="space-y-6">
          <div className="rounded-3xl border border-storm-800 bg-storm-900 p-5">
            <div className="mb-4 flex items-center gap-2 text-sm font-medium text-storm-300">
              <BookOpenText className="h-4 w-4" />
              Campaign Book
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border border-storm-850 bg-storm-950 p-4">
                <div className="text-xs uppercase tracking-[0.22em] text-storm-500">
                  Active Section
                </div>
                <h2 className="mt-2 text-xl font-semibold text-storm-50">{activeSection.name}</h2>
                <p className="mt-2 text-sm text-storm-300">
                  Biome: <strong>{activeSection.primaryBiomeId}</strong> · Layout:{' '}
                  <strong>{activeSection.layoutType}</strong> · Rooms:{' '}
                  <strong>{activeSection.roomIds.length}</strong>
                </p>
                <p className="mt-2 text-sm text-storm-400">
                  Upcoming reroll controls will live here for whole-section and per-content
                  refreshes. This first slice focuses on the section tabs, overview graph,
                  and launch loop.
                </p>
              </div>

              <div className="rounded-2xl border border-storm-850 bg-storm-950 p-4">
                <div className="text-xs uppercase tracking-[0.22em] text-storm-500">
                  Table Of Contents
                </div>
                <div className="mt-3 space-y-3">
                  {visitedSections.map((section) => (
                    <div key={section.id} className="rounded-xl border border-storm-900 bg-storm-925 p-3">
                      <div className="text-sm font-medium text-storm-100">{section.name}</div>
                      <div className="mt-1 text-xs text-storm-400">
                        Visit index {getVisitIndex(section.generationState)} ·{' '}
                        {section.primaryBiomeId} · {section.roomIds.length} rooms
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-storm-850 bg-storm-950 p-4">
                <div className="text-xs uppercase tracking-[0.22em] text-storm-500">
                  Upcoming Previews
                </div>
                <div className="mt-3 space-y-3">
                  {previews.map((preview) => (
                    <div key={preview.id} className="rounded-xl border border-storm-900 bg-storm-925 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-medium text-storm-100">
                            {String(preview.previewState.label ?? preview.sectionStubId)}
                          </div>
                          <div className="mt-1 text-xs uppercase tracking-[0.18em] text-storm-500">
                            {preview.direction} branch
                          </div>
                        </div>
                        <Button size="sm" variant="secondary" onClick={() => handleVisitPreview(preview.id)}>
                          Visit
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
