import { contentRegistry } from '../content/contentRegistry';
import type {
  BiomeGenerationProfile,
  ResolvedSectionProfile,
  ResolvedSectionProfileInput,
  SectionKind,
  SettlementGenerationProfile,
} from '../types';
import { createSeededRandom, hashString } from './seed';

const DEFAULT_FLOOR_MATERIAL_KEY = 'dungeon_stone';

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

const unique = (values: string[]) => [...new Set(values.filter(Boolean))];

const sortById = <T extends { id: string }>(values: T[]) =>
  [...values].sort((left, right) => left.id.localeCompare(right.id));

const computeGraphDepth = (
  coordinates: { x: number; y: number },
  graphDepth: number | undefined
) => graphDepth ?? Math.abs(coordinates.x) + Math.abs(coordinates.y);

const createProfileSeed = ({
  worldSeed,
  coordinates,
  graphDepth,
}: {
  worldSeed: string;
  coordinates: { x: number; y: number };
  graphDepth: number;
}) =>
  `section_profile_${hashString(
    `${worldSeed}:${coordinates.x},${coordinates.y}:${graphDepth}`
  )}`;

const supportsRequestedKind = (
  profile: BiomeGenerationProfile,
  requestedSectionKind: SectionKind | undefined
) =>
  !requestedSectionKind ||
  !profile.allowed_section_kinds?.length ||
  profile.allowed_section_kinds.includes(requestedSectionKind);

const supportsSettlementProfile = (
  biomeProfile: BiomeGenerationProfile,
  settlementProfile: SettlementGenerationProfile | undefined
) =>
  !settlementProfile ||
  !settlementProfile.allowed_biomes?.length ||
  settlementProfile.allowed_biomes.includes(biomeProfile.id);

const repetitionPenalty = (existingIds: string[] | undefined, candidateId: string, step: number) =>
  (existingIds ?? []).filter((id) => id === candidateId).length * step;

const toSelectionWeight = (score: number) => Math.sqrt(Math.max(score, 0) + 0.001);

const chooseWeighted = <T extends { score: number }>({
  scored,
  seed,
}: {
  scored: T[];
  seed: string;
}) => {
  if (scored.length === 0) {
    return null;
  }

  const weighted = scored.map((entry) => ({
    ...entry,
    weight: toSelectionWeight(entry.score),
  }));
  const totalWeight = weighted.reduce((sum, entry) => sum + entry.weight, 0);

  if (totalWeight <= 0) {
    return [...scored].sort((left, right) => right.score - left.score)[0] ?? null;
  }

  const roll = createSeededRandom(seed)() * totalWeight;
  let cursor = 0;

  for (const entry of weighted) {
    cursor += entry.weight;
    if (roll <= cursor) {
      return entry;
    }
  }

  return weighted[weighted.length - 1] ?? null;
};

