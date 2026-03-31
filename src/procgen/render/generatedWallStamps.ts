import type { SectionRenderLine } from '../types';

export interface GeneratedWallStamp {
  id: string;
  x: number;
  y: number;
  size: number;
  fill: string;
  rotation: number;
}

export interface GeneratedWallStampOptions {
  stampSize?: number;
  stampStep?: number;
  stampJitter?: number;
  maxRotationDegrees?: number;
  palette?: string[];
}

const DEFAULT_WALL_STAMP_SIZE = 10;
const DEFAULT_WALL_STAMP_STEP = 7;
const DEFAULT_WALL_STAMP_JITTER = 2.5;
const DEFAULT_WALL_STAMP_ROTATION_DEGREES = 18;
const DEFAULT_WALL_STAMP_PALETTE = ['#1c1c1c', '#252525', '#303030', '#3a3a3a'];

const stableHash = (value: string) => {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
};

const createSeededRng = (seed: string) => {
  let state = stableHash(seed) || 1;

  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
};

export const buildGeneratedWallStamps = (
  wall: SectionRenderLine,
  options: GeneratedWallStampOptions = {}
): GeneratedWallStamp[] => {
  const {
    stampSize = DEFAULT_WALL_STAMP_SIZE,
    stampStep = DEFAULT_WALL_STAMP_STEP,
    stampJitter = DEFAULT_WALL_STAMP_JITTER,
    maxRotationDegrees = DEFAULT_WALL_STAMP_ROTATION_DEGREES,
    palette = DEFAULT_WALL_STAMP_PALETTE,
  } = options;
  const [x1, y1, x2, y2] = wall.points;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const length = Math.hypot(dx, dy);

  if (length === 0) {
    return [];
  }

  const alongX = dx / length;
  const alongY = dy / length;
  const normalX = -alongY;
  const normalY = alongX;
  const stampCount = Math.max(1, Math.floor(length / stampStep) + 1);
  const rng = createSeededRng(`${wall.id}:${wall.points.join(':')}`);
  const stamps: GeneratedWallStamp[] = [];

  for (let index = 0; index < stampCount; index += 1) {
    const distance = Math.min(index * stampStep, length);
    const centerX = x1 + alongX * distance;
    const centerY = y1 + alongY * distance;
    const jitter = (rng() * 2 - 1) * stampJitter;
    const rotation = (rng() * 2 - 1) * maxRotationDegrees;
    const fillIndex = Math.floor(rng() * palette.length);

    stamps.push({
      id: `${wall.id}:stamp:${index}`,
      x: centerX + normalX * jitter,
      y: centerY + normalY * jitter,
      size: stampSize,
      fill: palette[Math.min(fillIndex, palette.length - 1)] ?? palette[0] ?? '#1c1c1c',
      rotation,
    });
  }

  return stamps;
};
