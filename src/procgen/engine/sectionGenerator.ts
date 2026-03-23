import { contentRegistry } from '../content/contentRegistry';
import {
  chooseBoundarySpan,
  clampCoordinateToSpan,
  getOuterBoundarySpans,
  getRoomCells,
  type BoundarySpan,
} from '../geometry/roomGeometry';
import type {
  CardinalDirection,
  GeneratedConnectorAnchor,
  GeneratedSectionConnector,
  GeneratedSection,
  GeneratedSectionConnection,
  GeneratedSectionInput,
  GeneratedSectionRoom,
  RectBounds,
  RoomPrimitive,
  SectionKind,
} from '../types';
import { createSeededRandom, deriveSectionSeed } from './seed';
import { getLayoutPresets } from './layoutPresets';
import { placeRoomsForPreset } from './roomPlacement';
import { assignRooms } from './roomAssignment';

const chooseSectionKind = (sectionKind: SectionKind | undefined): SectionKind => {
  return sectionKind ?? 'exploration';
};

const resolveConnectorThickness = (baseThickness: number, runLengths: number[]) => {
  const boundedRuns = runLengths
    .map((runLength) => Math.max(1, Math.round(runLength)))
    .filter((runLength) => runLength > 0);

  const maxAllowedThickness =
    boundedRuns.length > 0 ? Math.min(...boundedRuns) : 1;

  return Math.max(1, Math.min(baseThickness, maxAllowedThickness));
};

interface RoomGeometry {
  room: GeneratedSectionRoom;
  sideSpans: Record<CardinalDirection, BoundarySpan[]>;
}

const createRoomGeometry = (room: GeneratedSectionRoom, primitive: RoomPrimitive | undefined): RoomGeometry => {
  const cells = getRoomCells(room, primitive);

  return {
    room,
    sideSpans: {
      north: getOuterBoundarySpans(cells, 'north'),
      south: getOuterBoundarySpans(cells, 'south'),
      east: getOuterBoundarySpans(cells, 'east'),
      west: getOuterBoundarySpans(cells, 'west'),
    },
  };
};

const chooseSpanOverlap = (
  leftSpans: BoundarySpan[],
  rightSpans: BoundarySpan[],
  preferred: number
) => {
  const overlaps = leftSpans.flatMap((leftSpan) =>
    rightSpans.flatMap((rightSpan) => {
      const start = Math.max(leftSpan.start, rightSpan.start);
      const end = Math.min(leftSpan.end, rightSpan.end);

      if (end - start < 1) {
        return [];
      }

      return [
        {
          leftSpan,
          rightSpan,
          start,
          end,
        },
      ];
    })
  );

  if (overlaps.length === 0) {
    return null;
  }

  return (
    overlaps.sort((left, right) => {
      const leftCenter = (left.start + left.end) / 2;
      const rightCenter = (right.start + right.end) / 2;
      return Math.abs(leftCenter - preferred) - Math.abs(rightCenter - preferred);
    })[0] ?? null
  );
};

const buildAnchorFromSpan = (
  roomId: string,
  side: CardinalDirection,
  span: BoundarySpan,
  preferred: number,
  thickness: number
): GeneratedConnectorAnchor => {
  const coordinate = clampCoordinateToSpan(preferred, span, thickness);

  if (side === 'north' || side === 'south') {
    return {
      roomId,
      side,
      x: coordinate,
      y: span.line,
    };
  }

  return {
    roomId,
    side,
    x: span.line,
    y: coordinate,
  };
};

const createHorizontalSegment = (
  startX: number,
  endX: number,
  centerY: number,
  thickness: number
): RectBounds => ({
  x: Math.min(startX, endX),
  y: Math.round(centerY - thickness / 2),
  width: Math.max(thickness, Math.abs(endX - startX)),
  height: thickness,
});

const createVerticalSegment = (
  centerX: number,
  startY: number,
  endY: number,
  thickness: number
): RectBounds => ({
  x: Math.round(centerX - thickness / 2),
  y: Math.min(startY, endY),
  width: thickness,
  height: Math.max(thickness, Math.abs(endY - startY)),
});

