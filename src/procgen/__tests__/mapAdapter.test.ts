import { describe, expect, it } from 'vitest';
import { generateSection } from '../engine/sectionGenerator';
import { buildSectionRenderPayload } from '../map/buildSectionRenderPayload';
import {
  createGeneratedMapFromSection,
  normalizeSectionRenderPayload,
} from '../integration/mapAdapter';

describe('buildSectionRenderPayload', () => {
  it('converts a generated section into a canvas-friendly payload', () => {
    const section = generateSection({
      worldSeed: 'world_ironbell_042',
      sectionId: 'section_render_001',
      sectionKind: 'exploration',
    });

    const payload = buildSectionRenderPayload(section);

    expect(payload.width).toBe(section.grid.width * payload.tileSizePx);
    expect(payload.height).toBe(section.grid.height * payload.tileSizePx);
    expect(payload.floors.length).toBeGreaterThanOrEqual(section.rooms.length);
    expect(payload.walls.length).toBeGreaterThan(0);
    expect(payload.markers.some((marker) => marker.kind === 'entrance')).toBe(true);
    expect(payload.markers.some((marker) => marker.kind === 'exit')).toBe(true);
  });

  it('adds connector floors and texture-friendly material hooks for settlement sections', () => {
    const section = generateSection({
      worldSeed: 'world_ironbell_042',
      sectionId: 'section_render_settlement_001',
      sectionKind: 'settlement',
    });

    const payload = buildSectionRenderPayload(section);
    const connectorFloors = payload.floors.filter(
      (floor) => floor.regionType === 'connector' || floor.regionType === 'street'
    );
    const streetLikeFloors = payload.floors.filter((floor) => floor.materialKey?.includes('street'));
    const thresholdDoors = payload.doors?.filter((door) => door.surfaceType === 'threshold') ?? [];

    expect(connectorFloors.length).toBeGreaterThan(0);
    expect(streetLikeFloors.length).toBeGreaterThan(0);
    expect(thresholdDoors.length).toBeGreaterThan(0);
    expect(payload.floors.every((floor) => typeof floor.materialKey === 'string')).toBe(true);
  });
});

describe('mapAdapter', () => {
  it('wraps a generated section as a generated map without breaking grid math', () => {
    const section = generateSection({
      worldSeed: 'world_ironbell_042',
      sectionId: 'section_render_002',
      sectionKind: 'settlement',
    });

    const map = createGeneratedMapFromSection({
      mapId: 'generated_map_001',
      sessionId: 'session_001',
      section,
    });

    expect(map.sourceType).toBe('generated');
    expect(map.generatedSectionId).toBe(section.sectionId);
    expect(map.generatedRenderPayload).not.toBeNull();
    expect(map.imageUrl).toBe('');
    expect(map.width).toBe(section.grid.width * map.gridCellSize);
    expect(map.height).toBe(section.grid.height * map.gridCellSize);
    expect(map.gridEnabled).toBe(true);
  });

  it('fills in missing optional visual layers with safe defaults', () => {
    const normalized = normalizeSectionRenderPayload({
      width: 7000,
      height: 7000,
      tileSizePx: 70,
      backgroundColor: '#000000',
      floors: [],
      walls: [],
      markers: [],
    });

    expect(normalized.doors).toEqual([]);
    expect(normalized.hazards).toEqual([]);
    expect(normalized.objects).toEqual([]);
    expect(normalized.atmosphere).toBeNull();
  });
});
