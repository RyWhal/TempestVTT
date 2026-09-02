import React, { useEffect, useState, useMemo } from 'react';
import { Image as KonvaImage, Group, Line, Rect } from 'react-konva';
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
  rectStart?: { x: number; y: number } | null;
  rectEnd?: { x: number; y: number } | null;
  fogToolShape?: 'brush' | 'rectangle';
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
  rectStart,
  rectEnd,
  fogToolShape,
}) => {
  // For GM: show fog as semi-transparent (0.5 opacity)
  // For players: show fog as solid (1.0 opacity)
  const fogOpacity = isGM ? 0.5 : 1;
  const [maskCanvas, setMaskCanvas] = useState<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (width <= 0 || height <= 0) return;

    // Create offscreen canvas for single-layer fog compositing
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(width);
    canvas.height = Math.ceil(height);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 1. Fill base initial fog state
    if (defaultState === 'fogged') {
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, width, height);
    } else {
      ctx.clearRect(0, 0, width, height);
    }

    const isAxisAlignedRect = (points: FogRegion['points']) => {
      if (points.length !== 5) return false;
      const [first, ...rest] = points;
      const last = rest[rest.length - 1];
      if (!last || first.x !== last.x || first.y !== last.y) return false;
      const uniqueX = new Set(points.map((p) => p.x));
      const uniqueY = new Set(points.map((p) => p.y));
      return uniqueX.size === 2 && uniqueY.size === 2;
    };

    // 2. Merge/composite all fog regions into ONE single mask layer
    fogData.forEach((region) => {
      if (region.points.length < 2) return;

      if (region.type === 'reveal') {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.fillStyle = '#000000';
        ctx.strokeStyle = '#000000';
      } else {
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = '#000000';
        ctx.strokeStyle = '#000000';
      }

      if (isAxisAlignedRect(region.points)) {
        const xs = region.points.map((p) => p.x);
        const ys = region.points.map((p) => p.y);
        const minX = Math.min(...xs);
        const minY = Math.min(...ys);
        const maxX = Math.max(...xs);
        const maxY = Math.max(...ys);
        const rectW = maxX - minX;
        const rectH = maxY - minY;
        ctx.fillRect(minX, minY, rectW, rectH);
      } else {
        ctx.lineWidth = region.brushSize;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(region.points[0].x, region.points[0].y);
        for (let i = 1; i < region.points.length; i++) {
          ctx.lineTo(region.points[i].x, region.points[i].y);
        }
        ctx.stroke();
      }
    });

    setMaskCanvas(canvas);
  }, [width, height, fogData, defaultState]);

  // Live stroke / rect preview while mouse dragging
  const previewElement = useMemo(() => {
    if (!currentMode) return null;

    if (fogToolShape === 'rectangle' && rectStart && rectEnd) {
      const minX = Math.min(rectStart.x, rectEnd.x);
      const minY = Math.min(rectStart.y, rectEnd.y);
      const rectW = Math.abs(rectEnd.x - rectStart.x);
      const rectH = Math.abs(rectEnd.y - rectStart.y);
      const strokeColor = currentMode === 'reveal' ? '#22c55e' : '#ef4444';
      const fillColor = currentMode === 'reveal' ? 'rgba(34, 197, 94, 0.25)' : 'rgba(239, 68, 68, 0.4)';

      return (
        <Rect
          x={minX}
          y={minY}
          width={rectW}
          height={rectH}
          fill={fillColor}
          stroke={strokeColor}
          strokeWidth={2}
          dash={[6, 4]}
          listening={false}
        />
      );
    }

    if (currentStroke.length >= 2) {
      const flatPoints = currentStroke.flatMap((p) => [p.x, p.y]);
      const color = currentMode === 'reveal' ? 'rgba(34, 197, 94, 0.6)' : 'rgba(0, 0, 0, 0.7)';

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
    }

    return null;
  }, [currentMode, fogToolShape, rectStart, rectEnd, currentStroke, currentBrushSize]);

  return (
    <Group listening={false}>
      {maskCanvas && (
        <KonvaImage
          image={maskCanvas}
          width={width}
          height={height}
          opacity={fogOpacity}
          listening={false}
        />
      )}
      {previewElement}
    </Group>
  );
};
