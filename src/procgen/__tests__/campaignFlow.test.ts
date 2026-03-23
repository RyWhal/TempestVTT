import { describe, expect, it } from 'vitest';
import {
  buildOverviewGraph,
  createStarterCampaignSnapshot,
  rerollPreviewContent,
  updateCampaignBookEntryStatus,
  visitSectionPreview,
} from '../engine/campaignFlow';

describe('campaignFlow', () => {
  it('creates a fixed starting village with four known cardinal previews', () => {
    const snapshot = createStarterCampaignSnapshot({
      sessionId: 'session_001',
      campaignName: 'The Bloom Beneath',
      worldSeed: 'world_ironbell_042',
    });

    expect(snapshot.campaign.startingSectionId).toBe('section_start_village');
    expect(snapshot.campaign.activeSectionId).toBe('section_start_village');
    expect(snapshot.sections).toHaveLength(1);
    expect(snapshot.previews).toHaveLength(4);

    const startingSection = snapshot.sections[0];
    expect(startingSection.state).toBe('locked');
    expect(startingSection.name).toBe('Hometown');
    expect(startingSection.generationState.visitIndex).toBe(0);
    expect(startingSection.generationState.generatedContent).toBeTruthy();
    const startingContent = startingSection.generationState.generatedContent;
    expect(startingContent?.npcs.length).toBeGreaterThan(0);
    expect(startingContent?.shops.length).toBeGreaterThan(0);

    const previewDirections = snapshot.previews.map((preview) => preview.direction).sort();
    expect(previewDirections).toEqual(['east', 'north', 'south', 'west']);

    for (const preview of snapshot.previews) {
      expect(preview.previewState.playerVisibility).toBe('known_unvisited');
      expect(preview.previewState.generatedContent).toBeTruthy();
      expect(preview.previewState.generatedContent?.creatures.length).toBeGreaterThan(0);
    }
  });

  it('keeps the starter village structurally fixed even when the campaign world seed changes', () => {
    const first = createStarterCampaignSnapshot({
      sessionId: 'session_001',
      campaignName: 'The Bloom Beneath',
      worldSeed: 'world_ironbell_042',
    });
    const second = createStarterCampaignSnapshot({
      sessionId: 'session_002',
      campaignName: 'The Bloom Beneath',
      worldSeed: 'world_ashenroot_777',
    });

    expect(first.sections[0].name).toBe('Hometown');
    expect(second.sections[0].name).toBe('Hometown');
    expect(first.sections[0].generationState.generatedSection).toEqual(
      second.sections[0].generationState.generatedSection
    );
  });

  it('promotes a visited preview into a locked section and only generates outward branches', () => {
    const starter = createStarterCampaignSnapshot({
      sessionId: 'session_001',
      campaignName: 'The Bloom Beneath',
      worldSeed: 'world_ironbell_042',
    });

    const next = visitSectionPreview(starter, 'preview_section_start_village_east');

    expect(next.campaign.activeSectionId).toBe('section_start_village_east');
    expect(next.sections).toHaveLength(2);

    const eastSection = next.sections.find(
      (section) => section.sectionId === 'section_start_village_east'
    );

    expect(eastSection?.state).toBe('locked');
    expect(eastSection?.generationState.visitIndex).toBe(1);
    expect(eastSection?.generationState.enteredFromDirection).toBe('west');

    const eastBranchDirections = next.previews
      .filter((preview) => preview.fromSectionId === eastSection?.id)
      .map((preview) => preview.direction)
      .sort();

    expect(eastBranchDirections).toEqual(['east', 'north', 'south']);
    expect(eastBranchDirections).not.toContain('west');
    expect(next.previews).toHaveLength(6);
  });

  it('shows only visited and known sections to players while exposing full previews to the GM', () => {
    const starter = createStarterCampaignSnapshot({
      sessionId: 'session_001',
      campaignName: 'The Bloom Beneath',
      worldSeed: 'world_ironbell_042',
    });
    const next = visitSectionPreview(starter, 'preview_section_start_village_east');

    const playerGraph = buildOverviewGraph(next, 'player');
    const gmGraph = buildOverviewGraph(next, 'gm');

    expect(playerGraph.nodes.map((node) => node.sectionId).sort()).toEqual([
      'section_start_village',
      'section_start_village_east',
      'section_start_village_north',
      'section_start_village_south',
      'section_start_village_west',
    ]);

    expect(gmGraph.nodes.map((node) => node.sectionId).sort()).toEqual([
      'section_start_village',
      'section_start_village_east',
      'section_start_village_east_east',
      'section_start_village_east_north',
      'section_start_village_east_south',
      'section_start_village_north',
      'section_start_village_south',
      'section_start_village_west',
    ]);

    expect(
      gmGraph.nodes.find((node) => node.sectionId === 'section_start_village_east_north')?.state
    ).toBe('preview');
    expect(
      playerGraph.nodes.find((node) => node.sectionId === 'section_start_village_north')?.state
    ).toBe('known_unvisited');
  });

  it('rerolls preview content by slice without changing section geometry', () => {
    const starter = createStarterCampaignSnapshot({
      sessionId: 'session_001',
      campaignName: 'The Bloom Beneath',
      worldSeed: 'world_ironbell_042',
    });

    const rerolled = rerollPreviewContent(starter, 'preview_section_start_village_east', 'creatures');
    const originalPreview = starter.previews.find(
      (preview) => preview.id === 'preview_section_start_village_east'
    );
    const rerolledPreview = rerolled.previews.find(
      (preview) => preview.id === 'preview_section_start_village_east'
    );

    expect(rerolledPreview?.previewState.generatedSection).toEqual(
      originalPreview?.previewState.generatedSection
    );
    expect(rerolledPreview?.previewState.generatedContent?.creatures).not.toEqual(
      originalPreview?.previewState.generatedContent?.creatures
    );
    expect(rerolledPreview?.previewState.generatedContent?.shops).toEqual(
      originalPreview?.previewState.generatedContent?.shops
    );
  });

  it('updates campaign-book entry status for a visited section without mutating other entries', () => {
    const starter = createStarterCampaignSnapshot({
      sessionId: 'session_001',
      campaignName: 'The Bloom Beneath',
      worldSeed: 'world_ironbell_042',
    });
    const section = starter.sections[0];
    const content = section.generationState.generatedContent;
    const targetEntry = content?.campaignBook.entries[0];
    const untouchedEntry = content?.campaignBook.entries[1];

    expect(targetEntry?.status).toBe('suggested');

    const updated = updateCampaignBookEntryStatus(
      starter,
      { kind: 'section', id: section.sectionId },
      targetEntry?.id ?? '',
      'crossed_out'
    );

    const updatedContent = updated.sections[0]?.generationState.generatedContent;
    const updatedTargetEntry = updatedContent?.campaignBook.entries.find(
      (entry) => entry.id === targetEntry?.id
    );
    const updatedUntouchedEntry = updatedContent?.campaignBook.entries.find(
      (entry) => entry.id === untouchedEntry?.id
    );

    expect(updatedTargetEntry?.status).toBe('crossed_out');
    expect(updatedUntouchedEntry?.status).toBe(untouchedEntry?.status);
    expect(
      starter.sections[0]?.generationState.generatedContent?.campaignBook.entries.find(
        (entry) => entry.id === targetEntry?.id
      )?.status
    ).toBe('suggested');
  });

  it('updates campaign-book entry status for a preview entry in-place', () => {
    const starter = createStarterCampaignSnapshot({
      sessionId: 'session_001',
      campaignName: 'The Bloom Beneath',
      worldSeed: 'world_ironbell_042',
    });
    const preview = starter.previews[0];
    const content = preview.previewState.generatedContent;
    const targetEntry = content?.campaignBook.entries[0];

    const updated = updateCampaignBookEntryStatus(
      starter,
      { kind: 'preview', id: preview.id },
      targetEntry?.id ?? '',
      'accepted'
    );

    const updatedPreview = updated.previews.find((candidate) => candidate.id === preview.id);
    const updatedTargetEntry = updatedPreview?.previewState.generatedContent?.campaignBook.entries.find(
      (entry) => entry.id === targetEntry?.id
    );

    expect(updatedTargetEntry?.status).toBe('accepted');
    expect(
      starter.previews[0]?.previewState.generatedContent?.campaignBook.entries.find(
        (entry) => entry.id === targetEntry?.id
      )?.status
    ).toBe('suggested');
  });

  it('generates distinct section labels as the graph expands', () => {
    const starter = createStarterCampaignSnapshot({
      sessionId: 'session_001',
      campaignName: 'The Bloom Beneath',
      worldSeed: 'world_ironbell_042',
    });
    const firstStep = visitSectionPreview(starter, 'preview_section_start_village_north');
    const secondStep = visitSectionPreview(firstStep, 'preview_section_start_village_north_east');

    const labels = [
      ...secondStep.sections.map((section) => section.name),
      ...secondStep.previews.map((preview) => String(preview.previewState.label ?? preview.sectionStubId)),
    ];
    const uniqueLabels = new Set(labels);

    expect(uniqueLabels.size).toBe(labels.length);
  });

  it('reuses an existing preview when a new branch reaches an occupied coordinate', () => {
    const starter = createStarterCampaignSnapshot({
      sessionId: 'session_001',
      campaignName: 'The Bloom Beneath',
      worldSeed: 'world_ironbell_042',
    });
    const east = visitSectionPreview(starter, 'preview_section_start_village_east');
    const eastSouth = visitSectionPreview(east, 'preview_section_start_village_east_south');

    const previewsAtSouthCoordinate = eastSouth.previews.filter((preview) => {
      const coordinates = preview.previewState.coordinates as { x?: number; y?: number } | undefined;
      return coordinates?.x === 0 && coordinates?.y === 1;
    });
    const eastSouthSection = eastSouth.sections.find(
      (section) => section.sectionId === 'section_start_village_east_south'
    );
    const reusedSouthPreview = previewsAtSouthCoordinate[0];
    const adjacentFromSectionIds = (
      reusedSouthPreview?.previewState.adjacentFromSectionIds as string[] | undefined
    ) ?? [];

    expect(previewsAtSouthCoordinate).toHaveLength(1);
    expect(reusedSouthPreview?.sectionStubId).toBe('section_start_village_south');
    expect(adjacentFromSectionIds).toContain(eastSouthSection?.id);
  });

  it('closes loops by reconnecting to an existing visited section instead of spawning a duplicate', () => {
    const starter = createStarterCampaignSnapshot({
      sessionId: 'session_001',
      campaignName: 'The Bloom Beneath',
      worldSeed: 'world_ironbell_042',
    });
    const east = visitSectionPreview(starter, 'preview_section_start_village_east');
    const eastSouth = visitSectionPreview(east, 'preview_section_start_village_east_south');
    const eastSouthSection = eastSouth.sections.find(
      (section) => section.sectionId === 'section_start_village_east_south'
    );
    const south = visitSectionPreview(
      eastSouth,
      'preview_section_start_village_south',
      eastSouthSection?.id ?? null
    );

    const hometownSections = south.sections.filter(
      (section) =>
        (section.generationState.coordinates as { x?: number; y?: number } | undefined)?.x === 0 &&
        (section.generationState.coordinates as { x?: number; y?: number } | undefined)?.y === 0
    );
    const hometownPreviews = south.previews.filter(
      (preview) =>
        (preview.previewState.coordinates as { x?: number; y?: number } | undefined)?.x === 0 &&
        (preview.previewState.coordinates as { x?: number; y?: number } | undefined)?.y === 0
    );
    const southSection = south.sections.find((section) => section.sectionId === 'section_start_village_south');

    expect(hometownSections).toHaveLength(1);
    expect(hometownSections[0]?.sectionId).toBe('section_start_village');
    expect(hometownPreviews).toHaveLength(0);
    expect(
      south.campaign.dungeonGraph.edges.some(
        (edge) =>
          edge.fromSectionId === 'section_start_village_south' &&
          edge.fromConnectionId === 'north' &&
          edge.toSectionId === 'section_start_village'
      )
    ).toBe(true);
    expect(south.campaign.activeSectionId).toBe(southSection?.sectionId);
  });
});
