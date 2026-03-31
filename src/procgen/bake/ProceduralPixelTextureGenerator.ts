import { stableHash, stableNumber } from './seededHash';
import type {
  ProceduralDirectionalRule,
  ProceduralPatternRule,
  ProceduralPixelTextureGenerationOptions,
  ProceduralPixelTextureRecipe,
  ProceduralPixelTextureVariant,
} from './ProceduralPixelTextureTypes';

const SVG_NS = 'http://www.w3.org/2000/svg';

const escapeXml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const createSeededRng = (seed: string) => {
  let state = Number.parseInt(stableHash(seed), 16) >>> 0;

  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 0x100000000;
  };
};

const assertSquareGrid = (tileSizePx: number, pixelScale: number) => {
  if (!Number.isInteger(tileSizePx) || !Number.isInteger(pixelScale) || tileSizePx <= 0 || pixelScale <= 0) {
    throw new Error('Procedural pixel textures require positive integer tile and pixel scale values');
  }

  if (tileSizePx % pixelScale !== 0) {
    throw new Error('Procedural pixel textures require square outputs with an even cell grid');
  }
};

const parseHexColor = (color: string) => {
  const normalized = color.trim().toLowerCase();
  const match = /^#([0-9a-f]{6})$/.exec(normalized);
  if (!match) {
    throw new Error(`Procedural pixel texture color must be a 6-digit hex value: ${color}`);
  }

  return {
    color: normalized,
    red: Number.parseInt(match[1].slice(0, 2), 16),
    green: Number.parseInt(match[1].slice(2, 4), 16),
    blue: Number.parseInt(match[1].slice(4, 6), 16),
  };
};

const getPaletteColors = (recipe: ProceduralPixelTextureRecipe) =>
  recipe.palette.map((entry) => parseHexColor(entry.color).color);

const assertPaletteColor = (
  recipe: ProceduralPixelTextureRecipe,
  color: string,
  context: string
) => {
  const normalized = parseHexColor(color).color;
  const palette = new Set(getPaletteColors(recipe));

  if (!palette.has(normalized)) {
    throw new Error(
      `Procedural pixel texture recipe ${recipe.biome_id} uses non-palette color ${color} in ${context}`
    );
  }

  return normalized;
};

const getPaletteWeights = (recipe: ProceduralPixelTextureRecipe) =>
  recipe.palette.map((entry) => ({
    color: parseHexColor(entry.color).color,
    weight: recipe.color_weights[entry.color] ?? entry.weight,
  }));

const getDominantPaletteColor = (recipe: ProceduralPixelTextureRecipe) =>
  getPaletteWeights(recipe)
    .slice()
    .sort((left, right) => right.weight - left.weight || left.color.localeCompare(right.color))[0]?.color ??
  recipe.palette[0]?.color.toLowerCase() ??
  '#000000';

const chooseWeightedColor = (
  recipe: ProceduralPixelTextureRecipe,
  seed: string,
  x: number,
  y: number,
  salt: string
) => {
  const paletteWeights = getPaletteWeights(recipe);
  const totalWeight = paletteWeights.reduce((sum, entry) => sum + entry.weight, 0);
  let cursor = 0;
  const roll = stableNumber(`${seed}:${recipe.biome_id}:${recipe.recipe_version}:${salt}:${x}:${y}`);

  for (const entry of paletteWeights) {
    cursor += entry.weight / totalWeight;
    if (roll <= cursor) {
      return entry.color;
    }
  }

  return paletteWeights[paletteWeights.length - 1]?.color ?? recipe.palette[0].color.toLowerCase();
};

