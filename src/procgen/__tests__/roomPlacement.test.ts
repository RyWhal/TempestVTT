import { describe, expect, it } from 'vitest';
import { contentRegistry } from '../content/contentRegistry';
import type { LayoutPreset } from '../engine/layoutPresets';
import { placeRoomsForPreset } from '../engine/roomPlacement';
import type { ResolvedSectionProfile } from '../types';

const roomPrimitives = contentRegistry.loadPack('room_primitives').roomPrimitives;

const createSectionProfile = (
  overrides: Partial<ResolvedSectionProfile> = {}
): ResolvedSectionProfile => ({
  seed: 'profile_seed',
  coordinates: { x: 1, y: 1 },
  graphDepth: 2,
  sectionKind: 'exploration',
  biomeProfileId: 'stone_halls',
  settlementProfileId: null,
  livabilityScore: 0,
  defaultFloorMaterialKey: 'dungeon_stone',
  roomPrimitiveDensity: 0.5,
  corridorDensity: 0.5,
  junctionDensity: 0.15,
  openSpaceRatio: 0.2,
  landmarkFrequency: 0.1,
  allowedRoomPrimitiveIds: ['rectangle_medium', 'rectangle_long', 'square_large'],
  allowedCorridorPrimitiveIds: ['rectangle_short'],
  settlementPrimitivePreferenceIds: [],
  ...overrides,
});

const testPreset: LayoutPreset = {
  layoutType: 'clustered_rooms' as const,
  entranceSlotId: 'entry',
  exitSlotIds: ['plaza'],
  slots: [
    { id: 'entry', x: 4, y: 24, width: 14, height: 14, tags: ['entry', 'service'] },
    { id: 'plaza', x: 22, y: 10, width: 30, height: 30, tags: ['hub', 'courtyard', 'landmark'] },
    { id: 'side', x: 56, y: 18, width: 18, height: 18, tags: ['branch', 'residence'] },
  ],
  edges: [
    ['entry', 'plaza'],
    ['plaza', 'side'],
  ],
};

const createSequenceRandom = (values: number[]) => {
  let index = 0;
  return () => {
    const value = values[index % values.length] ?? 0;
    index += 1;
    return value;
  };
};

const computeOccupiedArea = (
  rooms: Array<{ bounds: { width: number; height: number } }>
) => rooms.reduce((total, room) => total + room.bounds.width * room.bounds.height, 0);

describe('placeRoomsForPreset', () => {
  it('changes primitive selection frequency when section profiles constrain the primitive pool', () => {
    const denseProfile = createSectionProfile({
      roomPrimitiveDensity: 0.82,
      openSpaceRatio: 0.1,
      allowedRoomPrimitiveIds: ['rectangle_medium', 'rectangle_long', 'square_large'],
    });
    const openProfile = createSectionProfile({
      roomPrimitiveDensity: 0.32,
      openSpaceRatio: 0.58,
      allowedRoomPrimitiveIds: ['circle_medium', 'courtyard_open', 'ring_room'],
      settlementPrimitivePreferenceIds: ['courtyard_open', 'ring_room', 'circle_medium'],
    });

    const denseRooms = placeRoomsForPreset({
      preset: testPreset,
      roomPrimitives,
      nextRandom: createSequenceRandom([0.05, 0.15, 0.25, 0.35, 0.45]),
      sectionKind: 'settlement',
      sectionProfile: denseProfile,
    });
    const openRooms = placeRoomsForPreset({
      preset: testPreset,
      roomPrimitives,
      nextRandom: createSequenceRandom([0.05, 0.15, 0.25, 0.35, 0.45]),
      sectionKind: 'settlement',
      sectionProfile: openProfile,
    });

    expect(
      denseRooms.every((room) => denseProfile.allowedRoomPrimitiveIds.includes(room.primitiveId))
    ).toBe(true);
    expect(
      openRooms.every((room) => openProfile.allowedRoomPrimitiveIds.includes(room.primitiveId))
    ).toBe(true);
    expect(openRooms.some((room) => room.primitiveId === 'courtyard_open')).toBe(true);
  });

  it('keeps open profiles more spatially loose than dense profiles', () => {
    const denseProfile = createSectionProfile({
      roomPrimitiveDensity: 0.88,
      openSpaceRatio: 0.08,
      allowedRoomPrimitiveIds: ['rectangle_medium', 'rectangle_long', 'square_large', 'circle_medium'],
    });
    const openProfile = createSectionProfile({
      roomPrimitiveDensity: 0.34,
      openSpaceRatio: 0.62,
      allowedRoomPrimitiveIds: ['rectangle_medium', 'rectangle_long', 'square_large', 'circle_medium'],
      settlementPrimitivePreferenceIds: ['circle_medium'],
    });

    const denseRooms = placeRoomsForPreset({
      preset: testPreset,
      roomPrimitives,
      nextRandom: createSequenceRandom([0.2, 0.4, 0.6, 0.8]),
      sectionKind: 'settlement',
      sectionProfile: denseProfile,
    });
    const openRooms = placeRoomsForPreset({
      preset: testPreset,
      roomPrimitives,
      nextRandom: createSequenceRandom([0.2, 0.4, 0.6, 0.8]),
      sectionKind: 'settlement',
      sectionProfile: openProfile,
    });

    expect(computeOccupiedArea(openRooms)).toBeLessThan(computeOccupiedArea(denseRooms));
  });
});
