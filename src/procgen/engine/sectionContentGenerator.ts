import { contentRegistry } from '../content/contentRegistry';
import type {
  Biome,
  GeneratedSectionHook,
  GeneratedSection,
  GeneratedSectionContent,
  GeneratedSectionCreature,
  GeneratedSectionEncounter,
  GeneratedSectionHazard,
  GeneratedSectionNpc,
  GeneratedSectionRumor,
  GeneratedSectionShop,
  SectionContentRerollState,
  SectionContentRerollScope,
  VillageArchetype,
} from '../types';
import { generateCampaignBook } from './campaignBookGenerator';
import { generateNpcEntities, resolveSettlementArchetype } from './npcEntityGenerator';
import { createSeededRandom } from './seed';

interface GenerateSectionContentInput {
  section: GeneratedSection;
  sectionName: string;
  rerollState?: Partial<SectionContentRerollState>;
  settlementArchetypeId?: string | null;
}

const DEFAULT_REROLL_STATE: SectionContentRerollState = {
  summary: 0,
  npcs: 0,
  creatures: 0,
  encounters: 0,
  shops: 0,
  hazards: 0,
  rumors: 0,
};

const asString = (value: unknown, fallback = '') =>
  typeof value === 'string' ? value : fallback;

const asStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];

const mergeRerollState = (
  rerollState: Partial<SectionContentRerollState> | undefined
): SectionContentRerollState => ({
  ...DEFAULT_REROLL_STATE,
  ...rerollState,
});

const pickOne = <T>(items: T[], nextRandom: () => number, fallback: T): T => {
  if (items.length === 0) {
    return fallback;
  }

  return items[Math.floor(nextRandom() * items.length)] ?? fallback;
};

const pickManyUnique = <T>(
  items: T[],
  countRange: [number, number],
  nextRandom: () => number
) => {
  const pool = [...items];
  const countFloor = Math.max(0, Math.min(countRange[0], countRange[1]));
  const countCeiling = Math.max(countFloor, countRange[1]);
  const count = Math.min(
    pool.length,
    countFloor + Math.floor(nextRandom() * (countCeiling - countFloor + 1))
  );
  const picked: T[] = [];

  while (pool.length > 0 && picked.length < count) {
    const index = Math.floor(nextRandom() * pool.length);
    const [item] = pool.splice(index, 1);
    if (item !== undefined) {
      picked.push(item);
    }
  }

  return picked;
};

const matchesAllowedValues = (value: unknown, candidate: string | null) => {
  if (!Array.isArray(value) || value.length === 0) {
    return true;
  }

  if (!candidate) {
    return false;
  }

  return value.includes(candidate);
};

interface FlavorContext {
  sectionKind: string;
  settlementArchetypeId: string | null;
  biomeId: string;
  shopTypeId?: string | null;
  shopRoleId?: string | null;
}

const matchesFlavorContext = (entry: Record<string, unknown>, context: FlavorContext) =>
  matchesAllowedValues(entry.allowed_section_kinds, context.sectionKind) &&
  matchesAllowedValues(entry.allowed_settlement_archetypes, context.settlementArchetypeId) &&
  matchesAllowedValues(entry.allowed_biomes, context.biomeId) &&
  matchesAllowedValues(entry.allowed_shop_types, context.shopTypeId ?? null) &&
  matchesAllowedValues(entry.required_shop_roles, context.shopRoleId ?? null);

const FLAVOR_SPECIFICITY_WEIGHTS: Record<string, number> = {
  allowed_shop_types: 8,
  required_shop_roles: 4,
  allowed_biomes: 2,
  allowed_settlement_archetypes: 1,
  allowed_section_kinds: 1,
};

const getFlavorSpecificity = (entry: Record<string, unknown>) =>
  Object.entries(FLAVOR_SPECIFICITY_WEIGHTS).reduce(
    (score, [key, weight]) => score + (Array.isArray(entry[key]) && entry[key].length > 0 ? weight : 0),
    0
  );

const pickMatchingEntry = <T extends Record<string, unknown>>(
  entries: T[],
  context: FlavorContext,
  nextRandom: () => number,
  fallback: T
) => {
  const matching = entries.filter((entry) => matchesFlavorContext(entry, context));
  const bestSpecificity = matching.reduce(
    (highest, entry) => Math.max(highest, getFlavorSpecificity(entry)),
    0
  );
  const bestMatches = matching.filter((entry) => getFlavorSpecificity(entry) === bestSpecificity);
  return pickOne(bestMatches, nextRandom, fallback);
};

