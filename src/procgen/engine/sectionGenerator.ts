import { contentRegistry } from '../content/contentRegistry';
import type {
  GeneratedSectionConnector,
  GeneratedSection,
  GeneratedSectionConnection,
  GeneratedSectionInput,
  GeneratedSectionRoom,
  RectBounds,
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

const toBoundsRange = (start: number, size: number) => ({
  start,
  end: start + size,
});

const buildStraightConnector = ({
  connectorId,
  fromRoom,
  toRoom,
  sectionKind,
}: {
  connectorId: string;
  fromRoom: GeneratedSectionRoom;
  toRoom: GeneratedSectionRoom;
  sectionKind: SectionKind;
}): GeneratedSectionConnector | null => {
  const thickness = sectionKind === 'settlement' ? 3 : 2;
  const fromX = toBoundsRange(fromRoom.bounds.x, fromRoom.bounds.width);
  const fromY = toBoundsRange(fromRoom.bounds.y, fromRoom.bounds.height);
  const toX = toBoundsRange(toRoom.bounds.x, toRoom.bounds.width);
  const toY = toBoundsRange(toRoom.bounds.y, toRoom.bounds.height);

  const overlapTop = Math.max(fromY.start, toY.start);
  const overlapBottom = Math.min(fromY.end, toY.end);
  if (overlapBottom - overlapTop >= thickness) {
    const y = Math.floor((overlapTop + overlapBottom - thickness) / 2);
    const left = Math.min(fromX.end, toX.end);
    const right = Math.max(fromX.start, toX.start);

    return {
      connectorId,
      primitiveId: right - left >= 10 ? 'straight_corridor_long' : 'straight_corridor_short',
      family: 'corridor',
      segmentBounds: [
        {
          x: left,
          y,
          width: Math.max(thickness, right - left),
          height: thickness,
        },
      ],
      connectedRoomIds: [fromRoom.roomId, toRoom.roomId],
      tags: [sectionKind === 'settlement' ? 'street' : 'corridor'],
    };
  }

  const overlapLeft = Math.max(fromX.start, toX.start);
  const overlapRight = Math.min(fromX.end, toX.end);
  if (overlapRight - overlapLeft >= thickness) {
    const x = Math.floor((overlapLeft + overlapRight - thickness) / 2);
    const top = Math.min(fromY.end, toY.end);
    const bottom = Math.max(fromY.start, toY.start);

    return {
      connectorId,
      primitiveId: bottom - top >= 10 ? 'straight_corridor_long' : 'straight_corridor_short',
      family: 'corridor',
      segmentBounds: [
        {
          x,
          y: top,
          width: thickness,
          height: Math.max(thickness, bottom - top),
        },
      ],
      connectedRoomIds: [fromRoom.roomId, toRoom.roomId],
      tags: [sectionKind === 'settlement' ? 'street' : 'corridor'],
    };
  }

  return null;
};

const buildBentConnector = ({
  connectorId,
  fromRoom,
  toRoom,
  sectionKind,
}: {
  connectorId: string;
  fromRoom: GeneratedSectionRoom;
  toRoom: GeneratedSectionRoom;
  sectionKind: SectionKind;
}): GeneratedSectionConnector => {
  const thickness = sectionKind === 'settlement' ? 3 : 2;
  const fromCenterX = Math.floor(fromRoom.bounds.x + fromRoom.bounds.width / 2);
  const fromCenterY = Math.floor(fromRoom.bounds.y + fromRoom.bounds.height / 2);
  const toCenterX = Math.floor(toRoom.bounds.x + toRoom.bounds.width / 2);
  const toCenterY = Math.floor(toRoom.bounds.y + toRoom.bounds.height / 2);

  const horizontalStart = Math.min(fromCenterX, toCenterX);
  const horizontalEnd = Math.max(fromCenterX, toCenterX);
  const verticalStart = Math.min(fromCenterY, toCenterY);
  const verticalEnd = Math.max(fromCenterY, toCenterY);

  const firstSegment: RectBounds = {
    x: horizontalStart,
    y: fromCenterY,
    width: Math.max(thickness, horizontalEnd - horizontalStart),
    height: thickness,
  };

  const secondSegment: RectBounds = {
    x: toCenterX,
    y: verticalStart,
    width: thickness,
    height: Math.max(thickness, verticalEnd - verticalStart),
  };

  return {
    connectorId,
    primitiveId: 'bent_corridor',
    family: 'corridor',
    segmentBounds: [firstSegment, secondSegment],
    connectedRoomIds: [fromRoom.roomId, toRoom.roomId],
    tags: [sectionKind === 'settlement' ? 'street' : 'corridor', 'turn'],
  };
};

const buildSectionConnectors = ({
  rooms,
  connections,
  sectionKind,
}: {
  rooms: GeneratedSectionRoom[];
  connections: GeneratedSectionConnection[];
  sectionKind: SectionKind;
}): GeneratedSectionConnector[] => {
  const roomById = new Map(rooms.map((room) => [room.roomId, room]));

  return connections.flatMap((connection) => {
    const fromRoom = roomById.get(connection.fromRoomId);
    const toRoom = roomById.get(connection.toRoomId);

    if (!fromRoom || !toRoom) {
      return [];
    }

    return [
      buildStraightConnector({
        connectorId: `connector_${connection.connectionId}`,
        fromRoom,
        toRoom,
        sectionKind,
      }) ??
        buildBentConnector({
          connectorId: `connector_${connection.connectionId}`,
          fromRoom,
          toRoom,
          sectionKind,
        }),
    ];
  });
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
  const connectors = buildSectionConnectors({
    rooms,
    connections,
    sectionKind,
  });

  return {
    sectionId,
    seed,
    sectionKind,
    layoutType: preset.layoutType,
    grid: {
      width: 75,
      height: 75,
      tileSizeFt: 5,
    },
    primaryBiomeId: primaryBiome?.id ?? 'stone_halls',
    rooms,
    connections,
    connectors,
    entranceRoomIds,
    exitRoomIds,
  };
};
