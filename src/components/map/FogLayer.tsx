import React, { useMemo } from 'react';
import { Group, Rect, Line } from 'react-konva';
import type { FogRegion } from '../../types';

interface FogLayerProps {
  width: number;
  height: number;
  fogData: FogRegion[];
  defaultState: 'fogged' | 'revealed';
  isGM: boolean;
  currentStroke: { x: number; y: number }[];
  currentBrushSize: number;
  currentMode: 'reveal' | 'hide' | null;
}

export const FogLayer: React.FC<FogLayerProps> = ({
  width,
  height,
  fogData,
  defaultState,
  isGM,
  currentStroke,
  currentBrushSize,
  currentMode,
}) => {
  // For GM: show fog as semi-transparent
  // For players: show fog as solid
  const fogOpacity = isGM ? 0.5 : 1;
  const fogColor = '#000000';

  // Render fog using composite operations
  // This is simplified - a more complex implementation would use canvas clipping
  const fogElements = useMemo(() => {
    const elements: JSX.Element[] = [];

    const isAxisAlignedRect = (points: FogRegion['points']) => {
      if (points.length !== 5) return false;
      const [first, ...rest] = points;
      const last = rest[rest.length - 1];
      if (!last || first.x !== last.x || first.y !== last.y) return false;
      const uniqueX = new Set(points.map((p) => p.x));
      const uniqueY = new Set(points.map((p) => p.y));
      return uniqueX.size === 2 && uniqueY.size === 2;
    };

    // Base fog layer if default is fogged
    if (defaultState === 'fogged') {
      elements.push(
        <Rect
          key="base-fog"
          x={0}
          y={0}
          width={width}
          height={height}
          fill={fogColor}
          opacity={fogOpacity}
          listening={false}
        />
      );
    }

    // Render fog regions as thick lines
    fogData.forEach((region, idx) => {
      if (region.points.length < 2) return;

      if (isAxisAlignedRect(region.points)) {
        const xs = region.points.map((point) => point.x);
        const ys = region.points.map((point) => point.y);
        const minX = Math.min(...xs);
        const minY = Math.min(...ys);
        const maxX = Math.max(...xs);
        const maxY = Math.max(...ys);
        const width = maxX - minX;
        const height = maxY - minY;

        elements.push(
          <Rect
            key={`${region.type}-rect-${idx}`}
            x={minX}
            y={minY}
            width={width}
            height={height}
            fill={fogColor}
            opacity={region.type === 'hide' ? fogOpacity : 1}
            listening={false}
            globalCompositeOperation={
              region.type === 'reveal' ? 'destination-out' : 'source-over'
            }
          />
        );
        return;
      }

      const flatPoints = region.points.flatMap((p) => [p.x, p.y]);

      if (region.type === 'reveal') {
        // For reveal, we need to "cut out" the fog
        // Since Konva doesn't support true clipping easily, we'll draw reveal areas in a different color
        // This is a simplified approach - production would use custom shape with globalCompositeOperation
        elements.push(
          <Line
            key={`reveal-${idx}`}
            points={flatPoints}
            stroke={'#000000'}
            strokeWidth={region.brushSize}
            lineCap="round"
            lineJoin="round"
            listening={false}
            globalCompositeOperation="destination-out"
          />
        );
      } else {
        // For hide, draw fog
        elements.push(
          <Line
            key={`hide-${idx}`}
            points={flatPoints}
            stroke={fogColor}
            strokeWidth={region.brushSize}
            lineCap="round"
            lineJoin="round"
            opacity={fogOpacity}
            listening={false}
          />
        );
      }
    });

    return elements;
  }, [width, height, fogData, defaultState, fogOpacity, isGM]);

  // Current stroke preview
  const currentStrokeElement = useMemo(() => {
    if (currentStroke.length < 2 || !currentMode) return null;

    const flatPoints = currentStroke.flatMap((p) => [p.x, p.y]);
    const color = currentMode === 'reveal' ? 'rgba(0, 255, 0, 0.5)' : 'rgba(0, 0, 0, 0.5)';

    return (
      <Line
        points={flatPoints}
        stroke={color}
        strokeWidth={currentBrushSize}
        lineCap="round"
        lineJoin="round"
        listening={false}
      />
    );
  }, [currentStroke, currentBrushSize, currentMode]);

  return (
    <Group listening={false}>
      {fogElements}
      {currentStrokeElement}
    </Group>
  );
};
