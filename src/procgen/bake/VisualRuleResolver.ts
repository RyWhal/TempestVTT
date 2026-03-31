import type { LoadedMapBakeContent } from './AssetRegistryLoader';
import type { GeneratedSemanticMap, ResolvedBiomeVisualRule, SemanticRoom } from './SemanticMapTypes';

const rangeMatches = (rangeKey: string, value: number): boolean => {
  const [minimumRaw, maximumRaw] = rangeKey.split('_to_');
  const minimum = Number.parseFloat(minimumRaw);
  const maximum = Number.parseFloat(maximumRaw);

  if (Number.isNaN(minimum) || Number.isNaN(maximum)) {
    return false;
  }

  return value >= minimum && value <= maximum;
};

const mergeWeights = (
  current: Record<string, number>,
  next: Record<string, number> | undefined
): Record<string, number> => {
  if (!next) {
    return current;
  }

  return Object.entries(next).reduce<Record<string, number>>(
    (weights, [key, value]) => ({
      ...weights,
      [key]: (weights[key] ?? 0) + value,
    }),
    current
  );
};

export const createVisualRuleResolver = ({ visualMapping }: LoadedMapBakeContent) => {
  const ruleByBiome = new Map(
    visualMapping.biome_visual_rules.map((rule) => [rule.biome_id, rule] as const)
  );

  return {
    resolveMapRules(semanticMap: GeneratedSemanticMap): Map<string, ResolvedBiomeVisualRule> {
      const roomById = new Map(semanticMap.rooms.map((room) => [room.roomId, room] as const));

      return new Map(
        semanticMap.cells
          .filter((cell) => cell.cellType === 'floor')
          .map((cell) => {
            const room = cell.roomId ? roomById.get(cell.roomId) ?? null : null;
            const biomeId = cell.biomeId ?? room?.biomeId ?? visualMapping.default_biome_id;
            const biomeRule = ruleByBiome.get(biomeId);

            if (!biomeRule) {
              return [
                `${cell.x},${cell.y}`,
                {
                  biomeId,
                  roomId: room?.roomId ?? null,
                  tilesetId: biomeId,
                  variantWeights: { base: 1 },
                  macroOverlayBias: [],
                  detailBias: [],
                },
              ] as const;
            }

            const resolved = Object.entries(biomeRule.parameter_mapping).reduce<ResolvedBiomeVisualRule>(
              (current, [parameterName, ranges]) => {
                const parameterValue = room ? readRoomParameter(room, parameterName) : null;

                if (parameterValue === null) {
                  return current;
                }

                const matchedEntry = Object.entries(ranges).find(([rangeKey]) =>
                  rangeMatches(rangeKey, parameterValue)
                )?.[1];

                if (!matchedEntry) {
                  return current;
                }

                return {
                  ...current,
                  variantWeights: mergeWeights(current.variantWeights, matchedEntry.variant_weights),
                  macroOverlayBias: [
                    ...new Set([...current.macroOverlayBias, ...(matchedEntry.macro_overlay_bias ?? [])]),
                  ],
                  detailBias: [
                    ...new Set([...current.detailBias, ...(matchedEntry.detail_bias ?? [])]),
                  ],
                };
              },
              {
                biomeId,
                roomId: room?.roomId ?? null,
                tilesetId: biomeRule.base_tileset_id,
                variantWeights: {},
                macroOverlaySetId: biomeRule.macro_overlay_set_id,
                detailDecalSetId: biomeRule.detail_decal_set_id,
                macroOverlayBias: [],
                detailBias: [],
              }
            );

            return [
              `${cell.x},${cell.y}`,
              {
                ...resolved,
                variantWeights:
                  Object.keys(resolved.variantWeights).length > 0 ? resolved.variantWeights : { base: 1 },
              },
            ] as const;
          })
      );
    },
  };
};

const readRoomParameter = (room: SemanticRoom, parameterName: string): number | null => {
  switch (parameterName) {
    case 'wear_level':
      return room.wearLevel;
    case 'moisture_level':
      return room.moistureLevel;
    case 'growth_level':
      return room.growthLevel;
    case 'danger_level':
      return room.dangerLevel;
    default:
      return null;
  }
};
