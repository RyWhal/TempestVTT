import { contentRegistry } from '../content/contentRegistry';
import type {
  Biome,
  BiomeGenerationProfile,
  GeneratedSection,
  SectionKind,
} from '../types';
import { createSeededRandom, hashString } from './seed';

const asString = (value: unknown, fallback = '') =>
  typeof value === 'string' ? value : fallback;

const asStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];

const toTitleCase = (value: string) =>
  value
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase())
    .join(' ');

const uniqueWords = (items: string[]) => {
  const normalized = items
    .map((item) => item.trim())
    .filter(Boolean);

  return [...new Set(normalized)];
};

const pickOne = (items: string[], nextRandom: () => number, fallback: string) => {
  if (items.length === 0) {
    return fallback;
  }

  return items[Math.floor(nextRandom() * items.length)] ?? fallback;
};

const fallbackAdjectives = [
  'Ash',
  'Cinder',
  'Gloam',
  'Hollow',
  'Iron',
  'Mire',
  'Moss',
  'Root',
  'Stone',
  'Umber',
];

const explorationNouns = [
  'Archive',
  'Bastion',
  'Chapel',
  'Channel',
  'Court',
  'Crucible',
  'Gallery',
  'Hollow',
  'Sanctum',
  'Span',
  'Vault',
  'Warren',
];

const frontierSettlementNouns = [
  'Bastion',
  'Crossing',
  'Gate',
  'Market',
  'Post',
  'Row',
  'Span',
  'Verge',
  'Watch',
];

const refugeSettlementNouns = ['Green', 'Hearth', 'Hold', 'Quarter', 'Square', 'Yard'];

const blockedDescriptorWords = new Set([
  'The',
  'And',
  'Of',
  'Food',
  'Flow',
  'Neutral',
  'Safe',
  'Settlement',
  'Stable',
]);

const getBiome = (section: GeneratedSection): Biome => {
  const biomes = contentRegistry.loadPack('biomes').biomes;

  return (
    biomes.find((candidate) => candidate.id === section.primaryBiomeId) ??
    biomes.find((candidate) => candidate.id === 'stone_halls') ??
    biomes[0]
  );
};

const getBiomeGenerationProfile = (section: GeneratedSection): BiomeGenerationProfile | null => {
  const profiles = contentRegistry.loadPack('biome_generation_profiles').entries;

  return profiles.find((profile) => profile.id === section.primaryBiomeId) ?? null;
};

const buildDescriptorPool = (biome: Biome) =>
  uniqueWords([
    ...asString(biome.name, biome.id).split(/[\s_-]+/),
    ...asStringArray((biome as Record<string, unknown>).tags),
    ...asStringArray((biome as Record<string, unknown>).materials),
    ...asStringArray((biome as Record<string, unknown>).hazards),
  ])
    .map(toTitleCase)
    .filter((word) => !blockedDescriptorWords.has(word));

const getSettlementFlavor = (
  biome: Biome,
  biomeProfile: BiomeGenerationProfile | null
): 'frontier' | 'refuge' | 'mixed' => {
  const hazardPressure = biomeProfile?.hazard_pressure ?? 0.5;
  const settlementPressure = biomeProfile?.settlement_pressure ?? 0.5;
  const tags = new Set(asStringArray((biome as Record<string, unknown>).tags).map((tag) => tag.toLowerCase()));
  const tone = asString((biome as Record<string, unknown>).tone).toLowerCase();

  if (
    hazardPressure >= 0.55 ||
    settlementPressure <= 0.3 ||
    tags.has('hazard') ||
    tags.has('horror') ||
    tone.includes('bleak') ||
    tone.includes('creepy') ||
    tone.includes('gross') ||
    tone.includes('isolating') ||
    tone.includes('oppressive')
  ) {
    return 'frontier';
  }

  if (
    hazardPressure <= 0.3 &&
    settlementPressure >= 0.65 &&
    (tags.has('safe') ||
      tone.includes('communal') ||
      tone.includes('grounded') ||
      tone.includes('controlled'))
  ) {
    return 'refuge';
  }

  return 'mixed';
};

const buildNounPool = (
  biome: Biome,
  sectionKind: SectionKind,
  biomeProfile: BiomeGenerationProfile | null
) => {
  const biomeNoun = toTitleCase(asString(biome.name, biome.id).split(/[\s_-]+/).slice(1).join(' ')).trim();

  if (sectionKind !== 'settlement') {
    return uniqueWords([
      ...asString(biome.name, biome.id).split(/[\s_-]+/).slice(1).map(toTitleCase),
      ...explorationNouns,
    ]);
  }

  const flavor = getSettlementFlavor(biome, biomeProfile);

  if (flavor === 'frontier') {
    return frontierSettlementNouns.filter((noun) => noun !== biomeNoun);
  }

  if (flavor === 'refuge') {
    return refugeSettlementNouns.filter((noun) => noun !== biomeNoun);
  }

  return uniqueWords([...frontierSettlementNouns, ...refugeSettlementNouns]).filter(
    (noun) => noun !== biomeNoun
  );
};

const buildSettlementDescriptorPool = (
  biome: Biome,
  biomeProfile: BiomeGenerationProfile | null
) => {
  const flavor = getSettlementFlavor(biome, biomeProfile);

  if (flavor === 'frontier') {
    return ['Ash', 'Black', 'Cinder', 'Ember', 'Grit', 'Iron', 'Rift', 'Thorn', 'Watch'];
  }

  if (flavor === 'refuge') {
    return ['Bell', 'Garden', 'Lantern', 'Market', 'Way', 'Willow'];
  }

  return ['Bell', 'Crown', 'Iron', 'Lantern', 'Market', 'Watch', 'Way'];
};

export const generateSectionLabel = ({
  worldSeed,
  sectionId,
  section,
}: {
  worldSeed: string;
  sectionId: string;
  section: GeneratedSection;
}): string => {
  const biome = getBiome(section);
  const biomeProfile = getBiomeGenerationProfile(section);
  const nextRandom = createSeededRandom(`${worldSeed}:${sectionId}:label:${hashString(section.primaryBiomeId)}`);
  const descriptor = pickOne(buildDescriptorPool(biome), nextRandom, pickOne(fallbackAdjectives, nextRandom, 'Stone'));
  const noun = pickOne(
    buildNounPool(biome, section.sectionKind, biomeProfile),
    nextRandom,
    section.sectionKind === 'settlement' ? 'Crossing' : 'Vault'
  );

  const secondaryDescriptorPool =
    section.sectionKind === 'settlement'
      ? buildSettlementDescriptorPool(biome, biomeProfile)
      : ['Deep', 'Black', 'Silent', 'Crown', 'Glass', 'Ember'];
  const secondaryDescriptor = pickOne(secondaryDescriptorPool, nextRandom, 'Stone');

  const variants = [
    `${descriptor} ${noun}`,
    `${secondaryDescriptor} ${noun}`,
    `${descriptor}${noun}`,
  ];

  return variants[Math.floor(nextRandom() * variants.length)] ?? `${descriptor} ${noun}`;
};
