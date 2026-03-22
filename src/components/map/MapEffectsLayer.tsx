import React, { useMemo } from 'react';
import { Circle, Group, Line, Rect, RegularPolygon, Star, Text } from 'react-konva';
import type { Map, MapEffectTile } from '../../types';
import { MAP_EFFECTS } from '../../lib/mapDecor';

interface MapEffectsLayerProps {
  map: Map;
  pulse: number;
}

const effectByType = Object.fromEntries(MAP_EFFECTS.map((effect) => [effect.type, effect]));

const fract = (value: number) => value - Math.floor(value);

const seeded = (seed: number, salt: number) => fract(Math.sin(seed * 12.9898 + salt * 78.233) * 43758.5453);

const tileOrigin = (map: Map, tile: MapEffectTile) => ({
  x: map.gridOffsetX + tile.gridX * map.gridCellSize,
  y: map.gridOffsetY + tile.gridY * map.gridCellSize,
});

const renderGlyph = (tile: MapEffectTile, map: Map, glyph: string, color: string, pulse: number) => {
  const { x, y } = tileOrigin(map, tile);
  const size = map.gridCellSize;
  return (
    <Text
      x={x + size * 0.26}
      y={y + size * 0.24}
      text={glyph}
      fontSize={size * 0.46}
      fill={color}
      opacity={0.28 + ((Math.sin(pulse * 0.03 + tile.seed) + 1) / 2) * 0.34}
      listening={false}
    />
  );
};

const renderFire = (tile: MapEffectTile, map: Map, pulse: number) => {
  const { x, y } = tileOrigin(map, tile);
  const size = map.gridCellSize;
  const t = pulse * 0.04;

  return (
    <Group key={tile.id}>
      <Rect x={x} y={y} width={size} height={size} fill="#7c2d12" opacity={0.18} />
      {Array.from({ length: 7 }).map((_, i) => {
        const sway = Math.sin(t + i + tile.seed) * (size * 0.12);
        const flameHeight = size * (0.25 + seeded(tile.seed, i + 3) * 0.35);
        return (
          <Line
            key={`f-${tile.id}-${i}`}
            points={[
              x + size * 0.5 + sway,
              y + size * 0.92,
              x + size * (0.5 + seeded(tile.seed, i + 12) * 0.3 - 0.15),
              y + size * 0.92 - flameHeight,
              x + size * (0.5 + seeded(tile.seed, i + 16) * 0.25 - 0.125),
              y + size * 0.92,
            ]}
            closed
            fill={i % 2 === 0 ? '#fb923c' : '#facc15'}
            opacity={0.22 + ((Math.sin(t * 1.4 + i) + 1) / 2) * 0.45}
          />
        );
      })}
      {Array.from({ length: 10 }).map((_, i) => {
        const px = x + seeded(tile.seed, i + 30) * size;
        const rise = ((t * 15 + i * 13) % (size * 1.2));
        return (
          <Circle
            key={`spark-${tile.id}-${i}`}
            x={px}
            y={y + size - rise}
            radius={Math.max(1.2, flameWidthBySeed(tile.seed, i, size))}
            fill="#fde68a"
            opacity={0.25 + seeded(tile.seed, i + 40) * 0.55}
          />
        );
      })}
      {renderGlyph(tile, map, '🔥', '#fff7ed', pulse)}
    </Group>
  );
};

const flameWidthBySeed = (seed: number, index: number, size: number) => size * (0.015 + seeded(seed, index + 41) * 0.03);

const renderPoison = (tile: MapEffectTile, map: Map, pulse: number) => {
  const { x, y } = tileOrigin(map, tile);
  const size = map.gridCellSize;
  const t = pulse * 0.03;

  return (
    <Group key={tile.id}>
      <Rect x={x} y={y} width={size} height={size} fill="#365314" opacity={0.2} />
      {Array.from({ length: 8 }).map((_, i) => {
        const cx = x + seeded(tile.seed, i + 50) * size;
        const cy = y + seeded(tile.seed, i + 55) * size;
        const wobble = Math.sin(t + i) * (size * 0.05);
        return (
          <Circle
            key={`bubble-${tile.id}-${i}`}
            x={cx + wobble}
            y={cy - wobble}
            radius={size * (0.08 + seeded(tile.seed, i + 60) * 0.12)}
            fill="#84cc16"
            opacity={0.15 + ((Math.sin(t * 1.8 + i) + 1) / 2) * 0.45}
          />
        );
      })}
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={`toxic-${tile.id}-${i}`}
          x={x + seeded(tile.seed, i + 70) * size}
          y={y + seeded(tile.seed, i + 75) * size}
          numPoints={6}
          innerRadius={size * 0.03}
          outerRadius={size * 0.09}
          rotation={(pulse * 1.8 + i * 67) % 360}
          fill="#bef264"
          opacity={0.1 + ((Math.sin(t * 2 + i) + 1) / 2) * 0.25}
        />
      ))}
      {renderGlyph(tile, map, '☠️', '#ecfccb', pulse)}
    </Group>
  );
};