const replaceToken = (value: string, token: string, replacement: string) =>
  value.split(token).join(replacement);

const applyTemplateTokens = (value: string, tokens: Record<string, string>) =>
  Object.entries(tokens).reduce(
    (result, [token, replacement]) => replaceToken(result, `{${token}}`, replacement),
    value
  );

const uniqueStrings = (values: string[]) => [...new Set(values.filter(Boolean))];
const humanizeId = (value: string) => value.split('_').join(' ');

const roundCreatureHp = (value: number) => Math.max(1, Math.round(value));

const resolveCreatureVariantStats = (
  baseTemplate: {
    ac: number;
    hp: number;
    speed: number;
    cr: number;
    abilities: {
      str: number;
      dex: number;
      con: number;
      int: number;
      wis: number;
      cha: number;
    };
  },
  variant: Record<string, unknown> | null
) => {
  const adjustments = (variant?.stat_adjustments ?? {}) as Record<string, unknown>;
  const hpMultiplier = typeof adjustments.hp_multiplier === 'number' ? adjustments.hp_multiplier : 1;
  const speedDelta = typeof adjustments.speed_delta === 'number' ? adjustments.speed_delta : 0;
  const acDelta = typeof adjustments.ac_delta === 'number' ? adjustments.ac_delta : 0;
  const sizeOverride =
    typeof adjustments.size_override === 'string' ? adjustments.size_override : null;

  return {
    sizeOverride,
    resolvedStats: {
      ac: Math.max(5, baseTemplate.ac + acDelta),
      hp: roundCreatureHp(baseTemplate.hp * hpMultiplier),
      speed: Math.max(0, baseTemplate.speed + speedDelta),
      cr: baseTemplate.cr,
      abilities: { ...baseTemplate.abilities },
    },
  };
};

const getBiome = (section: GeneratedSection) => {
  const biomes = contentRegistry.loadPack('biomes').biomes;
  return (
    biomes.find((candidate) => candidate.id === section.primaryBiomeId) ??
    biomes.find((candidate) => candidate.id === 'stone_halls') ??
    biomes[0]
  );
};

