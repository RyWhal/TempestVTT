import type {
  GeneratedSection,
  GeneratedSectionConnector,
  GeneratedSectionRoom,
  SectionRenderLine,
  SectionRenderMarker,
  SectionRenderPayload,
  SectionRenderRect,
} from '../types';

const DEFAULT_TILE_SIZE_PX = 28;

const alignToTile = (value: number, tileSizePx: number) =>
  Math.round(value / tileSizePx) * tileSizePx;

const getRoomMaterialKey = (room: GeneratedSectionRoom, section: GeneratedSection) => {
  if (section.sectionKind === 'settlement') {
    if (room.tags.includes('courtyard') || room.tags.includes('hub')) {
      return 'settlement_courtyard_flagstone';
    }
    if (room.tags.includes('service')) {
      return 'settlement_service_floor';
    }
    if (room.tags.includes('residence')) {
      return 'settlement_residence_floor';
    }
    if (room.tags.includes('landmark')) {
      return 'settlement_landmark_floor';
    }

    return 'settlement_room_floor';
  }

  return room.tags.includes('landmark') ? 'dungeon_landmark_floor' : 'dungeon_room_floor';
};

const getRoomFill = (room: GeneratedSectionRoom, section: GeneratedSection) => {
  if (section.sectionKind === 'settlement') {
    if (room.tags.includes('courtyard') || room.tags.includes('hub')) {
      return '#75654c';
    }
    if (room.tags.includes('service')) {
      return '#685643';
    }
    if (room.tags.includes('residence')) {
      return '#5b4b3b';
    }
  }

  return room.tags.includes('landmark') ? '#7a6448' : '#66533f';
};

const roomToFloorRect = (
  room: GeneratedSectionRoom,
  tileSizePx: number,
  section: GeneratedSection
): SectionRenderRect => ({
  id: `floor_${room.roomId}`,
  x: room.bounds.x * tileSizePx,
  y: room.bounds.y * tileSizePx,
  width: room.bounds.width * tileSizePx,
  height: room.bounds.height * tileSizePx,
  fill: getRoomFill(room, section),
  stroke: '#2c2219',
  strokeWidth: 2,
  regionType:
    section.sectionKind === 'settlement' && (room.tags.includes('courtyard') || room.tags.includes('hub'))
      ? 'courtyard'
      : 'room',
  materialKey: getRoomMaterialKey(room, section),
});

const roomToWallLines = (
  room: GeneratedSectionRoom,
  tileSizePx: number
): SectionRenderLine[] => {
  const left = room.bounds.x * tileSizePx;
  const top = room.bounds.y * tileSizePx;
  const right = (room.bounds.x + room.bounds.width) * tileSizePx;
  const bottom = (room.bounds.y + room.bounds.height) * tileSizePx;

  return [
    { id: `wall_${room.roomId}_n`, points: [left, top, right, top], stroke: '#17110b', strokeWidth: 6, surfaceType: 'wall', materialKey: 'stone_wall' },
    { id: `wall_${room.roomId}_e`, points: [right, top, right, bottom], stroke: '#17110b', strokeWidth: 6, surfaceType: 'wall', materialKey: 'stone_wall' },
    { id: `wall_${room.roomId}_s`, points: [left, bottom, right, bottom], stroke: '#17110b', strokeWidth: 6, surfaceType: 'wall', materialKey: 'stone_wall' },
    { id: `wall_${room.roomId}_w`, points: [left, top, left, bottom], stroke: '#17110b', strokeWidth: 6, surfaceType: 'wall', materialKey: 'stone_wall' },
  ];
};

const getRoomCenter = (room: GeneratedSectionRoom, tileSizePx: number) => ({
  x: (room.bounds.x + room.bounds.width / 2) * tileSizePx,
  y: (room.bounds.y + room.bounds.height / 2) * tileSizePx,
});