const applyRulePatch = ({
  grid,
  recipe,
  seed,
  rule,
  ruleIndex,
  cellsPerSide,
}: {
  grid: string[][];
  recipe: ProceduralPixelTextureRecipe;
  seed: string;
  rule: ProceduralPatternRule;
  ruleIndex: number;
  cellsPerSide: number;
}) => {
  const color = assertPaletteColor(recipe, rule.color, `cluster/accent rule ${ruleIndex}`);
  const ruleWeight = Math.max(rule.weight, 0);
  if ((rule.density ?? 0) <= 0 || ruleWeight <= 0) {
    return;
  }

  const minCells = clamp(Math.round((rule.min_size_px ?? recipe.pixel_scale) / recipe.pixel_scale), 1, cellsPerSide);
  const maxCells = clamp(
    Math.round(
      (rule.max_size_px ?? Math.max(recipe.pixel_scale, rule.min_size_px ?? recipe.pixel_scale)) /
        recipe.pixel_scale
    ),
    minCells,
    cellsPerSide
  );
  const patchCount = Math.max(1, Math.round((rule.density ?? 0.1) * cellsPerSide * ruleWeight));
  const weightedMaxCells = clamp(
    Math.max(minCells, Math.round(maxCells * (0.5 + ruleWeight / 2))),
    minCells,
    cellsPerSide
  );

  const fillBlobPatch = ({
    startX,
    startY,
    width,
    height,
    patchSeed,
  }: {
    startX: number;
    startY: number;
    width: number;
    height: number;
    patchSeed: string;
  }) => {
    if (width <= 2 && height <= 2) {
      for (let y = startY; y < startY + height; y += 1) {
        for (let x = startX; x < startX + width; x += 1) {
          grid[y][x] = color;
        }
      }
      return;
    }

    const centerX = startX + (width - 1) / 2;
    const centerY = startY + (height - 1) / 2;
    const targetFillRatio = 0.28 + stableNumber(`${patchSeed}:fill_ratio`) * 0.14;
    const targetCellCount = clamp(Math.round(width * height * targetFillRatio), 1, width * height);
    const frontier = new Map<string, { x: number; y: number; score: number }>();
    const filled = new Set<string>();

    const enqueue = (x: number, y: number) => {
      if (x < startX || x >= startX + width || y < startY || y >= startY + height) {
        return;
      }

      const key = `${x},${y}`;
      if (filled.has(key) || frontier.has(key)) {
        return;
      }

      const normalizedX = (x - centerX) / Math.max(width / 2, 1);
      const normalizedY = (y - centerY) / Math.max(height / 2, 1);
      const distancePenalty = normalizedX * normalizedX + normalizedY * normalizedY;
      const noiseJitter = stableNumber(`${patchSeed}:blob:${x}:${y}`) * 0.55;

      frontier.set(key, {
        x,
        y,
        score: distancePenalty + noiseJitter,
      });
    };

    const fill = (x: number, y: number) => {
      const key = `${x},${y}`;
      if (filled.has(key)) {
        return;
      }

      filled.add(key);
      grid[y][x] = color;

      enqueue(x + 1, y);
      enqueue(x - 1, y);
      enqueue(x, y + 1);
      enqueue(x, y - 1);
    };

    fill(Math.round(centerX), Math.round(centerY));

    while (filled.size < targetCellCount && frontier.size > 0) {
      const next = [...frontier.values()].sort((left, right) => left.score - right.score)[0];
      if (!next) {
        break;
      }

      frontier.delete(`${next.x},${next.y}`);
      fill(next.x, next.y);
    }
  };

  for (let patchIndex = 0; patchIndex < patchCount; patchIndex += 1) {
    const patchSeed = `${seed}:${recipe.biome_id}:${recipe.recipe_version}:${ruleIndex}:${patchIndex}`;
    const random = createSeededRng(patchSeed);
    const width = clamp(
      Math.round(minCells + random() * (weightedMaxCells - minCells)),
      1,
      cellsPerSide
    );
    const height = clamp(
      Math.round(minCells + random() * (weightedMaxCells - minCells)),
      1,
      cellsPerSide
    );
    const startX = clamp(Math.floor(random() * (cellsPerSide - width + 1)), 0, cellsPerSide - width);
    const startY = clamp(
      Math.floor(random() * (cellsPerSide - height + 1)),
      0,
      cellsPerSide - height
    );
    fillBlobPatch({
      startX,
      startY,
      width,
      height,
      patchSeed,
    });
  }
};

const applyDirectionalRule = ({
  grid,
  recipe,
  seed,
  rule,
  ruleIndex,
  cellsPerSide,
}: {
  grid: string[][];
  recipe: ProceduralPixelTextureRecipe;
  seed: string;
  rule: ProceduralDirectionalRule;
  ruleIndex: number;
  cellsPerSide: number;
}) => {
  const palette = getPaletteColors(recipe);
  const stripeColor = palette[Math.min(1, palette.length - 1)] ?? palette[0];
  const spacingCells = Math.max(1, Math.round(rule.spacing_px / recipe.pixel_scale));
  const threshold = clamp(rule.intensity * 2.5, 0, 1);
  const bandCount = Math.ceil(cellsPerSide / spacingCells);

  for (let bandIndex = 0; bandIndex < bandCount; bandIndex += 1) {
    const bandRoll = stableNumber(
      `${seed}:${recipe.biome_id}:${recipe.recipe_version}:grain:${ruleIndex}:${rule.axis}:${bandIndex}`
    );
    const start = bandIndex * spacingCells;
    const end = clamp(start + spacingCells, 0, cellsPerSide);
    if (bandRoll >= threshold) {
      continue;
    }

    if (rule.axis === 'horizontal') {
      for (let y = start; y < end; y += 1) {
        for (let x = 0; x < cellsPerSide; x += 1) {
          grid[y][x] = stripeColor;
        }
      }
      continue;
    }

    if (rule.axis === 'vertical') {
      for (let x = start; x < end; x += 1) {
        for (let y = 0; y < cellsPerSide; y += 1) {
          grid[y][x] = stripeColor;
        }
      }
      continue;
    }

    for (let y = 0; y < cellsPerSide; y += 1) {
      for (let x = 0; x < cellsPerSide; x += 1) {
        if (Math.floor((x + y) / spacingCells) === bandIndex) {
          grid[y][x] = stripeColor;
        }
      }
    }
  }
};

