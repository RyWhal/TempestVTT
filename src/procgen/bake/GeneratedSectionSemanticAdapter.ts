import { contentRegistry } from '../content/contentRegistry';
import {
  createEmptyCellSet,
  fillRectCells,
  getRoomCells,
  parseCellKey,
} from '../geometry/roomGeometry';
import type { GeneratedSection, GeneratedSectionConnector, GeneratedSectionRoom, RoomPrimitive } from '../types';
import type { GeneratedSemanticMap, SemanticCell, SemanticRoom, SemanticTransition } from './SemanticMapTypes';

const primitiveById = new Map(
  contentRegistry.loadPack('room_primitives').roomPrimitives.map((primitive) => [primitive.id, primitive] as const)
);

const createSemanticRoom = (room: GeneratedSectionRoom): SemanticRoom => ({
  roomId: room.roomId,
  roomType: room.roomTypeId,
  biomeId: room.biomeId,
  dangerLevel: room.tags.includes('hazard') ? 0.8 : room.tags.includes('landmark') ? 0.6 : 0.35,
  wearLevel: room.tags.includes('service') ? 0.55 : room.tags.includes('landmark') ? 0.7 : 0.45,
  moistureLevel: room.biomeId === 'waterways' ? 0.85 : room.biomeId === 'fungal_warrens' ? 0.6 : 0.2,
  growthLevel: room.biomeId === 'fungal_warrens' ? 0.85 : room.tags.includes('garden') ? 0.4 : 0.1,
});

const applyRoomCells = (
  room: GeneratedSectionRoom,
  cellsByKey: Map<string, SemanticCell>,
  maxBounds: { width: number; height: number }
) => {
  const primitive = primitiveById.get(room.primitiveId) as RoomPrimitive | undefined;
  const roomCells = getRoomCells(room, primitive);

  for (const key of roomCells) {
    const { x, y } = parseCellKey(key);
    maxBounds.width = Math.max(maxBounds.width, x + 1);
    maxBounds.height = Math.max(maxBounds.height, y + 1);
    cellsByKey.set(key, {
      x,
      y,
      cellType: 'floor',
      roomId: room.roomId,
      biomeId: room.biomeId,
    });
  }
};

const applyConnectorCells = (
  connector: GeneratedSectionConnector,
  roomById: Map<string, GeneratedSectionRoom>,
  cellsByKey: Map<string, SemanticCell>,
  maxBounds: { width: number; height: number }
) => {
  const connectorCells = createEmptyCellSet();

  for (const segment of connector.segmentBounds) {
    fillRectCells(connectorCells, segment.x, segment.y, segment.width, segment.height);
  }

  const resolvedBiomeId =
    connector.connectedRoomIds
      .map((roomId) => roomById.get(roomId)?.biomeId)
      .find((biomeId): biomeId is string => Boolean(biomeId)) ?? null;

  for (const key of connectorCells) {
    const { x, y } = parseCellKey(key);
    maxBounds.width = Math.max(maxBounds.width, x + 1);
    maxBounds.height = Math.max(maxBounds.height, y + 1);

    if (!cellsByKey.has(key)) {
      cellsByKey.set(key, {
        x,
        y,
        cellType: 'floor',
        roomId: connector.connectedRoomIds[0] ?? null,
        biomeId: resolvedBiomeId,
      });
    }
  }
};

export const buildSemanticMapFromGeneratedSection = (section: GeneratedSection): GeneratedSemanticMap => {
  const roomById = new Map(section.rooms.map((room) => [room.roomId, room] as const));
  const cellsByKey = new Map<string, SemanticCell>();
  const bounds = { width: section.grid.width, height: section.grid.height };

  for (const room of section.rooms) {
    applyRoomCells(room, cellsByKey, bounds);
  }

  for (const connector of section.connectors) {
    applyConnectorCells(connector, roomById, cellsByKey, bounds);
  }

  const transitions: SemanticTransition[] = section.connections
    .map((connection) => {
      const fromRoom = roomById.get(connection.fromRoomId);
      const toRoom = roomById.get(connection.toRoomId);

      if (!fromRoom || !toRoom || fromRoom.biomeId === toRoom.biomeId) {
        return null;
      }

      return {
        fromRoomId: fromRoom.roomId,
        toRoomId: toRoom.roomId,
        fromBiomeId: fromRoom.biomeId,
        toBiomeId: toRoom.biomeId,
        transitionType: 'section_connection',
      } satisfies SemanticTransition;
    })
    .filter((entry): entry is SemanticTransition => entry !== null);

  return {
    mapId: section.sectionId,
    mapSeed: section.seed,
    widthCells: bounds.width,
    heightCells: bounds.height,
    cells: [...cellsByKey.values()].sort((left, right) => left.y - right.y || left.x - right.x),
    rooms: section.rooms.map(createSemanticRoom),
    transitions,
  };
};