const generateCreatures = ({
  section,
  biome,
  nextRandom,
}: {
  section: GeneratedSection;
  biome: Biome;
  nextRandom: () => number;
}): GeneratedSectionCreature[] => {
  const families = contentRegistry.loadPack('creature_families').creatureFamilies;
  const anchorTemplates = contentRegistry.loadPack('creature_anchor_templates').creatureAnchorTemplates;
  const variants = contentRegistry.loadPack('creature_variants').creatureVariants;
  const matchingFamilies = families.filter((family) =>
    asStringArray((family as Record<string, unknown>).allowed_biomes).includes(section.primaryBiomeId)
  );
  const creaturePool = matchingFamilies.length > 0 ? matchingFamilies : families;
  const countRange: [number, number] = section.sectionKind === 'settlement' ? [1, 2] : [2, 4];

  return pickManyUnique(creaturePool, countRange, nextRandom).map((family, index) => {
    const allowedVariantIds = asStringArray((family as Record<string, unknown>).variants_allowed);
    const allowedVariants = variants.filter((variant) => allowedVariantIds.includes(variant.id));
    const chosenVariant = allowedVariants.length > 0 ? pickOne(allowedVariants, nextRandom, allowedVariants[0]) : null;
    const variantName = chosenVariant ? asString(chosenVariant.name, chosenVariant.id) : '';
    const familyName = asString(family.name, family.id);
    const base5eAnalog = asString((family as Record<string, unknown>).base_5e_analog, 'unknown');
    const baseTemplate =
      anchorTemplates.find((template) => template.id === base5eAnalog) ?? {
        id: 'fallback',
        ac: 12,
        hp: 18,
        speed: 30,
        cr: 0.25,
        abilities: { str: 10, dex: 12, con: 10, int: 4, wis: 10, cha: 6 },
        actions: [{ name: 'Attack', summary: '+3 to hit; 1d6+1 damage.' }],
        traits: ['Uncatalogued threat'],
      };
    const resolvedVariant = resolveCreatureVariantStats(
      baseTemplate,
      chosenVariant as Record<string, unknown> | null
    );
    const variantBehaviorAdjustments = asStringArray(
      (chosenVariant as Record<string, unknown> | undefined)?.behavior_adjustments
    );
    const traitSet = uniqueStrings([
      ...baseTemplate.traits,
      ...asStringArray((family as Record<string, unknown>).signature_traits),
      ...variantBehaviorAdjustments.map((value) => humanizeId(value)),
    ]);

    return {
      id: `creature_${index + 1}`,
      familyId: family.id,
      name: chosenVariant ? `${variantName} ${familyName}` : familyName,
      origin: asString((family as Record<string, unknown>).origin, 'native'),
      sizeClass:
        resolvedVariant.sizeOverride ??
        asString((family as Record<string, unknown>).size_class, 'medium'),
      intelligence: asString((family as Record<string, unknown>).intelligence, 'low'),
      temperament: asString(
        (family as Record<string, unknown>).default_temperament,
        section.sectionKind === 'settlement' ? 'watchful' : 'aggressive'
      ),
      hook: pickOne(
        asStringArray((family as Record<string, unknown>).hooks),
        nextRandom,
        `seen around the ${asString(biome.name, biome.id)}`
      ),
      role: asString((family as Record<string, unknown>).default_role, 'lurker'),
      societyLevel: asString((family as Record<string, unknown>).society_level, 'none'),
      base5eAnalog,
      visualKeywords: uniqueStrings([
        ...asStringArray((family as Record<string, unknown>).visual_keywords),
        ...asStringArray((chosenVariant as Record<string, unknown> | undefined)?.visual_keywords),
      ]),
      signatureTraits: asStringArray((family as Record<string, unknown>).signature_traits),
      lootTags: asStringArray((family as Record<string, unknown>).loot_tags),
      variantIds: chosenVariant ? [chosenVariant.id] : [],
      variantNames: chosenVariant ? [variantName] : [],
      variantVisualKeywords: asStringArray(
        (chosenVariant as Record<string, unknown> | undefined)?.visual_keywords
      ),
      behaviorAdjustments: variantBehaviorAdjustments,
      resolvedStats: resolvedVariant.resolvedStats,
      actions: baseTemplate.actions.map((action) => ({ ...action })),
      traits: traitSet,
    };
  });
};

const generateShops = ({
  section,
  archetype,
  npcs,
  nextRandom,
}: {
  section: GeneratedSection;
  archetype: VillageArchetype | null;
  npcs: GeneratedSectionNpc[];
  nextRandom: () => number;
}): GeneratedSectionShop[] => {
  if (section.sectionKind !== 'settlement' || !archetype) {
    return [];
  }

  const shopTypes = contentRegistry.loadPack('shop_types').shopTypes;
  const shopFlavor = contentRegistry.loadPack('shop_flavor_fragments');
  const items = contentRegistry.loadPack('item_tables').itemTemplates;
  const archetypeId = archetype.id;
  const matchingShops = shopTypes.filter((shopType) => {
    const record = shopType as Record<string, unknown>;
    const archetypeMatch = asStringArray(record.allowed_settlement_archetypes).includes(archetypeId);
    const biomeMatch = asStringArray(record.allowed_biomes).includes(section.primaryBiomeId);
    return archetypeMatch && biomeMatch;
  });
  const chosenShops = pickManyUnique(
    matchingShops.length > 0 ? matchingShops : shopTypes,
    [2, 3],
    nextRandom
  );

  return chosenShops.map((shopType, index) => {
    const record = shopType as Record<string, unknown>;
    const requiredRoleIds = asStringArray(record.required_role_ids);
    const owner =
      npcs.find((npc) => requiredRoleIds.includes(npc.roleId)) ??
      npcs[index % Math.max(1, npcs.length)];
    const shopContext: FlavorContext = {
      sectionKind: section.sectionKind,
      settlementArchetypeId: archetype.id,
      biomeId: section.primaryBiomeId,
      shopTypeId: shopType.id,
      shopRoleId: owner?.roleId ?? null,
    };
    const stockBiasCategories = asStringArray(record.stock_bias_categories);
    const featuredStock = pickManyUnique(
      items.filter((item) =>
        stockBiasCategories.includes(asString((item as Record<string, unknown>).category_id))
      ),
      [2, 3],
      nextRandom
    ).map((item) => asString(item.name, item.id));
    const descriptionEntry = pickMatchingEntry(
      shopFlavor.descriptions,
      shopContext,
      nextRandom,
      shopFlavor.descriptions[0]
    );
    const pressureEntry = pickMatchingEntry(
      shopFlavor.pressures,
      shopContext,
      nextRandom,
      shopFlavor.pressures[0]
    );

    return {
      id: `shop_${index + 1}`,
      shopTypeId: shopType.id,
      name: `${asString(shopType.name, shopType.id)}${owner ? ` (${owner.roleName})` : ''}`,
      ownerName: owner?.roleName ?? 'Unassigned Keeper',
      services: pickManyUnique(asStringArray(record.services), [2, 3], nextRandom),
      featuredStock,
      description: applyTemplateTokens(descriptionEntry.text, {
        section_name: section.sectionId,
        biome_name: section.primaryBiomeId,
      }),
      pressure: applyTemplateTokens(pressureEntry.text, {
        section_name: section.sectionId,
        biome_name: section.primaryBiomeId,
      }),
    };
  });
};