const findBiomeProfile = ({
  biomeProfiles,
  requestedSectionKind,
  forcedBiomeProfileId,
  forcedSettlementProfile,
  siblingBiomeIds,
  worldSeed,
  coordinates,
  graphDepth,
}: {
  biomeProfiles: BiomeGenerationProfile[];
  requestedSectionKind?: SectionKind;
  forcedBiomeProfileId?: string;
  forcedSettlementProfile?: SettlementGenerationProfile;
  siblingBiomeIds?: string[];
  worldSeed: string;
  coordinates: { x: number; y: number };
  graphDepth: number;
}) => {
  const sortedProfiles = sortById(biomeProfiles);
  const forcedBiomeProfile = forcedBiomeProfileId
    ? sortedProfiles.find((profile) => profile.id === forcedBiomeProfileId)
    : null;

  if (
    forcedBiomeProfile &&
    supportsRequestedKind(forcedBiomeProfile, requestedSectionKind) &&
    supportsSettlementProfile(forcedBiomeProfile, forcedSettlementProfile)
  ) {
    return forcedBiomeProfile;
  }

  const eligibleProfiles = sortedProfiles.filter((profile) =>
    supportsRequestedKind(profile, requestedSectionKind) &&
    supportsSettlementProfile(profile, forcedSettlementProfile)
  );
  const profiles = eligibleProfiles.length > 0 ? eligibleProfiles : sortedProfiles;
  const routeCentrality = clamp01(1 - graphDepth / 6);

  const scoredProfiles = profiles.map((profile) => {
    const jitterRandom = createSeededRandom(
      `${worldSeed}:${coordinates.x},${coordinates.y}:${graphDepth}:biome:${profile.id}`
    );
    const kindAffinity =
      requestedSectionKind === 'settlement'
        ? profile.allowed_section_kinds?.includes('settlement')
          ? 0.3
          : -0.3
        : 0;
    const siblingPenalty = repetitionPenalty(siblingBiomeIds, profile.id, 0.35);
    const score =
      profile.settlement_pressure * (0.65 + routeCentrality * 0.35) +
      (1 - profile.hazard_pressure) * 0.25 +
      kindAffinity +
      jitterRandom() * 0.1 -
      siblingPenalty;

    return {
      profile,
      score,
    };
  });

  return (
    chooseWeighted({
      scored: scoredProfiles,
      seed: `${worldSeed}:${coordinates.x},${coordinates.y}:${graphDepth}:biome_choice`,
    })?.profile ?? sortedProfiles[0]
  );
};

const supportsBiome = (
  profile: SettlementGenerationProfile,
  biomeProfileId: string
) => !profile.allowed_biomes?.length || profile.allowed_biomes.includes(biomeProfileId);

const computeLivability = ({
  biomeProfile,
  settlementProfile,
  graphDepth,
}: {
  biomeProfile: BiomeGenerationProfile;
  settlementProfile: SettlementGenerationProfile;
  graphDepth: number;
}) => {
  const routeCentralityBase = clamp01(1 - graphDepth / 6);
  const adjustedRouteCentrality = clamp01(
    routeCentralityBase + settlementProfile.route_centrality_modifier * 0.5
  );
  const safety = clamp01(
    1 - biomeProfile.hazard_pressure + settlementProfile.safety_modifier
  );
  const opennessAlignment = clamp01(
    1 - Math.abs(settlementProfile.open_space_preference - biomeProfile.open_space_ratio)
  );

  return clamp01(
    (biomeProfile.settlement_pressure +
      settlementProfile.water_support +
      settlementProfile.food_support +
      safety +
      adjustedRouteCentrality +
      opennessAlignment) /
      6 -
      biomeProfile.hazard_pressure * 0.2
  );
};

const findSettlementResolution = ({
  settlementProfiles,
  biomeProfile,
  graphDepth,
  forcedSettlementProfileId,
  siblingSettlementProfileIds,
}: {
  settlementProfiles: SettlementGenerationProfile[];
  biomeProfile: BiomeGenerationProfile;
  graphDepth: number;
  forcedSettlementProfileId?: string;
  siblingSettlementProfileIds?: string[];
}) => {
  const sortedProfiles = sortById(settlementProfiles);
  const forcedSettlementProfile = forcedSettlementProfileId
    ? sortedProfiles.find((profile) => profile.id === forcedSettlementProfileId)
    : null;
  const eligibleProfiles = sortedProfiles.filter((profile) =>
    supportsBiome(profile, biomeProfile.id)
  );
  const candidates = forcedSettlementProfile
    ? [forcedSettlementProfile]
    : eligibleProfiles;

  if (candidates.length === 0) {
    return null;
  }

  const rankedCandidates = candidates.map((profile) => ({
      profile,
      score: computeLivability({
        biomeProfile,
        settlementProfile: profile,
        graphDepth,
      }) - repetitionPenalty(siblingSettlementProfileIds, profile.id, 0.25),
    }));

  return (
    chooseWeighted({
      scored: rankedCandidates,
      seed: `${biomeProfile.id}:${graphDepth}:settlement_choice`,
    }) ?? null
  );
};