const buildStraightConnector = ({
  connectorId,
  fromGeometry,
  toGeometry,
  sectionKind,
}: {
  connectorId: string;
  fromGeometry: RoomGeometry;
  toGeometry: RoomGeometry;
  sectionKind: SectionKind;
}): GeneratedSectionConnector | null => {
  const baseThickness = sectionKind === 'settlement' ? 3 : 2;
  const fromRoom = fromGeometry.room;
  const toRoom = toGeometry.room;
  const fromCenterX = fromRoom.bounds.x + fromRoom.bounds.width / 2;
  const fromCenterY = fromRoom.bounds.y + fromRoom.bounds.height / 2;
  const toCenterX = toRoom.bounds.x + toRoom.bounds.width / 2;
  const toCenterY = toRoom.bounds.y + toRoom.bounds.height / 2;

  const fromOnLeft = fromCenterX <= toCenterX;
  const horizontalOverlap = chooseSpanOverlap(
    fromOnLeft ? fromGeometry.sideSpans.east : fromGeometry.sideSpans.west,
    fromOnLeft ? toGeometry.sideSpans.west : toGeometry.sideSpans.east,
    (fromCenterY + toCenterY) / 2
  );

  if (horizontalOverlap) {
    const targetY = (horizontalOverlap.start + horizontalOverlap.end) / 2;
    const initialLeftAnchor = buildAnchorFromSpan(
      fromRoom.roomId,
      fromOnLeft ? 'east' : 'west',
      horizontalOverlap.leftSpan,
      targetY,
      1
    );
    const initialRightAnchor = buildAnchorFromSpan(
      toRoom.roomId,
      fromOnLeft ? 'west' : 'east',
      horizontalOverlap.rightSpan,
      targetY,
      1
    );
    const thickness = resolveConnectorThickness(baseThickness, [
      Math.abs(initialRightAnchor.x - initialLeftAnchor.x),
      horizontalOverlap.end - horizontalOverlap.start,
    ]);
    const leftAnchor = buildAnchorFromSpan(
      fromRoom.roomId,
      fromOnLeft ? 'east' : 'west',
      horizontalOverlap.leftSpan,
      targetY,
      thickness
    );
    const rightAnchor = buildAnchorFromSpan(
      toRoom.roomId,
      fromOnLeft ? 'west' : 'east',
      horizontalOverlap.rightSpan,
      targetY,
      thickness
    );

    return {
      connectorId,
      primitiveId:
        Math.abs(rightAnchor.x - leftAnchor.x) >= 10
          ? 'straight_corridor_long'
          : 'straight_corridor_short',
      family: 'corridor',
      segmentBounds: [createHorizontalSegment(leftAnchor.x, rightAnchor.x, targetY, thickness)],
      connectedRoomIds: [fromRoom.roomId, toRoom.roomId],
      roomAnchors: [leftAnchor, rightAnchor],
      tags: [sectionKind === 'settlement' ? 'street' : 'corridor'],
    };
  }

  const fromOnTop = fromCenterY <= toCenterY;
  const verticalOverlap = chooseSpanOverlap(
    fromOnTop ? fromGeometry.sideSpans.south : fromGeometry.sideSpans.north,
    fromOnTop ? toGeometry.sideSpans.north : toGeometry.sideSpans.south,
    (fromCenterX + toCenterX) / 2
  );

  if (verticalOverlap) {
    const targetX = (verticalOverlap.start + verticalOverlap.end) / 2;
    const initialTopAnchor = buildAnchorFromSpan(
      fromRoom.roomId,
      fromOnTop ? 'south' : 'north',
      verticalOverlap.leftSpan,
      targetX,
      1
    );
    const initialBottomAnchor = buildAnchorFromSpan(
      toRoom.roomId,
      fromOnTop ? 'north' : 'south',
      verticalOverlap.rightSpan,
      targetX,
      1
    );
    const thickness = resolveConnectorThickness(baseThickness, [
      Math.abs(initialBottomAnchor.y - initialTopAnchor.y),
      verticalOverlap.end - verticalOverlap.start,
    ]);
    const topAnchor = buildAnchorFromSpan(
      fromRoom.roomId,
      fromOnTop ? 'south' : 'north',
      verticalOverlap.leftSpan,
      targetX,
      thickness
    );
    const bottomAnchor = buildAnchorFromSpan(
      toRoom.roomId,
      fromOnTop ? 'north' : 'south',
      verticalOverlap.rightSpan,
      targetX,
      thickness
    );

    return {
      connectorId,
      primitiveId:
        Math.abs(bottomAnchor.y - topAnchor.y) >= 10
          ? 'straight_corridor_long'
          : 'straight_corridor_short',
      family: 'corridor',
      segmentBounds: [createVerticalSegment(targetX, topAnchor.y, bottomAnchor.y, thickness)],
      connectedRoomIds: [fromRoom.roomId, toRoom.roomId],
      roomAnchors: [topAnchor, bottomAnchor],
      tags: [sectionKind === 'settlement' ? 'street' : 'corridor'],
    };
  }

  return null;
};

