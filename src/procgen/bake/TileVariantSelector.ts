import type { MapVisualizationPipelineConfig } from './AssetRegistryLoader';
import { createProceduralPixelTextureRecipeIndex } from './ProceduralPixelTextureRegistry';
import { stableHash, stableNumber } from './seededHash';
import type {
  GeneratedSemanticMap,
  ResolvedBiomeVisualRule,
  SelectedFloorTile,
} from './SemanticMapTypes';
import type {
  ProceduralPixelTextureRecipe,
  ProceduralPixelTextureRegistry,
} from './ProceduralPixelTextureTypes';

interface SelectMapFloorTilesInput {
  semanticMap: GeneratedSemanticMap;
  visualRules: Map<string, ResolvedBiomeVisualRule>;
  configVersion: string;
}

const cellKey = (x: number, y: number) => `${x},${y}`;

export const createTileVariantSelector = (
  pipelineConfig: MapVisualizationPipelineConfig,
  proceduralTextureRegistry: ProceduralPixelTextureRegistry
) => {
  const recipeIndex = createProceduralPixelTextureRecipeIndex(proceduralTextureRegistry);

  return {
    selectMapFloorTiles({
      semanticMap,
      visualRules,
      configVersion,
    }: SelectMapFloorTilesInput): SelectedFloorTile[] {
      const selectedByCell = new Map<string, SelectedFloorTile>();
      const orderedFloorCells = semanticMap.cells
        .filter((cell) => cell.cellType === 'floor' && cell.biomeId)
        .sort((left, right) => left.y - right.y || left.x - right.x);

      for (const cell of orderedFloorCells) {
        const resolvedRule = visualRules.get(cellKey(cell.x, cell.y));
        const biomeId = cell.biomeId ?? resolvedRule?.biomeId;

        if (!resolvedRule || !biomeId) {
          continue;
        }

        const recipes = recipeIndex.recipesByBiome.get(biomeId);
        if (!recipes || recipes.length === 0) {
          continue;
        }

        const recipe = chooseRecipe({
          recipes,
          cell,
          mapSeed: semanticMap.mapSeed,
          configVersion,
        });

        const candidates = buildCandidates(recipe.variant_categories, resolvedRule.variantWeights);
        const chosenCategory = chooseCategory({
          candidates,
          selectedByCell,
          cell,
          mapSeed: semanticMap.mapSeed,
          configVersion,
          avoidAdjacentIdenticalTiles:
            pipelineConfig.tile_selection_rules.avoid_adjacent_identical_tiles,
          avoidIdenticalBlocks: pipelineConfig.tile_selection_rules.avoid_2x2_identical_blocks,
        });

        const recipeIdentity = recipes.length > 1 ? `${biomeId}-${recipe.recipe_key}` : biomeId;
        const variantSeed =
          recipes.length > 1
            ? `${semanticMap.mapSeed}:${configVersion}:${cell.x}:${cell.y}:${biomeId}:${recipe.recipe_key}:${chosenCategory.category}`
            : `${semanticMap.mapSeed}:${configVersion}:${cell.x}:${cell.y}:${biomeId}:${chosenCategory.category}`;
        const variantId = `procedural-${recipeIdentity}-${chosenCategory.category}-${stableHash(
          variantSeed
        )}`;
        const transformSeed = `${variantSeed}:${variantId}`;
        const rotationSteps =
          pipelineConfig.grid_rules.allow_rotation && recipe.transform_rules.rotation_safe
            ? [0, 1, 2, 3]
            : [0];
        const rotationIndex = Math.floor(stableNumber(`${transformSeed}:rotation`) * rotationSteps.length);
        const rotationDegrees =
          rotationSteps[rotationIndex] * pipelineConfig.grid_rules.rotation_step_degrees;
        const flipHorizontal =
          pipelineConfig.grid_rules.allow_horizontal_flip &&
          recipe.transform_rules.flip_safe &&
          stableNumber(`${transformSeed}:flip_h`) > 0.5;
        const flipVertical =
          pipelineConfig.grid_rules.allow_vertical_flip &&
          recipe.transform_rules.flip_safe &&
          stableNumber(`${transformSeed}:flip_v`) > 0.5;

        selectedByCell.set(cellKey(cell.x, cell.y), {
          cell,
          biomeId,
          recipeKey: recipe.recipe_key,
          category: chosenCategory.category,
          variantId,
          variantSeed,
          asset: {
            id: variantId,
            path:
              recipes.length > 1
                ? `procedural://floor/${biomeId}/${recipe.recipe_key}/${chosenCategory.category}/${variantSeed}`
                : `procedural://floor/${biomeId}/${chosenCategory.category}/${variantSeed}`,
            weight: chosenCategory.selectionWeight,
          },
          rotationDegrees,
          flipHorizontal,
          flipVertical,
        });
      }

      return [...selectedByCell.values()];
    },
  };
};