const generateHazards = ({
  section,
  biome,
  nextRandom,
}: {
  section: GeneratedSection;
  biome: Biome;
  nextRandom: () => number;
}): GeneratedSectionHazard[] => {
  const hazards = asStringArray((biome as Record<string, unknown>).hazards);
  if (hazards.length === 0) {
    return [];
  }

  return pickManyUnique(hazards, section.sectionKind === 'settlement' ? [1, 1] : [1, 2], nextRandom).map(
    (hazard, index) => ({
      id: `hazard_${index + 1}`,
      name: hazard,
      summary:
        section.sectionKind === 'settlement'
          ? `Locals know how to manage ${hazard}, but expeditions still get caught by it.`
          : `${hazard} shapes how this section is approached and explored.`,
    })
  );
};

const generateRumors = ({
  section,
  sectionName,
  biome,
  archetype,
  npcs,
  nextRandom,
}: {
  section: GeneratedSection;
  sectionName: string;
  biome: Biome;
  archetype: VillageArchetype | null;
  npcs: GeneratedSectionNpc[];
  nextRandom: () => number;
}): GeneratedSectionRumor[] => {
  const rumorFragments = contentRegistry.loadPack('rumor_fragments').rumorFragments;
  const rumors: GeneratedSectionRumor[] = [];
  const baseContext: FlavorContext = {
    sectionKind: section.sectionKind,
    settlementArchetypeId: archetype?.id ?? null,
    biomeId: section.primaryBiomeId,
  };

  if (archetype) {
    const defaultProblems = asStringArray((archetype as Record<string, unknown>).default_problems);
    for (const [index, problem] of pickManyUnique(defaultProblems, [1, 2], nextRandom).entries()) {
      const fragment = pickMatchingEntry(
        rumorFragments.filter((entry) => entry.category === 'settlement_problem'),
        baseContext,
        nextRandom,
        rumorFragments[0]
      );
      rumors.push({
        id: `rumor_problem_${index + 1}`,
        text: applyTemplateTokens(fragment.text, {
          problem,
          settlement_name: asString(archetype.name, archetype.id),
          section_name: sectionName,
          biome_name: asString(biome.name, biome.id),
        }),
        source: applyTemplateTokens(fragment.source ?? asString(archetype.name, archetype.id), {
          settlement_name: asString(archetype.name, archetype.id),
        }),
      });
    }
  }

  for (const [index, npc] of npcs.slice(0, 3).entries()) {
    const fragment = pickMatchingEntry(
      rumorFragments.filter((entry) => entry.category === 'npc_rumor'),
      baseContext,
      nextRandom,
      rumorFragments[0]
    );
    rumors.push({
      id: `rumor_npc_${index + 1}`,
      text: applyTemplateTokens(fragment.text, {
        npc_rumor: npc.rumor,
        npc_role_name: npc.roleName,
        section_name: sectionName,
      }),
      source: applyTemplateTokens(fragment.source ?? npc.roleName, {
        npc_role_name: npc.roleName,
      }),
    });
  }

  for (const [index, creatureLabel] of pickManyUnique(
    asStringArray((biome as Record<string, unknown>).common_creatures),
    [1, 2],
    nextRandom
  ).entries()) {
    const fragment = pickMatchingEntry(
      rumorFragments.filter((entry) => entry.category === 'creature_rumor'),
      baseContext,
      nextRandom,
      rumorFragments[0]
    );
    rumors.push({
      id: `rumor_creature_${index + 1}`,
      text: applyTemplateTokens(fragment.text, {
        creature_label: creatureLabel,
        section_name: sectionName,
      }),
      source: applyTemplateTokens(
        fragment.source ?? (section.sectionKind === 'settlement' ? 'expedition talk' : 'fresh signs'),
        {}
      ),
    });
  }

  if (section.sectionKind === 'exploration') {
    const fragment = pickMatchingEntry(
      rumorFragments.filter((entry) => entry.category === 'biome_warning'),
      baseContext,
      nextRandom,
      rumorFragments[0]
    );
    rumors.push({
      id: `rumor_biome_${rumors.length + 1}`,
      text: applyTemplateTokens(fragment.text, {
        section_name: sectionName,
        biome_name: asString(biome.name, biome.id),
      }),
      source: applyTemplateTokens(fragment.source ?? asString(biome.name, biome.id), {
        biome_name: asString(biome.name, biome.id),
      }),
    });
  }

  return rumors.slice(0, section.sectionKind === 'settlement' ? 5 : 4);
};