const renderWater = (tile: MapEffectTile, map: Map, pulse: number) => {
  const { x, y } = tileOrigin(map, tile);
  const size = map.gridCellSize;
  const t = pulse * 0.02;
  const centerX = x + size / 2;
  const centerY = y + size / 2;

  return (
    <Group key={tile.id}>
      <Rect x={x} y={y} width={size} height={size} fill="#0c4a6e" opacity={0.2} />
      {Array.from({ length: 4 }).map((_, i) => {
        const progress = fract(t * 0.45 + i * 0.22 + seeded(tile.seed, i + 80));
        return (
          <Circle
            key={`ripple-${tile.id}-${i}`}
            x={centerX}
            y={centerY}
            radius={size * (0.12 + progress * 0.5)}
            stroke="#7dd3fc"
            strokeWidth={Math.max(1, size * 0.03 * (1 - progress))}
            opacity={0.1 + (1 - progress) * 0.35}
          />
        );
      })}
      {Array.from({ length: 9 }).map((_, i) => (
        <Circle
          key={`drop-${tile.id}-${i}`}
          x={x + seeded(tile.seed, i + 90) * size}
          y={y + seeded(tile.seed, i + 95) * size}
          radius={size * (0.02 + seeded(tile.seed, i + 100) * 0.05)}
          fill="#e0f2fe"
          opacity={0.18 + ((Math.sin(t * 2.2 + i) + 1) / 2) * 0.45}
        />
      ))}
      {renderGlyph(tile, map, '💧', '#f0f9ff', pulse)}
    </Group>
  );
};

const renderIce = (tile: MapEffectTile, map: Map, pulse: number) => {
  const { x, y } = tileOrigin(map, tile);
  const size = map.gridCellSize;
  const t = pulse * 0.015;

  return (
    <Group key={tile.id}>
      <Rect x={x} y={y} width={size} height={size} fill="#1e3a8a" opacity={0.18} />
      {Array.from({ length: 6 }).map((_, i) => {
        const cx = x + size * (0.2 + seeded(tile.seed, i + 110) * 0.6);
        const cy = y + size * (0.2 + seeded(tile.seed, i + 116) * 0.6);
        return (
          <RegularPolygon
            key={`crystal-${tile.id}-${i}`}
            x={cx}
            y={cy}
            sides={6}
            radius={size * (0.08 + seeded(tile.seed, i + 123) * 0.1)}
            rotation={(pulse * 0.8 + i * 43) % 360}
            stroke="#dbeafe"
            strokeWidth={1.5}
            fill="#93c5fd"
            opacity={0.08 + ((Math.sin(t * 2 + i) + 1) / 2) * 0.28}
          />
        );
      })}
      <Line
        points={[x + size * 0.15, y + size * 0.5, x + size * 0.85, y + size * 0.5]}
        stroke="#eff6ff"
        strokeWidth={1.5}
        opacity={0.22}
      />
      <Line
        points={[x + size * 0.5, y + size * 0.15, x + size * 0.5, y + size * 0.85]}
        stroke="#eff6ff"
        strokeWidth={1.5}
        opacity={0.22}
      />
      {renderGlyph(tile, map, '❄️', '#f8fafc', pulse)}
    </Group>
  );
};

