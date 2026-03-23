import { contentRegistry } from '../content/contentRegistry';
import {
  createEmptyCellSet,
  fillRectCells,
  getRoomCells,
  parseCellKey,
  toCellKey,
  type CellKey,
} from '../geometry/roomGeometry';
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
const WALL_STROKE = '#17110b';
const WALL_STROKE_WIDTH = 6;
const WALL_MATERIAL_KEY = 'stone_wall';

const cellsToFloorRects = ({
  cells,
  tileSizePx,
  fill,
  regionType,
  materialKey,
  sourceRoomId,
  sourceConnectorId,
}: {
  cells: Set<CellKey>;
  tileSizePx: number;
  fill: string;
  regionType: 'room' | 'connector' | 'courtyard' | 'street';
  materialKey: string;
  sourceRoomId?: string;
  sourceConnectorId?: string;
}): SectionRenderRect[] => {
  const rows = new Map<number, number[]>();

  for (const key of cells) {
    const { x, y } = parseCellKey(key);
    const row = rows.get(y) ?? [];
    row.push(x);
    rows.set(y, row);
  }

  const runsByRow = [...rows.entries()]
    .sort(([leftY], [rightY]) => leftY - rightY)
    .map(([y, xs]) => {
      const sorted = [...xs].sort((left, right) => left - right);
      const runs: Array<{ x: number; width: number; y: number }> = [];
      let runStart = sorted[0];
      let previous = sorted[0];

      for (let index = 1; index < sorted.length; index++) {
        const cellX = sorted[index];
        if (cellX === previous + 1) {
          previous = cellX;
          continue;
        }

        runs.push({ x: runStart, width: previous - runStart + 1, y });
        runStart = cellX;
        previous = cellX;
      }

      if (runStart !== undefined && previous !== undefined) {
        runs.push({ x: runStart, width: previous - runStart + 1, y });
      }

      return runs;
    })
    .flat();

  const merged: Array<{ x: number; y: number; width: number; height: number }> = [];

  for (const run of runsByRow) {
    const previous = merged[merged.length - 1];
    if (
      previous &&
      previous.x === run.x &&
      previous.width === run.width &&
      previous.y + previous.height === run.y
    ) {
      previous.height += 1;
      continue;
    }

    merged.push({ x: run.x, y: run.y, width: run.width, height: 1 });
  }

  return merged.map((rect, index) => ({
    id: `${sourceRoomId ?? sourceConnectorId ?? regionType}_${index}`,
    x: rect.x * tileSizePx,
    y: rect.y * tileSizePx,
    width: rect.width * tileSizePx,
    height: rect.height * tileSizePx,
    fill,
    regionType,
    materialKey,
    sourceRoomId,
    sourceConnectorId,
  }));
};

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

const getRoomRegionType = (room: GeneratedSectionRoom, section: GeneratedSection) =>
  section.sectionKind === 'settlement' && (room.tags.includes('courtyard') || room.tags.includes('hub'))
    ? 'courtyard'
    : 'room';

const getConnectorCells = (connector: GeneratedSectionConnector) => {
  const cells = createEmptyCellSet();

  for (const segment of connector.segmentBounds) {
    fillRectCells(cells, segment.x, segment.y, segment.width, segment.height);
  }

  return cells;
};

const connectorToFloorRects = (
  connector: GeneratedSectionConnector,
  tileSizePx: number,
  section: GeneratedSection
): SectionRenderRect[] =>
  cellsToFloorRects({
    cells: getConnectorCells(connector),
    tileSizePx,
    fill: section.sectionKind === 'settlement' ? '#4d453c' : '#544635',
    regionType: section.sectionKind === 'settlement' ? 'street' : 'connector',
    materialKey:
      section.sectionKind === 'settlement'
        ? 'settlement_street_flagstone'
        : 'dungeon_corridor_floor',
    sourceConnectorId: connector.connectorId,
  });