const generateEncounters = ({
  section,
  sectionName,
  biome,
  archetype,
  npcs,
  hazards,
  nextRandom,
}: {
  section: GeneratedSection;
  sectionName: string;
  biome: Biome;
  archetype: VillageArchetype | null;
  npcs: GeneratedSectionNpc[];
  hazards: GeneratedSectionHazard[];
  nextRandom: () => number;
}): GeneratedSectionEncounter[] => {
  const encounterTemplates = contentRegistry.loadPack('encounter_templates').encounterTemplates;
  const encounters: GeneratedSectionEncounter[] = [];
  const baseContext: FlavorContext = {
    sectionKind: section.sectionKind,
    settlementArchetypeId: archetype?.id ?? null,
    biomeId: section.primaryBiomeId,
  };

  if (section.sectionKind === 'settlement') {
    const shopkeeper = npcs.find((npc) => npc.roleName.toLowerCase().includes('merchant'));
    const settlementTemplate = pickMatchingEntry(
      encounterTemplates.filter((entry) => entry.id === 'settlement_gate_tension'),
      baseContext,
      nextRandom,
      encounterTemplates[0]
    );
    encounters.push({
      id: 'encounter_settlement_1',
      title: applyTemplateTokens(settlementTemplate.title, {
        section_name: sectionName,
        biome_name: asString(biome.name, biome.id),
        hazard_summary: hazards[0]?.summary ?? '',
      }),
      summary: applyTemplateTokens(settlementTemplate.summary, {
        section_name: sectionName,
        biome_name: asString(biome.name, biome.id),
      }),
      detail: applyTemplateTokens(settlementTemplate.detail, {
        section_name: sectionName,
      }),
      threatLevel: settlementTemplate.threat_level,
    });

    if (shopkeeper) {
      const tradeTemplate = pickMatchingEntry(
        encounterTemplates.filter((entry) => entry.id === 'settlement_trade_problem'),
        {
          ...baseContext,
          shopRoleId: shopkeeper.roleId,
        },
        nextRandom,
        encounterTemplates[0]
      );
      encounters.push({
        id: 'encounter_settlement_2',
        title: applyTemplateTokens(tradeTemplate.title, {
          npc_role_name: shopkeeper.roleName,
          section_name: sectionName,
        }),
        summary: applyTemplateTokens(tradeTemplate.summary, {
          npc_role_name: shopkeeper.roleName.toLowerCase(),
          section_name: sectionName,
        }),
        detail: applyTemplateTokens(tradeTemplate.detail, {
          npc_role_name: shopkeeper.roleName.toLowerCase(),
          section_name: sectionName,
        }),
        threatLevel: tradeTemplate.threat_level,
      });
    }
  } else {
    const template = pickMatchingEntry(
      encounterTemplates.filter((entry) => entry.id === 'exploration_biome_pressure'),
      baseContext,
      nextRandom,
      encounterTemplates[0]
    );
    encounters.push({
      id: 'encounter_exploration_1',
      title: applyTemplateTokens(template.title, {
        biome_name: asString(biome.name, biome.id),
      }),
      summary: applyTemplateTokens(template.summary, {
        biome_name: asString(biome.name, biome.id),
      }),
      detail: applyTemplateTokens(template.detail, {
        section_name: sectionName,
        biome_name: asString(biome.name, biome.id),
      }),
      threatLevel: hazards.length > 1 ? 'high' : template.threat_level,
    });
  }

  if (hazards[0]) {
    const template = pickMatchingEntry(
      encounterTemplates.filter((entry) => entry.id === 'hazard_route_complication'),
      baseContext,
      nextRandom,
      encounterTemplates[0]
    );
    encounters.push({
      id: `encounter_hazard_${encounters.length + 1}`,
      title: applyTemplateTokens(template.title, {
        hazard_summary: hazards[0].summary,
      }),
      summary: applyTemplateTokens(template.summary, {
        hazard_summary: hazards[0].summary,
      }),
      detail: applyTemplateTokens(template.detail, {
        hazard_summary: hazards[0].summary,
      }),
      threatLevel: section.sectionKind === 'settlement' ? 'low' : template.threat_level,
    });
  }

  return encounters;
};

