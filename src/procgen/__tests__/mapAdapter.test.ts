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

    expect(payload.tileSizePx).toBe(28);
    expect(payload.width).toBe(2100);
    expect(payload.height).toBe(2100);
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

  it('snaps north-south connectors to tile columns instead of grid lines', () => {
    const section = generateSection({
      worldSeed: 'world_ironbell_042',
      sectionId: 'section_render_vertical_alignment_001',
      sectionKind: 'settlement',
    });

    const payload = buildSectionRenderPayload(section);
    const verticalStreet = payload.floors.find(
      (floor) => floor.regionType === 'street' && floor.height > floor.width
    );

    expect(verticalStreet).toBeDefined();
    expect((verticalStreet?.x ?? 0) % payload.tileSizePx).toBe(0);
    expect((verticalStreet?.width ?? 0) % payload.tileSizePx).toBe(0);
  });

  it('renders corridor primitives as wider segment floors instead of single thin links', () => {
    const section = generateSection({
      worldSeed: 'world_ironbell_042',
      sectionId: 'section_render_corridor_segments_001',
      sectionKind: 'exploration',
    });

    const payload = buildSectionRenderPayload(section);
    const corridorFloors = payload.floors.filter((floor) => floor.regionType === 'connector');

    expect(corridorFloors.length).toBeGreaterThan(0);
    expect(corridorFloors.every((floor) => floor.width >= payload.tileSizePx * 2 || floor.height >= payload.tileSizePx * 2)).toBe(true);
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
