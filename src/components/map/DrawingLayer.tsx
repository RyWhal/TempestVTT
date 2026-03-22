import React from 'react';
import { Line, Rect, Circle, RegularPolygon, Group, Text } from 'react-konva';
import type { DrawingRegion } from '../../types';

interface DrawingLayerProps {
  drawings: DrawingRegion[];
  isGM: boolean;
  currentDrawing?: DrawingRegion | null;
}

const getOpacityForRole = (authorRole: DrawingRegion['authorRole']) =>
  authorRole === 'gm' ? 0.9 : 0.7;

const flattenPoints = (points: { x: number; y: number }[]) =>
  points.flatMap((point) => [point.x, point.y]);

const getBoundsFromPoints = (points: { x: number; y: number }[]) => {
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return { minX, minY, maxX, maxY };
};

const renderDrawing = (drawing: DrawingRegion) => {
  const { points, color, strokeWidth, filled, shape, id } = drawing;
  const { minX, minY, maxX, maxY } = getBoundsFromPoints(points);
  const width = maxX - minX;
  const height = maxY - minY;
  const size = Math.max(width, height);
  const centerX = minX + width / 2;
  const centerY = minY + height / 2;

  if (shape === 'free' || shape === 'line') {
    return (
      <Line
        key={id}
        points={flattenPoints(points)}
        stroke={color}
        strokeWidth={strokeWidth}
        lineCap="round"
        lineJoin="round"
        tension={shape === 'free' ? 0.4 : 0}
      />
    );
  }

  if (shape === 'square') {
    return (
      <Rect
        key={id}
        x={minX}
        y={minY}
        width={size}
        height={size}
        stroke={color}
        strokeWidth={strokeWidth}
        fill={filled ? color : undefined}
        opacity={filled ? 0.25 : 1}
      />
    );
  }

  if (shape === 'emoji') {
    const anchor = points[0];
    const fontSize = Math.max(20, strokeWidth * 8 * (drawing.emojiScale ?? 1));
    return (
      <Text
        key={id}
        x={anchor.x - fontSize / 2}
        y={anchor.y - fontSize / 2}
        text={drawing.emoji || '✨'}
        fontSize={fontSize}
      />
    );
  }

  if (shape === 'circle') {
    return (
      <Circle
        key={id}
        x={centerX}
        y={centerY}
        radius={size / 2}
        stroke={color}
        strokeWidth={strokeWidth}
        fill={filled ? color : undefined}
        opacity={filled ? 0.25 : 1}
      />
    );
  }

  return (
    <RegularPolygon
      key={id}
      x={centerX}
      y={centerY}
      sides={3}
      radius={size / 2}
      stroke={color}
      strokeWidth={strokeWidth}
      fill={filled ? color : undefined}
      opacity={filled ? 0.25 : 1}
    />
  );
};

export const DrawingLayer: React.FC<DrawingLayerProps> = ({
  drawings,
  isGM,
  currentDrawing,
}) => {
  const visibleDrawings = drawings.filter(
    (drawing) => isGM || drawing.authorRole === 'gm' || drawing.authorRole === 'player'
  );

  return (
    <Group listening={false} globalCompositeOperation="source-over">
      {visibleDrawings.map((drawing) => (
        <Group key={drawing.id} opacity={getOpacityForRole(drawing.authorRole)}>
          {renderDrawing(drawing)}
        </Group>
      ))}
      {currentDrawing && (
        <Group opacity={getOpacityForRole(currentDrawing.authorRole)}>
          {renderDrawing(currentDrawing)}
        </Group>
      )}
    </Group>
  );
};
