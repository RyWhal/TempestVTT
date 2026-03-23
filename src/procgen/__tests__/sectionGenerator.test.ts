import { describe, expect, it } from 'vitest';
import { generateSection } from '../engine/sectionGenerator';
import { getLayoutPresets } from '../engine/layoutPresets';
import { getRoomCells, getOuterBoundarySpans } from '../geometry/roomGeometry';
import { contentRegistry } from '../content/contentRegistry';

const computeOccupiedArea = (
  rooms: Array<{ bounds: { x: number; y: number; width: number; height: number } }>
) => rooms.reduce((total, room) => total + room.bounds.width * room.bounds.height, 0);

const hasOverlap = (
  rooms: Array<{ bounds: { x: number; y: number; width: number; height: number } }>
) => {
  for (let i = 0; i < rooms.length; i++) {
    const a = rooms[i].bounds;
    const aRight = a.x + a.width;
    const aBottom = a.y + a.height;

    for (let j = i + 1; j < rooms.length; j++) {
      const b = rooms[j].bounds;
      const bRight = b.x + b.width;
      const bBottom = b.y + b.height;

      const separated =
        aRight <= b.x ||
        bRight <= a.x ||
        aBottom <= b.y ||
        bBottom <= a.y;

      if (!separated) {
        return true;
      }
    }
  }

  return false;
};

const collectReachableRoomIds = (
  section: ReturnType<typeof generateSection>
) => {
  const visited = new Set<string>();
  const queue = [...section.entranceRoomIds];

  while (queue.length > 0) {
    const roomId = queue.shift();

    if (!roomId || visited.has(roomId)) {
      continue;
    }

    visited.add(roomId);
    const room = section.rooms.find((candidate) => candidate.roomId === roomId);

    if (!room) {
      continue;
    }

    for (const nextRoomId of room.connectedRoomIds) {
      if (!visited.has(nextRoomId)) {
        queue.push(nextRoomId);
      }
    }
  }

  return visited;
};

