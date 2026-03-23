import type { CardinalDirection, GeneratedSectionRoom, RoomPrimitive } from '../types';

export type CellKey = `${number},${number}`;

export interface BoundarySpan {
  start: number;
  end: number;
  line: number;
}

export const toCellKey = (x: number, y: number): CellKey => `${x},${y}`;

export const parseCellKey = (key: CellKey) => {
  const [x, y] = key.split(',').map(Number);
  return { x, y };
};

export const createEmptyCellSet = () => new Set<CellKey>();

export const addCell = (cells: Set<CellKey>, x: number, y: number) => {
  cells.add(toCellKey(x, y));
};

export const fillRectCells = (
  cells: Set<CellKey>,
  x: number,
  y: number,
  width: number,
  height: number
) => {
  for (let cellY = y; cellY < y + height; cellY++) {
    for (let cellX = x; cellX < x + width; cellX++) {
      addCell(cells, cellX, cellY);
    }
  }
};

const addEllipseCells = (
  cells: Set<CellKey>,
  room: GeneratedSectionRoom,
  innerScale = 0
) => {
  const centerX = room.bounds.x + room.bounds.width / 2;
  const centerY = room.bounds.y + room.bounds.height / 2;
  const radiusX = Math.max(1, room.bounds.width / 2);
  const radiusY = Math.max(1, room.bounds.height / 2);
  const innerRadiusX = radiusX * innerScale;
  const innerRadiusY = radiusY * innerScale;

  for (let cellY = room.bounds.y; cellY < room.bounds.y + room.bounds.height; cellY++) {
    for (let cellX = room.bounds.x; cellX < room.bounds.x + room.bounds.width; cellX++) {
      const normalizedX = (cellX + 0.5 - centerX) / radiusX;
      const normalizedY = (cellY + 0.5 - centerY) / radiusY;
      const outerValue = normalizedX * normalizedX + normalizedY * normalizedY;

      if (outerValue > 1) {
        continue;
      }

      if (innerScale > 0) {
        const innerNormalizedX = (cellX + 0.5 - centerX) / innerRadiusX;
        const innerNormalizedY = (cellY + 0.5 - centerY) / innerRadiusY;
        const innerValue = innerNormalizedX * innerNormalizedX + innerNormalizedY * innerNormalizedY;

        if (innerValue < 1) {
          continue;
        }
      }

      addCell(cells, cellX, cellY);
    }
  }
};

const addPolygonCells = (cells: Set<CellKey>, room: GeneratedSectionRoom, kind: 'hexagon' | 'octagon') => {
  const centerX = room.bounds.x + room.bounds.width / 2;
  const centerY = room.bounds.y + room.bounds.height / 2;
  const radiusX = Math.max(1, room.bounds.width / 2);
  const radiusY = Math.max(1, room.bounds.height / 2);

  for (let cellY = room.bounds.y; cellY < room.bounds.y + room.bounds.height; cellY++) {
    for (let cellX = room.bounds.x; cellX < room.bounds.x + room.bounds.width; cellX++) {
      const normalizedX = Math.abs((cellX + 0.5 - centerX) / radiusX);
      const normalizedY = Math.abs((cellY + 0.5 - centerY) / radiusY);

      const isInside =
        kind === 'hexagon'
          ? normalizedX * 0.78 + normalizedY <= 1
          : Math.max(normalizedX, normalizedY) + Math.min(normalizedX, normalizedY) * 0.38 <= 1;

      if (isInside) {
        addCell(cells, cellX, cellY);
      }
    }
  }
};

const addCompoundCells = (cells: Set<CellKey>, room: GeneratedSectionRoom, primitiveId: string) => {
  const { x, y, width, height } = room.bounds;

  if (primitiveId.startsWith('cross_')) {
    const verticalWidth = Math.max(2, Math.round(width * 0.36));
    const horizontalHeight = Math.max(2, Math.round(height * 0.36));
    fillRectCells(cells, x + Math.floor((width - verticalWidth) / 2), y, verticalWidth, height);
    fillRectCells(cells, x, y + Math.floor((height - horizontalHeight) / 2), width, horizontalHeight);
    return;
  }

  if (primitiveId === 't_shape') {
    const stemWidth = Math.max(2, Math.round(width * 0.34));
    const headHeight = Math.max(3, Math.round(height * 0.42));
    fillRectCells(cells, x, y, width, headHeight);
    fillRectCells(
      cells,
      x + Math.floor((width - stemWidth) / 2),
      y + headHeight - 1,
      stemWidth,
      height - headHeight + 1
    );
    return;
  }

  if (primitiveId === 'l_shape') {
    const armWidth = Math.max(3, Math.round(width * 0.4));
    const armHeight = Math.max(3, Math.round(height * 0.4));
    fillRectCells(cells, x, y, armWidth, height);
    fillRectCells(cells, x, y + height - armHeight, width, armHeight);
    return;
  }

  if (primitiveId === 'u_shape') {
    const armWidth = Math.max(3, Math.round(width * 0.28));
    const baseHeight = Math.max(3, Math.round(height * 0.32));
    fillRectCells(cells, x, y, armWidth, height);
    fillRectCells(cells, x + width - armWidth, y, armWidth, height);
    fillRectCells(cells, x, y + height - baseHeight, width, baseHeight);
    return;
  }

  fillRectCells(cells, x, y, width, height);
};