const reconcileSeamEdges = (grid: string[][]) => {
  const lastIndex = grid.length - 1;
  if (lastIndex <= 0) {
    return;
  }

  for (let y = 0; y < lastIndex; y += 1) {
    grid[y][lastIndex] = grid[y][0];
  }

  for (let x = 0; x < grid.length; x += 1) {
    grid[lastIndex][x] = grid[0][x];
  }
};

const getDominantColors = (grid: string[][]) => {
  const counts = new Map<string, number>();
  for (const row of grid) {
    for (const color of row) {
      counts.set(color, (counts.get(color) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .map(([color]) => color);
};

const buildSvg = (grid: string[][], tileSizePx: number, pixelScale: number) => {
  const cellsPerSide = grid.length;
  const rects: string[] = [];
  for (let y = 0; y < cellsPerSide; y += 1) {
    for (let x = 0; x < cellsPerSide; x += 1) {
      rects.push(
        `<rect x="${x * pixelScale}" y="${y * pixelScale}" width="${pixelScale}" height="${pixelScale}" fill="${escapeXml(
          grid[y][x]
        )}" />`
      );
    }
  }

  const background = grid[0]?.[0] ?? '#000000';
  return `<svg xmlns="${SVG_NS}" width="${tileSizePx}" height="${tileSizePx}" viewBox="0 0 ${tileSizePx} ${tileSizePx}" shape-rendering="crispEdges"><rect width="${tileSizePx}" height="${tileSizePx}" fill="${escapeXml(background)}" />${rects.join('')}</svg>`;
};

export const generateProceduralPixelTexture = ({
  recipe,
  variantSeed,
  seamSafeEdges = false,
}: ProceduralPixelTextureGenerationOptions): ProceduralPixelTextureVariant => {
  assertSquareGrid(recipe.tile_size_px, recipe.pixel_scale);

  const cellsPerSide = recipe.tile_size_px / recipe.pixel_scale;
  const seed = `${recipe.biome_id}:${recipe.recipe_key}:${recipe.recipe_version}:${variantSeed}:${seamSafeEdges ? 'seam_safe' : 'free'}`;
  const dominantBaseColor = getDominantPaletteColor(recipe);
  const grid: string[][] = Array.from({ length: cellsPerSide }, (_, y) =>
    Array.from({ length: cellsPerSide }, (_, x) =>
      recipe.base_fill_mode === 'dominant'
        ? dominantBaseColor
        : chooseWeightedColor(recipe, seed, x, y, 'base')
    )
  );

  recipe.cluster_rules.forEach((rule, ruleIndex) =>
    applyRulePatch({
      grid,
      recipe,
      seed,
      rule,
      ruleIndex,
      cellsPerSide,
    })
  );

  recipe.accent_rules.forEach((rule, ruleIndex) =>
    applyRulePatch({
      grid,
      recipe,
      seed,
      rule,
      ruleIndex: ruleIndex + recipe.cluster_rules.length,
      cellsPerSide,
    })
  );

  recipe.directional_rules?.forEach((rule, ruleIndex) =>
    applyDirectionalRule({
      grid,
      recipe,
      seed,
      rule,
      ruleIndex,
      cellsPerSide,
    })
  );

  if (seamSafeEdges) {
    reconcileSeamEdges(grid);
  }

  const variantId = `procedural-${recipe.biome_id}-${recipe.recipe_key}-${recipe.recipe_version}-${stableHash(seed)}`;

  return {
    variantId,
    variantSeed,
    imageContentType: 'image/svg+xml',
    imageBody: buildSvg(grid, recipe.tile_size_px, recipe.pixel_scale),
    metadata: {
      recipeId: `${recipe.biome_id}:${recipe.recipe_key}:${recipe.recipe_version}`,
      recipeKey: recipe.recipe_key,
      dominantColors: getDominantColors(grid),
      seamSafeEdges,
    },
  };
};