describe('generateSection', () => {
  it('returns the same section for the same seed and section id', () => {
    const first = generateSection({
      worldSeed: 'world_ironbell_042',
      sectionId: 'section_start_001',
    });

    const second = generateSection({
      worldSeed: 'world_ironbell_042',
      sectionId: 'section_start_001',
    });

    expect(second).toEqual(first);
  });

  it('returns a different section for a different section id', () => {
    const first = generateSection({
      worldSeed: 'world_ironbell_042',
      sectionId: 'section_start_001',
    });

    const second = generateSection({
      worldSeed: 'world_ironbell_042',
      sectionId: 'section_002',
    });

    expect(second).not.toEqual(first);
  });

  it('keeps ordinary exploration sections sparse and readable', () => {
    const section = generateSection({
      worldSeed: 'world_ironbell_042',
      sectionId: 'section_sparse_001',
      sectionKind: 'exploration',
    });

    expect(section.grid.width).toBe(75);
    expect(section.grid.height).toBe(75);
    expect(section.rooms.length).toBeGreaterThanOrEqual(4);
    expect(section.rooms.length).toBeLessThanOrEqual(8);

    const occupiedArea = computeOccupiedArea(section.rooms);
    expect(occupiedArea).toBeLessThan(3600);
  });

  it('allows settlement sections to occupy much more of the map footprint', () => {
    const section = generateSection({
      worldSeed: 'world_ironbell_042',
      sectionId: 'section_village_001',
      sectionKind: 'settlement',
    });

    expect(section.rooms.length).toBeGreaterThanOrEqual(8);

    const occupiedArea = computeOccupiedArea(section.rooms);
    expect(occupiedArea).toBeGreaterThan(1500);
  });

  it('places rooms within the 100x100 section bounds without overlap', () => {
    const section = generateSection({
      worldSeed: 'world_ironbell_042',
      sectionId: 'section_bounds_001',
    });

    for (const room of section.rooms) {
      expect(room.bounds.x).toBeGreaterThanOrEqual(0);
      expect(room.bounds.y).toBeGreaterThanOrEqual(0);
      expect(room.bounds.x + room.bounds.width).toBeLessThanOrEqual(section.grid.width);
      expect(room.bounds.y + room.bounds.height).toBeLessThanOrEqual(section.grid.height);
    }

    expect(hasOverlap(section.rooms)).toBe(false);
  });

  it('guarantees at least one entrance, one exit, and full room reachability', () => {
    const section = generateSection({
      worldSeed: 'world_ironbell_042',
      sectionId: 'section_connectivity_001',
    });

    expect(section.entranceRoomIds.length).toBeGreaterThanOrEqual(1);
    expect(section.exitRoomIds.length).toBeGreaterThanOrEqual(1);

    const reachableRoomIds = collectReachableRoomIds(section);
    expect(reachableRoomIds.size).toBe(section.rooms.length);

    for (const exitRoomId of section.exitRoomIds) {
      expect(reachableRoomIds.has(exitRoomId)).toBe(true);
    }
  });

  it('uses explicit corridor primitives and non-square chambers in settlement sections', () => {
    const section = generateSection({
      worldSeed: 'world_ironbell_042',
      sectionId: 'section_settlement_primitives_001',
      sectionKind: 'settlement',
    });

    expect(section.connectors.length).toBeGreaterThan(0);
    expect(
      section.connectors.some((connector) =>
        ['straight_corridor_short', 'straight_corridor_long', 'bent_corridor'].includes(
          connector.primitiveId
        )
      )
    ).toBe(true);

    expect(
      section.rooms.some((room) => !room.primitiveId.startsWith('square_'))
    ).toBe(true);
  });

  it('keeps settlement preset edges aligned to real slots', () => {
    const presets = getLayoutPresets('settlement');

    for (const preset of presets) {
      const slotIds = new Set(preset.slots.map((slot) => slot.id));

      for (const [fromSlotId, toSlotId] of preset.edges) {
        expect(slotIds.has(fromSlotId)).toBe(true);
        expect(slotIds.has(toSlotId)).toBe(true);
      }
    }
  });

  it('keeps settlement sections fully reachable without orphaned rooms', () => {
    const section = generateSection({
      worldSeed: 'starter_hub_seed',
      sectionId: 'section_hometown',
      sectionKind: 'settlement',
    });

    const reachableRoomIds = collectReachableRoomIds(section);

    expect(reachableRoomIds.size).toBe(section.rooms.length);
    expect(section.rooms.every((room) => room.connectedRoomIds.length > 0)).toBe(true);
  });

  it('gives the starter settlement four cardinal exits', () => {
    const section = generateSection({
      worldSeed: 'starter_hub_seed',
      sectionId: 'section_hometown',
      sectionKind: 'settlement',
    });

    expect(section.entranceRoomIds.length).toBe(1);
    expect(section.exitRoomIds.length).toBe(4);
  });

  it('keeps Hometown room footprints non-overlapping after settlement placement', () => {
    const section = generateSection({
      worldSeed: 'starter_hub_seed',
      sectionId: 'section_hometown',
      sectionKind: 'settlement',
    });

    expect(hasOverlap(section.rooms)).toBe(false);
  });

  it('anchors every connector to the actual primitive footprint boundary', () => {
    const section = generateSection({
      worldSeed: 'world_ironbell_042',
      sectionId: 'section_footprint_anchor_001',
      sectionKind: 'exploration',
    });
    const primitiveMap = new Map(
      contentRegistry.loadPack('room_primitives').roomPrimitives.map((primitive) => [primitive.id, primitive] as const)
    );

    for (const connector of section.connectors) {
      for (const anchor of connector.roomAnchors) {
        const room = section.rooms.find((candidate) => candidate.roomId === anchor.roomId);

        expect(room).toBeDefined();

        if (!room) {
          continue;
        }

        const roomCells = getRoomCells(room, primitiveMap.get(room.primitiveId));
        const spans = getOuterBoundarySpans(roomCells, anchor.side);
        const matchingSpan = spans.find((span) => {
          if (anchor.side === 'north' || anchor.side === 'south') {
            return span.line === anchor.y && anchor.x >= span.start && anchor.x <= span.end;
          }

          return span.line === anchor.x && anchor.y >= span.start && anchor.y <= span.end;
        });

        expect(matchingSpan).toBeDefined();
      }
    }
  });
});