export const getRoomCells = (room: GeneratedSectionRoom, primitive: RoomPrimitive | undefined) => {
  const cells = createEmptyCellSet();
  const family = primitive?.family ?? 'square';

  if (family === 'circle' || family === 'oval') {
    addEllipseCells(cells, room);
    return cells;
  }

  if (family === 'polygon') {
    addPolygonCells(cells, room, primitive?.id.startsWith('hexagon_') ? 'hexagon' : 'octagon');
    return cells;
  }

  if (family === 'cross' || family === 'compound') {
    addCompoundCells(cells, room, primitive?.id ?? '');
    return cells;
  }

  if (family === 'ring' || primitive?.id === 'ring_room') {
    addEllipseCells(cells, room, 0.5);
    return cells;
  }

  fillRectCells(cells, room.bounds.x, room.bounds.y, room.bounds.width, room.bounds.height);
  return cells;
};

const mergeBoundarySpans = (spans: BoundarySpan[]) => {
  const sorted = [...spans].sort((left, right) =>
    left.line === right.line ? left.start - right.start : left.line - right.line
  );
  const merged: BoundarySpan[] = [];

  for (const span of sorted) {
    const previous = merged[merged.length - 1];

    if (!previous || previous.line !== span.line || span.start > previous.end) {
      merged.push({ ...span });
      continue;
    }

    previous.end = Math.max(previous.end, span.end);
  }

  return merged;
};

const boundarySpansForSide = (roomCells: Set<CellKey>, side: CardinalDirection): BoundarySpan[] => {
  const spans: BoundarySpan[] = [];

  for (const key of roomCells) {
    const { x, y } = parseCellKey(key);

    if (side === 'north' && !roomCells.has(toCellKey(x, y - 1))) {
      spans.push({ line: y, start: x, end: x + 1 });
    }
    if (side === 'south' && !roomCells.has(toCellKey(x, y + 1))) {
      spans.push({ line: y + 1, start: x, end: x + 1 });
    }
    if (side === 'west' && !roomCells.has(toCellKey(x - 1, y))) {
      spans.push({ line: x, start: y, end: y + 1 });
    }
    if (side === 'east' && !roomCells.has(toCellKey(x + 1, y))) {
      spans.push({ line: x + 1, start: y, end: y + 1 });
    }
  }

  return mergeBoundarySpans(spans);
};

export const getOuterBoundarySpans = (roomCells: Set<CellKey>, side: CardinalDirection): BoundarySpan[] => {
  const spans = boundarySpansForSide(roomCells, side);

  if (spans.length === 0) {
    return [];
  }

  const targetLine =
    side === 'north' || side === 'west'
      ? Math.min(...spans.map((span) => span.line))
      : Math.max(...spans.map((span) => span.line));

  return spans.filter((span) => span.line === targetLine);
};

export const clampCoordinateToSpan = (preferred: number, span: BoundarySpan, thickness: number) => {
  const halfThickness = thickness / 2;
  const min = span.start + halfThickness;
  const max = span.end - halfThickness;

  if (min > max) {
    return (span.start + span.end) / 2;
  }

  return Math.max(min, Math.min(preferred, max));
};

export const chooseBoundarySpan = (
  spans: BoundarySpan[],
  preferred: number
): BoundarySpan | null => {
  if (spans.length === 0) {
    return null;
  }

  return (
    [...spans].sort((left, right) => {
      const leftCenter = (left.start + left.end) / 2;
      const rightCenter = (right.start + right.end) / 2;
      return Math.abs(leftCenter - preferred) - Math.abs(rightCenter - preferred);
    })[0] ?? null
  );
};
