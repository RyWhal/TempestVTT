import { describe, expect, it } from 'vitest';
import type { SectionRenderLine } from '../../procgen/types';
import { buildGeneratedWallStamps } from './generatedWallRender';

const horizontalWall: SectionRenderLine = {
  id: 'wall_horizontal',
  points: [0, 28, 28, 28],
  stroke: '#111111',
  strokeWidth: 6,
  surfaceType: 'wall',
};

const verticalWall: SectionRenderLine = {
  id: 'wall_vertical',
  points: [28, 0, 28, 28],
  stroke: '#111111',
  strokeWidth: 6,
  surfaceType: 'wall',
};

describe('generatedWallRender', () => {
  it('builds deterministic overlapping square stamps for a wall line', () => {
    const first = buildGeneratedWallStamps(horizontalWall);
    const second = buildGeneratedWallStamps(horizontalWall);

    expect(first).toEqual(second);
    expect(first.length).toBe(5);
    expect(first.every((stamp) => stamp.size === 10)).toBe(true);
  });

  it('jitters horizontal walls perpendicular to the line', () => {
    const stamps = buildGeneratedWallStamps(horizontalWall);
    const yValues = new Set(stamps.map((stamp) => Number(stamp.y.toFixed(2))));
    const rotations = new Set(stamps.map((stamp) => Number(stamp.rotation.toFixed(2))));

    expect(yValues.size).toBeGreaterThan(1);
    expect(rotations.size).toBeGreaterThan(1);
    expect(stamps.every((stamp) => stamp.x >= -1 && stamp.x <= 29)).toBe(true);
  });

  it('jitters vertical walls perpendicular to the line', () => {
    const stamps = buildGeneratedWallStamps(verticalWall);
    const xValues = new Set(stamps.map((stamp) => Number(stamp.x.toFixed(2))));
    const fills = new Set(stamps.map((stamp) => stamp.fill));

    expect(xValues.size).toBeGreaterThan(1);
    expect(fills.size).toBeGreaterThan(1);
    expect(stamps.every((stamp) => stamp.y >= -1 && stamp.y <= 29)).toBe(true);
  });
});
