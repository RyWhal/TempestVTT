import { contentRegistry } from '../content/contentRegistry';
import type {
  GeneratedSection,
  GeneratedSectionConnection,
  GeneratedSectionInput,
  SectionKind,
} from '../types';
import { deriveSectionSeed } from './seed';
import { getLayoutPresets } from './layoutPresets';
import { placeRoomsForPreset } from './roomPlacement';
import { assignRooms } from './roomAssignment';

const createSeededRandom = (seed: string) => {
  let state = 0;

  for (let index = 0; index < seed.length; index++) {
    state = (state * 31 + seed.charCodeAt(index)) >>> 0;
  }

  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
};

const chooseSectionKind = (sectionKind: SectionKind | undefined): SectionKind => {
  return sectionKind ?? 'exploration';
};

export const generateSection = ({
  worldSeed,
  sectionId,
  sectionKind: requestedSectionKind,
}: GeneratedSectionInput): GeneratedSection => {
  const sectionKind = chooseSectionKind(requestedSectionKind);
  const seed = deriveSectionSeed({ worldSeed, sectionId });
  const nextRandom = createSeededRandom(`${seed}:${sectionKind}`);
  const layoutPresets = getLayoutPresets(sectionKind);
  const preset = layoutPresets[Math.floor(nextRandom() * layoutPresets.length)] ?? layoutPresets[0];

  const roomPrimitivePack = contentRegistry.loadPack('room_primitives');
  const biomePack = contentRegistry.loadPack('biomes');
  const primaryBiome =
    biomePack.biomes[Math.floor(nextRandom() * biomePack.biomes.length)] ?? biomePack.biomes[0];

  const placedRooms = placeRoomsForPreset({
    preset,
    roomPrimitives: roomPrimitivePack.roomPrimitives,
    nextRandom,
    sectionKind,
  });

  const roomIdBySlotId = new Map(placedRooms.map((room) => [room.slotId, room.roomId]));
  const edgeMap = new Map<string, string[]>();
  const connections: GeneratedSectionConnection[] = [];

  for (const room of placedRooms) {
    edgeMap.set(room.roomId, []);
  }

  for (const [fromSlotId, toSlotId] of preset.edges) {
    const fromRoomId = roomIdBySlotId.get(fromSlotId);
    const toRoomId = roomIdBySlotId.get(toSlotId);

    if (!fromRoomId || !toRoomId) {
      continue;
    }

    edgeMap.get(fromRoomId)?.push(toRoomId);
    edgeMap.get(toRoomId)?.push(fromRoomId);
    connections.push({
      connectionId: `${fromRoomId}_${toRoomId}`,
      fromRoomId,
      toRoomId,
    });
  }

  const rooms = assignRooms({
    placedRooms,
    sectionKind,
    primaryBiome,
    entranceSlotId: preset.entranceSlotId,
    exitSlotIds: preset.exitSlotIds,
    edgeMap,
  });

  const entranceRoomIds = rooms.filter((room) => room.isEntrance).map((room) => room.roomId);
  const exitRoomIds = rooms.filter((room) => room.isExit).map((room) => room.roomId);

  return {
    sectionId,
    seed,
    sectionKind,
    layoutType: preset.layoutType,
    grid: {
      width: 100,
      height: 100,
      tileSizeFt: 5,
    },
    primaryBiomeId: primaryBiome?.id ?? 'stone_halls',
    rooms,
    connections,
    entranceRoomIds,
    exitRoomIds,
  };
};