const mergeWallRuns = (
  buckets: Map<number, Array<{ start: number; end: number }>>,
  orientation: 'horizontal' | 'vertical',
  tileSizePx: number
): SectionRenderLine[] => {
  const lines: SectionRenderLine[] = [];

  for (const [fixed, runs] of [...buckets.entries()].sort(([a], [b]) => a - b)) {
    const sorted = [...runs].sort((left, right) => left.start - right.start);
    let current = sorted[0];

    for (let index = 1; index < sorted.length; index++) {
      const run = sorted[index];
      if (run.start <= current.end) {
        current.end = Math.max(current.end, run.end);
        continue;
      }

      lines.push({
        id: `wall_${orientation}_${fixed}_${lines.length}`,
        points:
          orientation === 'horizontal'
            ? [current.start * tileSizePx, fixed * tileSizePx, current.end * tileSizePx, fixed * tileSizePx]
            : [fixed * tileSizePx, current.start * tileSizePx, fixed * tileSizePx, current.end * tileSizePx],
        stroke: WALL_STROKE,
        strokeWidth: WALL_STROKE_WIDTH,
        surfaceType: 'wall',
        materialKey: WALL_MATERIAL_KEY,
      });
      current = run;
    }

    if (current) {
      lines.push({
        id: `wall_${orientation}_${fixed}_${lines.length}`,
        points:
          orientation === 'horizontal'
            ? [current.start * tileSizePx, fixed * tileSizePx, current.end * tileSizePx, fixed * tileSizePx]
            : [fixed * tileSizePx, current.start * tileSizePx, fixed * tileSizePx, current.end * tileSizePx],
        stroke: WALL_STROKE,
        strokeWidth: WALL_STROKE_WIDTH,
        surfaceType: 'wall',
        materialKey: WALL_MATERIAL_KEY,
      });
    }
  }

  return lines;
};

const roomToWallLines = (
  roomCells: Set<CellKey>,
  connectorCells: Set<CellKey>,
  tileSizePx: number
): SectionRenderLine[] => {
  const horizontalRuns = new Map<number, Array<{ start: number; end: number }>>();
  const verticalRuns = new Map<number, Array<{ start: number; end: number }>>();

  const addHorizontal = (y: number, start: number, end: number) => {
    const runs = horizontalRuns.get(y) ?? [];
    runs.push({ start, end });
    horizontalRuns.set(y, runs);
  };

  const addVertical = (x: number, start: number, end: number) => {
    const runs = verticalRuns.get(x) ?? [];
    runs.push({ start, end });
    verticalRuns.set(x, runs);
  };

  for (const key of roomCells) {
    const { x, y } = parseCellKey(key);

    if (!roomCells.has(toCellKey(x, y - 1)) && !connectorCells.has(toCellKey(x, y - 1))) {
      addHorizontal(y, x, x + 1);
    }
    if (!roomCells.has(toCellKey(x + 1, y)) && !connectorCells.has(toCellKey(x + 1, y))) {
      addVertical(x + 1, y, y + 1);
    }
    if (!roomCells.has(toCellKey(x, y + 1)) && !connectorCells.has(toCellKey(x, y + 1))) {
      addHorizontal(y + 1, x, x + 1);
    }
    if (!roomCells.has(toCellKey(x - 1, y)) && !connectorCells.has(toCellKey(x - 1, y))) {
      addVertical(x, y, y + 1);
    }
  }

  return [
    ...mergeWallRuns(horizontalRuns, 'horizontal', tileSizePx),
    ...mergeWallRuns(verticalRuns, 'vertical', tileSizePx),
  ];
};

const getRoomCenter = (room: GeneratedSectionRoom, tileSizePx: number) => ({
  x: (room.bounds.x + room.bounds.width / 2) * tileSizePx,
  y: (room.bounds.y + room.bounds.height / 2) * tileSizePx,
});

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
  const primitiveMap = new Map(
    contentRegistry
      .loadPack('room_primitives')
      .roomPrimitives.map((primitive) => [primitive.id, primitive] as const)
  );
  const connectorFloors = section.connectors.flatMap((connector) =>
    connectorToFloorRects(connector, tileSizePx, section)
  );
  const connectorCells = createEmptyCellSet();

  for (const connector of section.connectors) {
    for (const key of getConnectorCells(connector)) {
      connectorCells.add(key);
    }
  }

  const roomCellsById = new Map(
    section.rooms.map((room) => [room.roomId, getRoomCells(room, primitiveMap.get(room.primitiveId))] as const)
  );

  return {
    width: section.grid.width * tileSizePx,
    height: section.grid.height * tileSizePx,
    tileSizePx,
    backgroundColor: '#050505',
    floors: [
      ...connectorFloors,
      ...section.rooms.flatMap((room) =>
        cellsToFloorRects({
          cells: roomCellsById.get(room.roomId) ?? createEmptyCellSet(),
          tileSizePx,
          fill: getRoomFill(room, section),
          regionType: getRoomRegionType(room, section),
          materialKey: getRoomMaterialKey(room, section),
          sourceRoomId: room.roomId,
        })
      ),
    ],
    walls: section.rooms.flatMap((room) =>
      roomToWallLines(roomCellsById.get(room.roomId) ?? createEmptyCellSet(), connectorCells, tileSizePx)
    ),
    doors: [],
    markers: buildMarkers(section, tileSizePx),
    hazards: [],
    objects: [],
    atmosphere: null,
  };
};