export const resolveSectionProfileFromPacks = ({
  worldSeed,
  coordinates,
  graphDepth: explicitGraphDepth,
  requestedSectionKind,
  forcedBiomeProfileId,
  forcedSettlementProfileId,
  siblingBiomeIds,
  siblingSettlementProfileIds,
  biomeProfiles,
  settlementProfiles,
}: ResolvedSectionProfileInput & {
  biomeProfiles: BiomeGenerationProfile[];
  settlementProfiles: SettlementGenerationProfile[];
}): ResolvedSectionProfile => {
  const graphDepth = computeGraphDepth(coordinates, explicitGraphDepth);
  const seed = createProfileSeed({ worldSeed, coordinates, graphDepth });
  const forcedSettlementProfile = forcedSettlementProfileId
    ? sortById(settlementProfiles).find((profile) => profile.id === forcedSettlementProfileId)
    : undefined;
  const biomeProfile = findBiomeProfile({
    biomeProfiles,
    requestedSectionKind,
    forcedBiomeProfileId,
    forcedSettlementProfile,
    siblingBiomeIds,
    worldSeed,
    coordinates,
    graphDepth,
  });
  const settlementResolution = findSettlementResolution({
    settlementProfiles,
    biomeProfile,
    graphDepth,
    forcedSettlementProfileId,
    siblingSettlementProfileIds,
  });
  const settlementChance =
    requestedSectionKind === 'settlement'
      ? 1
      : clamp01(
          (biomeProfile.settlement_pressure *
            (settlementResolution?.score ?? 0) *
            clamp01(0.85 - graphDepth * 0.08))
        );
  const settlementRoll = createSeededRandom(`${seed}:settlement_roll`)();
  const canUseSettlementKind =
    requestedSectionKind === 'settlement' ||
    Boolean(
      settlementResolution &&
        (!biomeProfile.allowed_section_kinds?.length ||
          biomeProfile.allowed_section_kinds.includes('settlement')) &&
        settlementResolution.score >= settlementResolution.profile.minimum_livability_score &&
        settlementRoll <= settlementChance
    );
  const settlementProfile =
    requestedSectionKind === 'settlement'
      ? settlementResolution?.profile ?? null
      : canUseSettlementKind
        ? settlementResolution?.profile ?? null
        : null;
  const livabilityScore = settlementResolution?.score ?? 0;
  const sectionKind: SectionKind =
    requestedSectionKind === 'settlement' || settlementProfile ? 'settlement' : 'exploration';

  return {
    seed,
    coordinates,
    graphDepth,
    sectionKind,
    biomeProfileId: biomeProfile.id,
    settlementProfileId: settlementProfile?.id ?? null,
    livabilityScore,
    defaultFloorMaterialKey:
      settlementProfile?.default_floor_material_key ??
      biomeProfile.default_floor_material_key ??
      DEFAULT_FLOOR_MATERIAL_KEY,
    roomPrimitiveDensity: biomeProfile.room_primitive_density,
    corridorDensity: biomeProfile.corridor_density,
    junctionDensity: biomeProfile.junction_density,
    openSpaceRatio:
      sectionKind === 'settlement' && settlementProfile
        ? clamp01(
            (biomeProfile.open_space_ratio + settlementProfile.open_space_preference) / 2
          )
        : biomeProfile.open_space_ratio,
    landmarkFrequency: biomeProfile.landmark_frequency,
    allowedRoomPrimitiveIds: unique(biomeProfile.allowed_room_primitive_ids ?? []),
    allowedCorridorPrimitiveIds: unique(
      biomeProfile.allowed_corridor_primitive_ids ?? []
    ),
    settlementPrimitivePreferenceIds: unique(
      settlementProfile?.primitive_preferences ?? []
    ),
  };
};

export const resolveSectionProfile = (
  input: ResolvedSectionProfileInput
): ResolvedSectionProfile =>
  resolveSectionProfileFromPacks({
    ...input,
    biomeProfiles: contentRegistry.loadPack('biome_generation_profiles').entries,
    settlementProfiles: contentRegistry.loadPack('settlement_generation_profiles').entries,
  });