type CandidateCategory = { category: string; selectionWeight: number };

const chooseRecipe = ({
  recipes,
  cell,
  mapSeed,
  configVersion,
}: {
  recipes: Array<{ recipe_key: string } & ProceduralPixelTextureRecipe>;
  cell: GeneratedSemanticMap['cells'][number];
  mapSeed: string;
  configVersion: string;
}): ProceduralPixelTextureRecipe => {
  if (recipes.length === 1) {
    return recipes[0];
  }

  const scored = recipes.map((recipe) => {
    const randomSeed = stableNumber(
      `${mapSeed}:${configVersion}:${cell.x}:${cell.y}:${cell.biomeId}:${recipe.recipe_key}:recipe`
    );
    const normalizedRandom = Math.min(Math.max(randomSeed, Number.EPSILON), 1 - Number.EPSILON);
    return {
      recipe,
      score: Math.log(recipe.recipe_weight) - Math.log(-Math.log(normalizedRandom)),
    };
  });

  scored.sort((left, right) => {
    if (right.score === left.score) {
      return stableHash(right.recipe.recipe_key).localeCompare(stableHash(left.recipe.recipe_key));
    }

    return right.score - left.score;
  });

  return scored[0]?.recipe ?? recipes[0];
};

const buildCandidates = (
  availableCategories: Array<{ category: string; weight: number }>,
  variantWeights: Record<string, number>
): CandidateCategory[] => {
  const weightedCandidates = availableCategories.map(({ category, weight }) => ({
    category,
    selectionWeight: weight * (variantWeights[category] ?? 0),
  }));

  const filtered = weightedCandidates.filter((candidate) => candidate.selectionWeight > 0);
  return filtered.length > 0
    ? filtered
    : availableCategories.map(({ category, weight }) => ({
        category,
        selectionWeight: weight,
      }));
};

const chooseCategory = ({
  candidates,
  selectedByCell,
  cell,
  mapSeed,
  configVersion,
  avoidAdjacentIdenticalTiles,
  avoidIdenticalBlocks,
}: {
  candidates: CandidateCategory[];
  selectedByCell: Map<string, SelectedFloorTile>;
  cell: GeneratedSemanticMap['cells'][number];
  mapSeed: string;
  configVersion: string;
  avoidAdjacentIdenticalTiles: boolean;
  avoidIdenticalBlocks: boolean;
}): CandidateCategory => {
  const scored = candidates.map((candidate) => {
    const randomSeed = stableNumber(
      `${mapSeed}:${configVersion}:${cell.x}:${cell.y}:${candidate.category}`
    );
    const normalizedRandom = Math.min(Math.max(randomSeed, Number.EPSILON), 1 - Number.EPSILON);
    const weightedRandomScore = Math.log(candidate.selectionWeight) - Math.log(-Math.log(normalizedRandom));
    let penalty = 0;

    const west = selectedByCell.get(cellKey(cell.x - 1, cell.y));
    const north = selectedByCell.get(cellKey(cell.x, cell.y - 1));
    const northwest = selectedByCell.get(cellKey(cell.x - 1, cell.y - 1));

    if (avoidAdjacentIdenticalTiles) {
      if (west?.category === candidate.category) {
        penalty += 1000;
      }
      if (north?.category === candidate.category) {
        penalty += 1000;
      }
    }

    if (
      avoidIdenticalBlocks &&
      west?.category === candidate.category &&
      north?.category === candidate.category &&
      northwest?.category === candidate.category
    ) {
      penalty += 10000;
    }

    return {
      candidate,
      score: weightedRandomScore - penalty,
    };
  });

  scored.sort((left, right) => {
    if (right.score === left.score) {
      return stableHash(right.candidate.category).localeCompare(stableHash(left.candidate.category));
    }

    return right.score - left.score;
  });

  return scored[0]?.candidate ?? candidates[0];
};
