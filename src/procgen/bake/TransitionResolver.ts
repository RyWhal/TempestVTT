import type { BiomeTransitionRegistry, MapVisualizationPipelineConfig } from './AssetRegistryLoader';
import type { GeneratedSemanticMap, ResolvedCellTransition, ResolvedBiomeTransition } from './SemanticMapTypes';

const pairKey = (fromBiomeId: string, toBiomeId: string) =>
  [fromBiomeId, toBiomeId].sort().join('::');

export const createTransitionResolver = (
  pipelineConfig: MapVisualizationPipelineConfig,
  transitionRegistry: BiomeTransitionRegistry
) => {
  const transitionByPair = new Map(
    transitionRegistry.transitions.map((transition) => [
      pairKey(transition.from_biome_id, transition.to_biome_id),
      {
        fromBiomeId: transition.from_biome_id,
        toBiomeId: transition.to_biome_id,
        transitionFamilyId: transition.transition_family_id,
        transitionMode: transition.transition_mode,
        blendWeights: transition.blend_weights,
        preferredAssets: transition.preferred_assets,
      } satisfies ResolvedBiomeTransition,
    ])
  );

  const fallbackTransition: ResolvedBiomeTransition = {
    fromBiomeId: 'fallback_from',
    toBiomeId: 'fallback_to',
    transitionFamilyId: transitionRegistry.fallback_transition.transition_family_id,
    transitionMode: transitionRegistry.fallback_transition.transition_mode,
    blendWeights: transitionRegistry.fallback_transition.blend_weights,
    preferredAssets: [],
  };

  return {
    resolveTransitions(semanticMap: GeneratedSemanticMap): ResolvedCellTransition[] {
      if (!pipelineConfig.transition_rules.enabled) {
        return [];
      }

      const floorCellByCoordinate = new Map(
        semanticMap.cells
          .filter((cell) => cell.cellType === 'floor' && cell.biomeId)
          .map((cell) => [`${cell.x},${cell.y}`, cell] as const)
      );

      const transitions: ResolvedCellTransition[] = [];

      for (const cell of floorCellByCoordinate.values()) {
        const neighbors = [
          floorCellByCoordinate.get(`${cell.x + 1},${cell.y}`),
          floorCellByCoordinate.get(`${cell.x},${cell.y + 1}`),
        ].filter((entry): entry is typeof cell => Boolean(entry));

        for (const neighborCell of neighbors) {
          if (!cell.biomeId || !neighborCell.biomeId || cell.biomeId === neighborCell.biomeId) {
            continue;
          }

          transitions.push({
            id: `${cell.x},${cell.y}->${neighborCell.x},${neighborCell.y}`,
            cell,
            neighborCell,
            transition:
              transitionByPair.get(pairKey(cell.biomeId, neighborCell.biomeId)) ??
              fallbackTransition,
          });
        }
      }

      return transitions;
    },
  };
};