const generateHooks = ({
  section,
  archetype,
  npcs,
  rumors,
  encounters,
  nextRandom,
}: {
  section: GeneratedSection;
  archetype: VillageArchetype | null;
  npcs: GeneratedSectionNpc[];
  rumors: GeneratedSectionRumor[];
  encounters: GeneratedSectionEncounter[];
  nextRandom: () => number;
}): GeneratedSectionHook[] => {
  const hookFragments = contentRegistry.loadPack('hook_fragments').hookFragments;
  const baseContext: FlavorContext = {
    sectionKind: section.sectionKind,
    settlementArchetypeId: archetype?.id ?? null,
    biomeId: section.primaryBiomeId,
  };
  const hooks: GeneratedSectionHook[] = [];

  if (rumors[0]) {
    const fragment = pickMatchingEntry(
      hookFragments.filter((entry) => entry.category === 'rumor'),
      baseContext,
      nextRandom,
      hookFragments[0]
    );
    hooks.push({
      id: 'hook_1',
      title: fragment.title,
      text: applyTemplateTokens(fragment.text, {
        rumor_text: rumors[0].text,
        rumor_source: rumors[0].source,
      }),
      source: applyTemplateTokens(fragment.source ?? rumors[0].source, {
        rumor_source: rumors[0].source,
      }),
    });
  }

  if (encounters[0]) {
    const fragment = pickMatchingEntry(
      hookFragments.filter((entry) => entry.category === 'encounter'),
      baseContext,
      nextRandom,
      hookFragments[0]
    );
    hooks.push({
      id: `hook_${hooks.length + 1}`,
      title: fragment.title,
      text: applyTemplateTokens(fragment.text, {
        encounter_summary: encounters[0].summary,
        encounter_title: encounters[0].title,
      }),
      source: applyTemplateTokens(fragment.source ?? encounters[0].title, {
        encounter_title: encounters[0].title,
      }),
    });
  }

  if (section.sectionKind === 'settlement' && npcs[0]) {
    const fragment = pickMatchingEntry(
      hookFragments.filter((entry) => entry.category === 'npc'),
      baseContext,
      nextRandom,
      hookFragments[0]
    );
    hooks.push({
      id: `hook_${hooks.length + 1}`,
      title: fragment.title,
      text: applyTemplateTokens(fragment.text, {
        npc_name: npcs[0].name,
        npc_need: npcs[0].motivation,
        npc_role_name: npcs[0].roleName,
      }),
      source: applyTemplateTokens(fragment.source ?? npcs[0].roleName, {
        npc_role_name: npcs[0].roleName,
      }),
    });
  }

  return hooks.slice(0, 3);
};

const generateSummary = ({
  section,
  sectionName,
  biome,
  archetype,
  npcs,
  creatures,
  nextRandom,
}: {
  section: GeneratedSection;
  sectionName: string;
  biome: Biome;
  archetype: VillageArchetype | null;
  npcs: GeneratedSectionNpc[];
  creatures: GeneratedSectionCreature[];
  nextRandom: () => number;
}) => {
  const tones = asString((biome as Record<string, unknown>).tone, 'uncertain');

  if (section.sectionKind === 'settlement' && archetype) {
    return `${sectionName} is a ${asString(archetype.name, archetype.id).toLowerCase()} set in the ${asString(
      biome.name,
      biome.id
    )}. It feels ${tones}, with ${npcs[0]?.roleName.toLowerCase() ?? 'locals'} holding things together while ${
      creatures[0]?.name ?? 'nearby threats'
    } shape what the town is worried about next.`;
  }

  const creature = creatures[0];
  const angle = creature ? `${creature.name} are the main immediate concern` : 'the route is untested';
  const summaryVariants = [
    `${sectionName} opens into ${asString(biome.description, biome.id).toLowerCase()} ${angle}.`,
    `${sectionName} sits in the ${asString(biome.name, biome.id)}, where ${angle} and every room feels ${tones}.`,
  ];

  return pickOne(summaryVariants, nextRandom, summaryVariants[0]);
};