const buildBentConnector = ({
  connectorId,
  fromGeometry,
  toGeometry,
  sectionKind,
}: {
  connectorId: string;
  fromGeometry: RoomGeometry;
  toGeometry: RoomGeometry;
  sectionKind: SectionKind;
}): GeneratedSectionConnector => {
  const baseThickness = sectionKind === 'settlement' ? 3 : 2;
  const fromRoom = fromGeometry.room;
  const toRoom = toGeometry.room;
  const fromCenterX = Math.floor(fromRoom.bounds.x + fromRoom.bounds.width / 2);
  const fromCenterY = Math.floor(fromRoom.bounds.y + fromRoom.bounds.height / 2);
  const toCenterX = Math.floor(toRoom.bounds.x + toRoom.bounds.width / 2);
  const toCenterY = Math.floor(toRoom.bounds.y + toRoom.bounds.height / 2);
  const horizontalFirst = Math.abs(toCenterX - fromCenterX) >= Math.abs(toCenterY - fromCenterY);

  if (horizontalFirst) {
    const fromSide: CardinalDirection = toCenterX >= fromCenterX ? 'east' : 'west';
    const toSide: CardinalDirection = toCenterY >= fromCenterY ? 'north' : 'south';
    const fromSpan = chooseBoundarySpan(fromGeometry.sideSpans[fromSide], fromCenterY);
    const toSpan = chooseBoundarySpan(toGeometry.sideSpans[toSide], toCenterX);

    if (!fromSpan || !toSpan) {
      return {
        connectorId,
        primitiveId: 'straight_corridor_short',
        family: 'corridor',
        segmentBounds: [],
        connectedRoomIds: [fromRoom.roomId, toRoom.roomId],
        roomAnchors: [],
        tags: [sectionKind === 'settlement' ? 'street' : 'corridor'],
      };
    }

    const initialFromAnchor = buildAnchorFromSpan(fromRoom.roomId, fromSide, fromSpan, fromCenterY, 1);
    const initialToAnchor = buildAnchorFromSpan(toRoom.roomId, toSide, toSpan, toCenterX, 1);
    const initialElbowX = initialToAnchor.x;
    const initialElbowY = initialFromAnchor.y;
    const thickness = resolveConnectorThickness(baseThickness, [
      Math.abs(initialElbowX - initialFromAnchor.x),
      Math.abs(initialToAnchor.y - initialElbowY),
      fromSpan.end - fromSpan.start,
      toSpan.end - toSpan.start,
    ]);
    const fromAnchor = buildAnchorFromSpan(fromRoom.roomId, fromSide, fromSpan, fromCenterY, thickness);
    const toAnchor = buildAnchorFromSpan(toRoom.roomId, toSide, toSpan, toCenterX, thickness);
    const elbowX = toAnchor.x;
    const elbowY = fromAnchor.y;

    return {
      connectorId,
      primitiveId: 'bent_corridor',
      family: 'corridor',
      segmentBounds: [
        createHorizontalSegment(fromAnchor.x, elbowX, elbowY, thickness),
        createVerticalSegment(elbowX, elbowY, toAnchor.y, thickness),
      ],
      connectedRoomIds: [fromRoom.roomId, toRoom.roomId],
      roomAnchors: [fromAnchor, toAnchor],
      tags: [sectionKind === 'settlement' ? 'street' : 'corridor', 'turn'],
    };
  }

  const fromSide: CardinalDirection = toCenterY >= fromCenterY ? 'south' : 'north';
  const toSide: CardinalDirection = toCenterX >= fromCenterX ? 'west' : 'east';
  const fromSpan = chooseBoundarySpan(fromGeometry.sideSpans[fromSide], fromCenterX);
  const toSpan = chooseBoundarySpan(toGeometry.sideSpans[toSide], toCenterY);

  if (!fromSpan || !toSpan) {
    return {
      connectorId,
      primitiveId: 'straight_corridor_short',
      family: 'corridor',
      segmentBounds: [],
      connectedRoomIds: [fromRoom.roomId, toRoom.roomId],
      roomAnchors: [],
      tags: [sectionKind === 'settlement' ? 'street' : 'corridor'],
    };
  }

  const initialFromAnchor = buildAnchorFromSpan(fromRoom.roomId, fromSide, fromSpan, fromCenterX, 1);
  const initialToAnchor = buildAnchorFromSpan(toRoom.roomId, toSide, toSpan, toCenterY, 1);
  const initialElbowX = initialFromAnchor.x;
  const initialElbowY = initialToAnchor.y;
  const thickness = resolveConnectorThickness(baseThickness, [
    Math.abs(initialElbowY - initialFromAnchor.y),
    Math.abs(initialToAnchor.x - initialElbowX),
    fromSpan.end - fromSpan.start,
    toSpan.end - toSpan.start,
  ]);
  const fromAnchor = buildAnchorFromSpan(fromRoom.roomId, fromSide, fromSpan, fromCenterX, thickness);
  const toAnchor = buildAnchorFromSpan(toRoom.roomId, toSide, toSpan, toCenterY, thickness);
  const elbowX = fromAnchor.x;
  const elbowY = toAnchor.y;

  return {
    connectorId,
    primitiveId: 'bent_corridor',
    family: 'corridor',
    segmentBounds: [
      createVerticalSegment(elbowX, fromAnchor.y, elbowY, thickness),
      createHorizontalSegment(elbowX, toAnchor.x, elbowY, thickness),
    ],
    connectedRoomIds: [fromRoom.roomId, toRoom.roomId],
    roomAnchors: [fromAnchor, toAnchor],
    tags: [sectionKind === 'settlement' ? 'street' : 'corridor', 'turn'],
  };
};