const buildConnectionDoor = (
  fromRoom: GeneratedSectionRoom,
  toRoom: GeneratedSectionRoom,
  tileSizePx: number
): SectionRenderLine => {
  const fromCenter = getRoomCenter(fromRoom, tileSizePx);
  const toCenter = getRoomCenter(toRoom, tileSizePx);
  const horizontal = Math.abs(toCenter.x - fromCenter.x) >= Math.abs(toCenter.y - fromCenter.y);
  const doorHalf = tileSizePx * 0.2;

  if (horizontal) {
    const x =
      fromCenter.x < toCenter.x
        ? (fromRoom.bounds.x + fromRoom.bounds.width) * tileSizePx
        : fromRoom.bounds.x * tileSizePx;
    return {
      id: `door_${fromRoom.roomId}_${toRoom.roomId}`,
      points: [x, fromCenter.y - doorHalf, x, fromCenter.y + doorHalf],
      stroke: '#b98a4f',
      strokeWidth: 4,
      surfaceType: 'threshold',
      materialKey: 'wood_threshold',
    };
  }

  const y =
    fromCenter.y < toCenter.y
      ? (fromRoom.bounds.y + fromRoom.bounds.height) * tileSizePx
      : fromRoom.bounds.y * tileSizePx;
  return {
    id: `door_${fromRoom.roomId}_${toRoom.roomId}`,
    points: [fromCenter.x - doorHalf, y, fromCenter.x + doorHalf, y],
    stroke: '#b98a4f',
    strokeWidth: 4,
    surfaceType: 'threshold',
    materialKey: 'wood_threshold',
  };
};

const connectorToFloorRects = (
  connector: GeneratedSectionConnector,
  tileSizePx: number,
  section: GeneratedSection
): SectionRenderRect[] =>
  connector.segmentBounds.map((segment, index) => ({
    id: `${connector.connectorId}_${index}`,
    x: alignToTile(segment.x * tileSizePx, tileSizePx),
    y: alignToTile(segment.y * tileSizePx, tileSizePx),
    width: Math.max(tileSizePx, alignToTile(segment.width * tileSizePx, tileSizePx)),
    height: Math.max(tileSizePx, alignToTile(segment.height * tileSizePx, tileSizePx)),
    fill: section.sectionKind === 'settlement' ? '#4d453c' : '#544635',
    regionType: section.sectionKind === 'settlement' ? 'street' : 'connector',
    materialKey:
      section.sectionKind === 'settlement'
        ? 'settlement_street_flagstone'
        : 'dungeon_corridor_floor',
  }));

const buildMarkers = (
  section: GeneratedSection,
  tileSizePx: number
): SectionRenderMarker[] =>
  section.rooms.flatMap((room) => {
    const center = getRoomCenter(room, tileSizePx);
    const markers: SectionRenderMarker[] = [];

    if (room.isEntrance) {
      markers.push({
        id: `marker_entrance_${room.roomId}`,
        kind: 'entrance',
        x: center.x,
        y: center.y,
        radius: tileSizePx * 0.18,
        fill: '#4ade80',
        materialKey: 'entrance_marker',
      });
    }

    if (room.isExit) {
      markers.push({
        id: `marker_exit_${room.roomId}`,
        kind: 'exit',
        x: center.x,
        y: center.y,
        radius: tileSizePx * 0.18,
        fill: '#f59e0b',
        materialKey: 'exit_marker',
      });
    }

    return markers;
  });

export const buildSectionRenderPayload = (
  section: GeneratedSection,
  tileSizePx = DEFAULT_TILE_SIZE_PX
): SectionRenderPayload => {
  const roomById = new Map(section.rooms.map((room) => [room.roomId, room]));
  const connectorFloors = section.connectors.flatMap((connector) =>
    connectorToFloorRects(connector, tileSizePx, section)
  );

  return {
    width: section.grid.width * tileSizePx,
    height: section.grid.height * tileSizePx,
    tileSizePx,
    backgroundColor: '#050505',
    floors: [
      ...connectorFloors,
      ...section.rooms.map((room) => roomToFloorRect(room, tileSizePx, section)),
    ],
    walls: section.rooms.flatMap((room) => roomToWallLines(room, tileSizePx)),
    doors: section.connections.flatMap((connection) => {
      const fromRoom = roomById.get(connection.fromRoomId);
      const toRoom = roomById.get(connection.toRoomId);

      if (!fromRoom || !toRoom) {
        return [];
      }

      return [buildConnectionDoor(fromRoom, toRoom, tileSizePx)];
    }),
    markers: buildMarkers(section, tileSizePx),
    hazards: [],
    objects: [],
    atmosphere: null,
  };
};