const renderArcane = (tile: MapEffectTile, map: Map, pulse: number) => {
  const { x, y } = tileOrigin(map, tile);
  const size = map.gridCellSize;
  const t = pulse * 0.02;
  const centerX = x + size / 2;
  const centerY = y + size / 2;

  return (
    <Group key={tile.id}>
      <Rect x={x} y={y} width={size} height={size} fill="#3b0764" opacity={0.2} />
      <Circle
        x={centerX}
        y={centerY}
        radius={size * 0.35}
        stroke="#e9d5ff"
        strokeWidth={1.6}
        opacity={0.35}
      />
      <Circle
        x={centerX}
        y={centerY}
        radius={size * (0.2 + ((Math.sin(t * 2) + 1) / 2) * 0.14)}
        stroke="#c084fc"
        strokeWidth={2}
        opacity={0.45}
      />
      {Array.from({ length: 7 }).map((_, i) => {
        const angle = t * 2.5 + i * ((Math.PI * 2) / 7);
        return (
          <Circle
            key={`orb-${tile.id}-${i}`}
            x={centerX + Math.cos(angle) * size * 0.32}
            y={centerY + Math.sin(angle) * size * 0.32}
            radius={size * 0.045}
            fill="#f5d0fe"
            opacity={0.25 + ((Math.sin(t * 3 + i) + 1) / 2) * 0.4}
          />
        );
      })}
      <Star
        x={centerX}
        y={centerY}
        numPoints={8}
        innerRadius={size * 0.07}
        outerRadius={size * 0.16}
        rotation={(pulse * 1.5) % 360}
        stroke="#f5d0fe"
        strokeWidth={1.2}
        opacity={0.35}
      />
      {renderGlyph(tile, map, '🌀', '#faf5ff', pulse)}
    </Group>
  );
};

const renderDarkness = (tile: MapEffectTile, map: Map, pulse: number) => {
  const { x, y } = tileOrigin(map, tile);
  const size = map.gridCellSize;
  const t = pulse * 0.025;

  return (
    <Group key={tile.id}>
      <Rect x={x} y={y} width={size} height={size} fill="#030712" opacity={0.42} />
      {Array.from({ length: 7 }).map((_, i) => {
        const cx = x + size * (0.2 + seeded(tile.seed, i + 140) * 0.6);
        const cy = y + size * (0.2 + seeded(tile.seed, i + 145) * 0.6);
        const r = size * (0.14 + seeded(tile.seed, i + 150) * 0.16);
        return (
          <Circle
            key={`smoke-${tile.id}-${i}`}
            x={cx + Math.sin(t + i) * (size * 0.07)}
            y={cy + Math.cos(t * 1.4 + i) * (size * 0.07)}
            radius={r}
            fill="#111827"
            opacity={0.14 + ((Math.sin(t * 1.9 + i) + 1) / 2) * 0.3}
          />
        );
      })}
      {Array.from({ length: 5 }).map((_, i) => (
        <Line
          key={`tendril-${tile.id}-${i}`}
          points={[
            x + size * seeded(tile.seed, i + 160),
            y + size * seeded(tile.seed, i + 165),
            x + size * seeded(tile.seed, i + 170),
            y + size * seeded(tile.seed, i + 175),
            x + size * seeded(tile.seed, i + 180),
            y + size * seeded(tile.seed, i + 185),
          ]}
          stroke="#374151"
          strokeWidth={2}
          lineCap="round"
          lineJoin="round"
          tension={0.55}
          opacity={0.2 + ((Math.sin(t * 2 + i) + 1) / 2) * 0.22}
        />
      ))}
      {renderGlyph(tile, map, '🌑', '#e5e7eb', pulse)}
    </Group>
  );
};

const renderEffectTile = (tile: MapEffectTile, map: Map, pulse: number) => {
  switch (tile.type) {
    case 'fire':
      return renderFire(tile, map, pulse);
    case 'poison':
      return renderPoison(tile, map, pulse);
    case 'water':
      return renderWater(tile, map, pulse);
    case 'ice':
      return renderIce(tile, map, pulse);
    case 'arcane':
      return renderArcane(tile, map, pulse);
    case 'darkness':
      return renderDarkness(tile, map, pulse);
    default:
      return null;
  }
};

export const MapEffectsLayer: React.FC<MapEffectsLayerProps> = ({ map, pulse }) => {
  const tiles = useMemo(() => map.effectData || [], [map.effectData]);

  if (!map.effectsEnabled || !map.gridEnabled || tiles.length === 0) {
    return null;
  }

  return (
    <Group listening={false}>
      {tiles.map((tile) => {
        if (!effectByType[tile.type]) return null;
        return renderEffectTile(tile, map, pulse);
      })}
    </Group>
  );
};