const buildSectionConnectors = ({
  rooms,
  connections,
  sectionKind,
  primitiveMap,
}: {
  rooms: GeneratedSectionRoom[];
  connections: GeneratedSectionConnection[];
  sectionKind: SectionKind;
  primitiveMap: Map<string, RoomPrimitive>;
}): GeneratedSectionConnector[] => {
  const roomGeometryById = new Map(
    rooms.map((room) => [room.roomId, createRoomGeometry(room, primitiveMap.get(room.primitiveId))])
  );

  return connections.flatMap((connection) => {
    const fromGeometry = roomGeometryById.get(connection.fromRoomId);
    const toGeometry = roomGeometryById.get(connection.toRoomId);

    if (!fromGeometry || !toGeometry) {
      return [];
    }

    const connector =
      buildStraightConnector({
        connectorId: `connector_${connection.connectionId}`,
        fromGeometry,
        toGeometry,
        sectionKind,
      }) ??
      buildBentConnector({
        connectorId: `connector_${connection.connectionId}`,
        fromGeometry,
        toGeometry,
        sectionKind,
      });

    return connector.segmentBounds.length > 0 ? [connector] : [];
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
    primitiveMap: new Map(
      roomPrimitivePack.roomPrimitives.map((primitive) => [primitive.id, primitive] as const)
    ),
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
