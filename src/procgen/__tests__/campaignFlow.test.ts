import { describe, expect, it } from 'vitest';
import {
  buildOverviewGraph,
  createStarterCampaignSnapshot,
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

    const previewDirections = snapshot.previews.map((preview) => preview.direction).sort();
    expect(previewDirections).toEqual(['east', 'north', 'south', 'west']);

    for (const preview of snapshot.previews) {
      expect(preview.previewState.playerVisibility).toBe('known_unvisited');
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
});