export const generateSectionContent = ({
  section,
  sectionName,
  rerollState,
  settlementArchetypeId = null,
}: GenerateSectionContentInput): GeneratedSectionContent => {
  const biome = getBiome(section);
  const mergedRerolls = mergeRerollState(rerollState);
  const npcContent = generateNpcEntities({
    section,
    sectionName,
    rerollState: mergedRerolls,
    settlementArchetypeId,
  });
  const stableNpcContent = generateNpcEntities({
    section,
    sectionName,
    rerollState: {
      ...mergedRerolls,
      npcs: 0,
    },
    settlementArchetypeId,
  });
  const archetype = resolveSettlementArchetype(section, settlementArchetypeId);
  const creatureRandom = createSeededRandom(`${section.seed}:creatures:${mergedRerolls.creatures}`);
  const shopRandom = createSeededRandom(`${section.seed}:shops:${mergedRerolls.shops}`);
  const hazardRandom = createSeededRandom(`${section.seed}:hazards:${mergedRerolls.hazards}`);
  const rumorRandom = createSeededRandom(`${section.seed}:rumors:${mergedRerolls.rumors}`);
  const summaryRandom = createSeededRandom(`${section.seed}:summary:${mergedRerolls.summary}`);
  const encounterRandom = createSeededRandom(`${section.seed}:encounters:${mergedRerolls.encounters}`);
  const hookRandom = createSeededRandom(
    `${section.seed}:hooks:${mergedRerolls.rumors}:${mergedRerolls.encounters}:${mergedRerolls.npcs}`
  );

  const npcs = npcContent.npcs;
  const stableNpcs = stableNpcContent.npcs;
  const creatures = generateCreatures({ section, biome, nextRandom: creatureRandom });
  const shops = generateShops({ section, archetype, npcs: stableNpcs, nextRandom: shopRandom });
  const hazards = generateHazards({ section, biome, nextRandom: hazardRandom });
  const rumors = generateRumors({
    section,
    sectionName,
    biome,
    archetype,
    npcs: stableNpcs,
    nextRandom: rumorRandom,
  });
  const encounters = generateEncounters({
    section,
    sectionName,
    biome,
    archetype,
    npcs: stableNpcs,
    hazards,
    nextRandom: encounterRandom,
  });
  const hooks = generateHooks({
    section,
    archetype,
    npcs: stableNpcs,
    rumors,
    encounters,
    nextRandom: hookRandom,
  });

  const generatedContent = {
    sectionName,
    biomeName: asString(biome.name, biome.id),
    summary: generateSummary({
      section,
      sectionName,
      biome,
      archetype,
      npcs: stableNpcs,
      creatures,
      nextRandom: summaryRandom,
    }),
    tone: asString((biome as Record<string, unknown>).tone, 'uncertain'),
    biomeDescription: asString((biome as Record<string, unknown>).description, biome.id),
    settlementArchetypeId: archetype?.id ?? null,
    settlementArchetypeName: archetype ? asString(archetype.name, archetype.id) : null,
    npcEntities: npcContent.npcEntities,
    npcAppearances: npcContent.npcAppearances,
    npcs,
    creatures,
    encounters,
    shops,
    hazards,
    rumors,
    hooks,
  };

  return {
    ...generatedContent,
    campaignBook: generateCampaignBook({
      section,
      sectionName,
      content: generatedContent,
    }),
  };
};

export const getNextContentRerollState = (
  previousState: Partial<SectionContentRerollState> | undefined,
  scope: SectionContentRerollScope
): SectionContentRerollState => {
  const current = mergeRerollState(previousState);

  if (scope === 'all') {
    return {
      summary: current.summary + 1,
      npcs: current.npcs + 1,
      creatures: current.creatures + 1,
      encounters: current.encounters + 1,
      shops: current.shops + 1,
      hazards: current.hazards + 1,
      rumors: current.rumors + 1,
    };
  }

  return {
    ...current,
    [scope]: current[scope] + 1,
  };
};
