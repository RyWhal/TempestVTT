import { contentRegistry } from '../content/contentRegistry';
import type {
  NpcArchetype,
  NpcAnchorTemplate,
  NpcBackstoryFragment,
  NpcContextEntry,
  GeneratedNpcAppearance,
  GeneratedNpcEntity,
  GeneratedSection,
  GeneratedSectionNpc,
  GeneratedSectionNpcContent,
  NamePhonemeSet,
  NpcPhysicalDescription,
  NpcRole,
  NpcRoleplayingEntry,
  NpcModifier,
  NpcRoleToAnchorMapping,
  SectionContentRerollState,
  VillageArchetype,
} from '../types';
import { createSeededRandom, hashString } from './seed';

interface GenerateNpcEntitiesInput {
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

const asNumber = (value: unknown, fallback = 0) =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

const uniqueStrings = (values: string[]) => [...new Set(values)];

const replaceToken = (value: string, token: string, replacement: string) =>
  value.split(token).join(replacement);

const applyTemplateTokens = (value: string, tokens: Record<string, string>) =>
  Object.entries(tokens).reduce(
    (result, [token, replacement]) => replaceToken(result, `{${token}}`, replacement),
    value
  );

const clampAbility = (value: number) => Math.max(3, Math.min(20, value));

const applySectionTokens = (value: string, sectionName: string) =>
  applyTemplateTokens(value, { section_name: sectionName });

const humanizeId = (value: string) => value.split('_').join(' ');

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

interface NpcFlavorContext {
  roleId: string;
  settlementArchetypeId: string | null;
  biomeId: string;
  archetypeId: string | null;
}

interface NpcTemplateContext extends NpcFlavorContext {
  sectionName: string;
  roleName: string;
  motivation: string;
  secret: string;
  rumor: string;
}

const matchesAllowedValues = (value: unknown, candidate: string | null) => {
  if (!Array.isArray(value) || value.length === 0) {
    return true;
  }

  if (!candidate) {
    return false;
  }

  return value.includes(candidate);
};

const matchesFlavorContext = (
  entry: Record<string, unknown>,
  context: NpcFlavorContext
) =>
  matchesAllowedValues(entry.allowed_roles, context.roleId) &&
  matchesAllowedValues(entry.allowed_settlement_archetypes, context.settlementArchetypeId) &&
  matchesAllowedValues(entry.allowed_biomes, context.biomeId) &&
  matchesAllowedValues(entry.allowed_archetypes, context.archetypeId);

const FLAVOR_SPECIFICITY_WEIGHTS: Record<string, number> = {
  allowed_roles: 8,
  allowed_archetypes: 4,
  allowed_biomes: 2,
  allowed_settlement_archetypes: 1,
};

const getFlavorSpecificity = (entry: Record<string, unknown>) =>
  Object.entries(FLAVOR_SPECIFICITY_WEIGHTS).reduce(
    (score, [key, weight]) => score + (Array.isArray(entry[key]) && entry[key].length > 0 ? weight : 0),
    0
  );

const pickMatchingEntry = <T extends Record<string, unknown>>(
  entries: T[],
  context: NpcFlavorContext,
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

const pickManyMatchingEntries = <T extends Record<string, unknown>>(
  entries: T[],
  context: NpcFlavorContext,
  countRange: [number, number],
  nextRandom: () => number
) => {
  const matching = entries.filter((entry) => matchesFlavorContext(entry, context));
  const bestSpecificity = matching.reduce(
    (highest, entry) => Math.max(highest, getFlavorSpecificity(entry)),
    0
  );
  const bestMatches = matching.filter((entry) => getFlavorSpecificity(entry) === bestSpecificity);
  return pickManyUnique(bestMatches, countRange, nextRandom);
};

const createNpcId = ({
  section,
  roleId,
}: {
  section: GeneratedSection;
  roleId: string;
}) => {
  const stableKey = [section.seed, section.sectionId, section.sectionKind, roleId].join(':');
  return `npc_${hashString(stableKey)}`;
};

const buildNameFromPhonemes = (phonemeSet: NamePhonemeSet, nextRandom: () => number) => {
  const patterns = asStringArray((phonemeSet as Record<string, unknown>).patterns);
  const onsets = asStringArray((phonemeSet as Record<string, unknown>).onsets);
  const nuclei = asStringArray((phonemeSet as Record<string, unknown>).nuclei);
  const codas = asStringArray((phonemeSet as Record<string, unknown>).codas);
  const prefixes = asStringArray((phonemeSet as Record<string, unknown>).prefixes);
  const suffixes = asStringArray((phonemeSet as Record<string, unknown>).suffixes);
  const pattern = pickOne(patterns, nextRandom, 'ONC');
  const onset = pickOne(onsets, nextRandom, 'm');
  const nucleus = pickOne(nuclei, nextRandom, 'a');
  const coda = pickOne(codas, nextRandom, 'n');
  const prefix = prefixes.length > 0 ? pickOne(prefixes, nextRandom, '') : '';
  const suffix = suffixes.length > 0 ? pickOne(suffixes, nextRandom, '') : '';
  const base = replaceToken(
    replaceToken(
      replaceToken(
        replaceToken(
          replaceToken(
            replaceToken(pattern, 'PREFIX', prefix),
            'SUFFIX',
            suffix
          ),
          'ONC',
          `${onset}${nucleus}${coda}`
        ),
        'ON',
        `${onset}${nucleus}`
      ),
      '--',
      '-'
    ),
    '-',
    ' '
  );

  return base
    .split(' ')
    .filter(Boolean)
    .map((segment: string) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
};

const buildBaselineBackstory = ({
  pack,
  context,
  sectionName,
  nextRandom,
}: {
  pack: NpcBackstoryFragment[];
  context: NpcFlavorContext;
  sectionName: string;
  nextRandom: () => number;
}) => {
  const fallback = pack[0] ?? { id: 'fallback', text: 'Is part of {section_name} local life.' };
  return applySectionTokens(
    pickMatchingEntry(pack, context, nextRandom, fallback).text,
    sectionName
  );
};

const buildContextValues = ({
  pack,
  context,
  countRange,
  nextRandom,
}: {
  pack: NpcContextEntry[];
  context: NpcTemplateContext;
  countRange: [number, number];
  nextRandom: () => number;
}) => {
  const matching = pickManyMatchingEntries(pack, context, countRange, nextRandom);

  return matching.map((entry) =>
    applyTemplateTokens(entry.text, {
      section_name: context.sectionName,
      role_name: context.roleName,
      motivation: context.motivation,
      secret: context.secret,
      rumor: context.rumor,
    })
  );
};

const resolveCompatibleRole = ({
  role,
  roles,
  settlementType,
}: {
  role: NpcRole;
  roles: NpcRole[];
  settlementType: string | null;
}) => {
  const allowedSettlements = asStringArray((role as Record<string, unknown>).allowed_settlements);
  if (!settlementType || allowedSettlements.length === 0 || allowedSettlements.includes(settlementType)) {
    return role;
  }

  const roleCategory = asString((role as Record<string, unknown>).category);
  return (
    roles.find((candidate) => {
      const candidateCategory = asString((candidate as Record<string, unknown>).category);
      const candidateAllowedSettlements = asStringArray(
        (candidate as Record<string, unknown>).allowed_settlements
      );
      return (
        candidateCategory === roleCategory &&
        candidateAllowedSettlements.includes(settlementType)
      );
    }) ?? role
  );
};

const resolveRoleAnchor = ({
  role,
  mappings,
  anchors,
}: {
  role: NpcRole;
  mappings: NpcRoleToAnchorMapping[];
  anchors: NpcAnchorTemplate[];
}) => {
  const mapping =
    mappings.find((candidate) => candidate.role_id === role.id) ?? null;
  const fallbackAnchorId = asString((role as Record<string, unknown>).default_anchor_template, 'commoner');
  const anchorTemplateId = mapping?.anchor_template_id ?? fallbackAnchorId;
  const anchor =
    anchors.find((candidate) => candidate.id === anchorTemplateId) ??
    anchors.find((candidate) => candidate.id === fallbackAnchorId) ??
    anchors[0] ??
    null;

  return {
    anchor,
    anchorTemplateId: anchor?.id ?? null,
    anchorTemplateName: asString(anchor?.name, anchor?.id ?? ''),
    tier: mapping?.tier ?? (typeof anchor?.tier === 'string' ? anchor.tier : null),
  };
};

const chooseSpeciesOrigin = (role: NpcRole, nextRandom: () => number) => {
  const origins = asStringArray((role as Record<string, unknown>).allowed_species_origins);
  return pickOne(origins, nextRandom, 'remnant');
};

const chooseModifierEntries = ({
  modifiers,
  role,
  biomeId,
  nextRandom,
}: {
  modifiers: NpcModifier[];
  role: NpcRole;
  biomeId: string;
  nextRandom: () => number;
}) => {
  const roleTraits = asStringArray((role as Record<string, unknown>).common_traits).map((value) =>
    value.toLowerCase()
  );
  const roleSkills = asStringArray((role as Record<string, unknown>).possible_skills).map((value) =>
    value.toLowerCase()
  );

  const byId = new Map(modifiers.map((modifier) => [modifier.id, modifier]));
  const selected = new Map<string, NpcModifier>();

  const addModifier = (modifier: NpcModifier | null | undefined) => {
    if (modifier?.id) {
      selected.set(modifier.id, modifier);
    }
  };

  const temperamentCandidates = modifiers.filter((modifier) => {
    const category = asString((modifier as Record<string, unknown>).category);
    const socialAdjustments = asStringArray(
      (modifier as Record<string, unknown>).social_adjustments
    ).map((value) => value.toLowerCase());
    return category === 'temperament' && socialAdjustments.some((value) => roleTraits.includes(value));
  });
  addModifier(pickOne(temperamentCandidates, nextRandom, temperamentCandidates[0] ?? null));

  const backgroundCandidates = modifiers.filter((modifier) => {
    const category = asString((modifier as Record<string, unknown>).category);
    const skillAdjustments = asStringArray(
      (modifier as Record<string, unknown>).skill_adjustments
    ).map((value) => value.toLowerCase());
    return category === 'background' && skillAdjustments.some((value) => roleSkills.includes(value));
  });
  addModifier(pickOne(backgroundCandidates, nextRandom, backgroundCandidates[0] ?? null));

  if (biomeId.includes('fungal')) {
    addModifier(byId.get('fungal_touched'));
  } else if (biomeId.includes('arcane') || biomeId.includes('void') || biomeId.includes('crystal')) {
    addModifier(pickOne([byId.get('dream_touched'), byId.get('static_charged'), byId.get('phase_touched')].filter(Boolean) as NpcModifier[], nextRandom, null));
  }

  const lifeStageCandidates = modifiers.filter(
    (modifier) => asString((modifier as Record<string, unknown>).category) === 'life_stage'
  );
  addModifier(pickOne(lifeStageCandidates, nextRandom, lifeStageCandidates[0] ?? null));

  return [...selected.values()];
};

const applyNpcModifiersToStats = ({
  anchor,
  role,
  modifierEntries,
}: {
  anchor: NpcAnchorTemplate | null;
  role: NpcRole;
  modifierEntries: NpcModifier[];
}) => {
  const anchorRecord = asRecord(anchor);
  const baseStats = asRecord(anchorRecord.base_stats);
  const baseAbilities = asRecord(baseStats.abilities);
  const abilityBonuses = {
    str: 0,
    dex: 0,
    con: 0,
    int: 0,
    wis: 0,
    cha: 0,
  };
  let acBonus = 0;
  let hpBonus = 0;
  let speedBonus = 0;
  const modifierSkills: string[] = [];
  const traitAdditions: string[] = [];
  const visualKeywords: string[] = [];
  const socialAdjustments: string[] = [];

  for (const modifier of modifierEntries) {
    const adjustments = asRecord((modifier as Record<string, unknown>).stat_adjustments);
    abilityBonuses.str += asNumber(adjustments.str_bonus);
    abilityBonuses.dex += asNumber(adjustments.dex_bonus);
    abilityBonuses.con += asNumber(adjustments.con_bonus);
    abilityBonuses.int += asNumber(adjustments.int_bonus);
    abilityBonuses.wis += asNumber(adjustments.wis_bonus);
    abilityBonuses.cha += asNumber(adjustments.cha_bonus);
    acBonus += asNumber(adjustments.ac_bonus);
    hpBonus += asNumber(adjustments.hp_bonus);
    speedBonus += asNumber(adjustments.speed_bonus);
    modifierSkills.push(...asStringArray((modifier as Record<string, unknown>).skill_adjustments));
    traitAdditions.push(...asStringArray((modifier as Record<string, unknown>).trait_additions));
    visualKeywords.push(...asStringArray((modifier as Record<string, unknown>).visual_keywords));
    socialAdjustments.push(...asStringArray((modifier as Record<string, unknown>).social_adjustments));
  }

  const roleSkills = asStringArray((role as Record<string, unknown>).possible_skills);
  const anchorSkills = asStringArray(baseStats.skills);
  const anchorLanguages = asStringArray(baseStats.languages);
  const anchorSenses = asStringArray(baseStats.senses);
  const roleEquipment = asStringArray((role as Record<string, unknown>).common_equipment_overrides);
  const anchorEquipment = asStringArray(anchorRecord.default_equipment);
  const anchorActions = ((anchorRecord.default_actions as unknown[]) ?? []).filter(
    (action): action is Record<string, unknown> => typeof action === 'object' && action !== null
  );

  return {
    resolvedStats: {
      ac: asNumber(baseStats.ac, 10) + acBonus,
      hp: Math.max(1, asNumber(baseStats.hp, 4) + hpBonus),
      hitDice: asString(baseStats.hit_dice, '1d8'),
      speed: Math.max(5, asNumber(baseStats.speed, 30) + speedBonus),
      abilities: {
        str: clampAbility(asNumber(baseAbilities.str, 10) + abilityBonuses.str),
        dex: clampAbility(asNumber(baseAbilities.dex, 10) + abilityBonuses.dex),
        con: clampAbility(asNumber(baseAbilities.con, 10) + abilityBonuses.con),
        int: clampAbility(asNumber(baseAbilities.int, 10) + abilityBonuses.int),
        wis: clampAbility(asNumber(baseAbilities.wis, 10) + abilityBonuses.wis),
        cha: clampAbility(asNumber(baseAbilities.cha, 10) + abilityBonuses.cha),
      },
      savingThrows: asStringArray(baseStats.saving_throws),
      skills: uniqueStrings([...anchorSkills, ...roleSkills, ...modifierSkills]),
      senses: anchorSenses,
      languages: anchorLanguages,
      proficiencyBonus: asNumber(baseStats.proficiency_bonus, 2),
      cr: asNumber(anchorRecord.default_cr, 0),
    },
    actions: anchorActions,
    spellcasting: (anchorRecord.default_spellcasting as Record<string, unknown> | undefined) ?? null,
    equipment: uniqueStrings([...anchorEquipment, ...roleEquipment]),
    traits: uniqueStrings([
      ...asStringArray((role as Record<string, unknown>).common_traits),
      ...traitAdditions,
    ]),
    visualKeywords: uniqueStrings(visualKeywords),
    socialAdjustments: uniqueStrings(socialAdjustments),
  };
};

const applySchemaTemplate = ({
  template,
  tokens,
  fallback,
}: {
  template: unknown;
  tokens: Record<string, string>;
  fallback: string;
}) => {
  const resolvedTemplate = typeof template === 'string' ? template : fallback;
  return applyTemplateTokens(resolvedTemplate, tokens);
};

const buildAppearanceSummary = ({
  pack,
  context,
  nextRandom,
}: {
  pack: NpcPhysicalDescription[];
  context: NpcFlavorContext;
  nextRandom: () => number;
}) => {
  const fallback = pack[0] ?? {
    id: 'fallback',
    text: 'Practical clothing, visible wear, and the look of someone who works for a living.',
  };
  return pickMatchingEntry(pack, context, nextRandom, fallback).text;
};

const buildVoice = ({
  pack,
  context,
  nextRandom,
}: {
  pack: NpcRoleplayingEntry[];
  context: NpcFlavorContext;
  nextRandom: () => number;
}) => {
  const fallback = pack[0] ?? {
    id: 'fallback',
    text: 'careful, measured, and a little too used to choosing what not to say',
  };
  return pickMatchingEntry(pack, context, nextRandom, fallback).text;
};

const buildMannerisms = ({
  pack,
  context,
  nextRandom,
}: {
  pack: NpcRoleplayingEntry[];
  context: NpcFlavorContext;
  nextRandom: () => number;
}) => {
  const matching = pickManyMatchingEntries(pack, context, [2, 3], nextRandom);
  if (matching.length > 0) {
    return matching.map((entry) => entry.text);
  }

  return ['pauses just long enough to see how others react'];
};

const buildRoleplayFraming = ({
  pack,
  context,
  nextRandom,
}: {
  pack: NpcRoleplayingEntry[];
  context: NpcFlavorContext;
  nextRandom: () => number;
}) => {
  const fallback = pack[0] ?? {
    id: 'fallback',
    text: 'wary at first, but quicker to open up once someone proves useful',
  };
  return pickMatchingEntry(pack, context, nextRandom, fallback).text;
};

const buildRoleInSection = ({
  pack,
  context,
  nextRandom,
}: {
  pack: NpcRoleplayingEntry[];
  context: NpcFlavorContext;
  nextRandom: () => number;
}) => {
  const fallback = pack[0] ?? {
    id: 'fallback',
    text: 'pushes every serious conversation toward whatever needs doing next',
  };
  return pickMatchingEntry(pack, context, nextRandom, fallback).text;
};

const chooseNpcArchetype = ({
  pack,
  context,
  nextRandom,
}: {
  pack: NpcArchetype[];
  context: Omit<NpcFlavorContext, 'archetypeId'>;
  nextRandom: () => number;
}) => {
  const matching = pack.filter((entry) =>
    matchesFlavorContext(entry as Record<string, unknown>, {
      ...context,
      archetypeId: null,
    })
  );

  return pickOne(matching, nextRandom, pack[0] ?? null);
};

export const resolveSettlementArchetype = (
  section: GeneratedSection,
  requestedArchetypeId: string | null | undefined
) => {
  const archetypes = contentRegistry.loadPack('village_archetypes').villageArchetypes;

  if (section.sectionKind !== 'settlement') {
    return null;
  }

  if (requestedArchetypeId) {
    return (
      archetypes.find((candidate) => candidate.id === requestedArchetypeId) ??
      archetypes[0] ??
      null
    );
  }

  return archetypes.find((candidate) => candidate.id === 'waystop') ?? archetypes[0] ?? null;
};

const choosePhonemeSet = (nextRandom: () => number) => {
  const phonemeSets = contentRegistry.loadPack('name_phonemes').namePhonemes;

  return (
    phonemeSets.find((candidate) => candidate.id === 'remnant_human') ??
    pickOne(phonemeSets, nextRandom, phonemeSets[0])
  );
};

const generateNpcContent = ({
  section,
  sectionName,
  archetype,
  nextRandom,
}: {
  section: GeneratedSection;
  sectionName: string;
  archetype: VillageArchetype | null;
  nextRandom: () => number;
}): GeneratedSectionNpcContent => {
  const npcRoles = contentRegistry.loadPack('npc_roles').npcRoles;
  const npcArchetypes = contentRegistry.loadPack('npc_archetypes').npcArchetypes;
  const npcPhysicalDescriptions =
    contentRegistry.loadPack('npc_physical_descriptions').npcPhysicalDescriptions;
  const npcRoleplaying = contentRegistry.loadPack('npc_roleplaying');
  const npcBackstoryFragments =
    contentRegistry.loadPack('npc_backstory_fragments').npcBackstoryFragments;
  const npcContextModifiers = contentRegistry.loadPack('npc_context_modifiers');
  const npcAnchorTemplates = contentRegistry.loadPack('npc_anchor_templates').npcAnchorTemplates;
  const npcRoleMappings =
    contentRegistry.loadPack('npc_role_to_anchor_mapping').npcRoleToAnchorMapping;
  const npcModifiers = contentRegistry.loadPack('npc_modifiers').npcModifiers;
  const npcGenerationSchema = contentRegistry.loadPack('npc_generation_schema').npcGenerationSchema;
  const phonemeSet = choosePhonemeSet(nextRandom);

  if (section.sectionKind !== 'settlement' || !archetype) {
    return {
      npcs: [],
      npcEntities: [],
      npcAppearances: [],
    };
  }

  const requiredRoles = asStringArray((archetype as Record<string, unknown>).required_roles);
  const commonRoles = asStringArray((archetype as Record<string, unknown>).common_roles);
  const roleIds = uniqueStrings([
    ...requiredRoles,
    ...pickManyUnique(
      commonRoles.filter((roleId) => !requiredRoles.includes(roleId)),
      [2, 3],
      nextRandom
    ),
  ]);

  const npcs: GeneratedSectionNpc[] = [];
  const npcEntities: GeneratedNpcEntity[] = [];
  const npcAppearances: GeneratedNpcAppearance[] = [];

  for (const [index, roleId] of roleIds.entries()) {
    const rawRole = npcRoles.find((candidate) => candidate.id === roleId);

    if (!rawRole) {
      continue;
    }

    const role = resolveCompatibleRole({
      role: rawRole,
      roles: npcRoles,
      settlementType: archetype.id,
    });

    const summary = {
      id: createNpcId({ section, roleId }),
      name: buildNameFromPhonemes(phonemeSet, nextRandom),
      roleId: role.id,
      roleName: asString(role.name, role.id),
      trait: pickOne(
        asStringArray((role as Record<string, unknown>).common_traits),
        nextRandom,
        'practical'
      ),
      motivation: pickOne(
        asStringArray((role as Record<string, unknown>).possible_motivations),
        nextRandom,
        'keep the settlement going'
      ),
      secret: pickOne(
        asStringArray((role as Record<string, unknown>).possible_secrets),
        nextRandom,
        'is keeping something back'
      ),
      rumor: pickOne(
        asStringArray((role as Record<string, unknown>).possible_rumors),
        nextRandom,
        'something nearby is changing'
      ),
    };

    const roleName = summary.roleName;
    const speciesOrigin = chooseSpeciesOrigin(role, nextRandom);
    const roleAnchor = resolveRoleAnchor({
      role,
      mappings: npcRoleMappings,
      anchors: npcAnchorTemplates,
    });
    const flavorBaseContext = {
      roleId: summary.roleId,
      settlementArchetypeId: archetype.id,
      biomeId: section.primaryBiomeId,
    };
    const selectedNpcArchetype = chooseNpcArchetype({
      pack: npcArchetypes,
      context: flavorBaseContext,
      nextRandom,
    });
    const flavorContext: NpcFlavorContext = {
      ...flavorBaseContext,
      archetypeId: selectedNpcArchetype?.id ?? null,
    };
    const npcTemplateContext: NpcTemplateContext = {
      ...flavorContext,
      sectionName,
      roleName,
      motivation: summary.motivation,
      secret: summary.secret,
      rumor: summary.rumor,
    };
    const appearanceSummary = buildAppearanceSummary({
      pack: npcPhysicalDescriptions,
      context: flavorContext,
      nextRandom,
    });
    const voice = buildVoice({
      pack: npcRoleplaying.voice,
      context: flavorContext,
      nextRandom,
    });
    const mannerisms = buildMannerisms({
      pack: npcRoleplaying.mannerisms,
      context: flavorContext,
      nextRandom,
    });
    const modifierEntries = chooseModifierEntries({
      modifiers: npcModifiers,
      role,
      biomeId: section.primaryBiomeId,
      nextRandom,
    });
    const modifierIds = modifierEntries.map((modifier) => modifier.id);
    const modifierNames = modifierEntries.map((modifier) =>
      asString((modifier as Record<string, unknown>).name, modifier.id)
    );
    const resolvedMechanicalData = applyNpcModifiersToStats({
      anchor: roleAnchor.anchor,
      role,
      modifierEntries,
    });
    const schemaTokens = {
      name: summary.name,
      modifier_adjectives:
        modifierNames.length > 0 ? modifierNames.join(', ').toLowerCase() : 'dungeon-worn',
      species_origin: speciesOrigin,
      role_name: summary.roleName,
      biome_name: humanizeId(section.primaryBiomeId),
      settlement_type: humanizeId(archetype.id),
      visual_keywords:
        resolvedMechanicalData.visualKeywords.length > 0
          ? resolvedMechanicalData.visualKeywords.join(', ')
          : appearanceSummary,
      mood_keywords:
        resolvedMechanicalData.socialAdjustments.length > 0
          ? resolvedMechanicalData.socialAdjustments.join(', ')
          : summary.trait,
      social_keywords:
        resolvedMechanicalData.socialAdjustments.length > 0
          ? resolvedMechanicalData.socialAdjustments.join(', ')
          : summary.trait,
      motivation: summary.motivation,
    };
    const shortDescription = applySchemaTemplate({
      template: npcGenerationSchema.short_description_template,
      tokens: schemaTokens,
      fallback:
        '{name} is a {role_name} based in a {settlement_type} near the {biome_name}. They come across as {social_keywords} and are driven to {motivation}.',
    });
    const portraitPrompt = applySchemaTemplate({
      template: npcGenerationSchema.portrait_prompt_template,
      tokens: schemaTokens,
      fallback:
        '{name}, a {modifier_adjectives} {species_origin} {role_name} from the {biome_name}. Fantasy portrait, readable silhouette, clear face, detailed clothing and gear, dungeon-born aesthetic, centered composition, no text. Visual details: {visual_keywords}. Mood: {mood_keywords}.',
    });
    const generationSteps = Array.isArray(npcGenerationSchema.generation_steps)
      ? npcGenerationSchema.generation_steps.length
      : 0;
    const knownFor = uniqueStrings([
      ...buildContextValues({
        pack: npcContextModifiers.knownFor,
        context: npcTemplateContext,
        countRange: [1, 2],
        nextRandom,
      }),
      summary.rumor,
    ]).slice(0, 3);
    const needs = uniqueStrings(
      buildContextValues({
        pack: npcContextModifiers.needs,
        context: npcTemplateContext,
        countRange: [1, 2],
        nextRandom,
      })
    );
    const offers = uniqueStrings(
      buildContextValues({
        pack: npcContextModifiers.offers,
        context: npcTemplateContext,
        countRange: [1, 2],
        nextRandom,
      })
    );
    const knows = uniqueStrings([
      ...buildContextValues({
        pack: npcContextModifiers.knows,
        context: npcTemplateContext,
        countRange: [1, 2],
        nextRandom,
      }),
      summary.rumor,
    ]);

    npcs.push(summary);
    npcEntities.push({
      id: summary.id,
      name: summary.name,
      speciesId: phonemeSet.id,
      speciesOrigin,
      roleId: summary.roleId,
      roleName: summary.roleName,
      category: asString((role as Record<string, unknown>).category) || null,
      tier: roleAnchor.tier ?? null,
      settlementType: archetype.id,
      biomeId: section.primaryBiomeId,
      anchorTemplateId: roleAnchor.anchorTemplateId,
      anchorTemplateName: roleAnchor.anchorTemplateName || null,
      modifierIds,
      modifierNames,
      baselineBackstory: buildBaselineBackstory({
        pack: npcBackstoryFragments,
        context: flavorContext,
        sectionName,
        nextRandom,
      }),
      appearanceSummary,
      personality: summary.trait,
      voice,
      mannerisms,
      motivations: [summary.motivation],
      secrets: [summary.secret],
      rumorKnowledge: [summary.rumor],
      knownFor,
      currentDisposition: 'watchful',
      factionId: null,
      shopId: null,
      resolvedStats: resolvedMechanicalData.resolvedStats,
      actions: resolvedMechanicalData.actions,
      spellcasting: resolvedMechanicalData.spellcasting,
      equipment: resolvedMechanicalData.equipment,
      traits: resolvedMechanicalData.traits,
      shortDescription,
      portraitPrompt,
      gmNotes: `Anchor: ${roleAnchor.anchorTemplateId ?? 'unknown anchor'} · Tier: ${
        roleAnchor.tier ?? 'unknown tier'
      } · Modifiers: ${
        modifierNames.length > 0 ? modifierNames.join(', ') : 'none'
      } · Schema steps: ${generationSteps}`,
    });
    npcAppearances.push({
      id: `appearance_${index + 1}`,
      sectionId: section.sectionId,
      npcId: summary.id,
      context: `${summary.roleName} at ${sectionName}`,
      roleInSection: buildRoleInSection({
        pack: npcRoleplaying.currentPressure,
        context: flavorContext,
        nextRandom,
      }),
      wantsFromPlayers: summary.motivation,
      framing: buildRoleplayFraming({
        pack: npcRoleplaying.framing,
        context: flavorContext,
        nextRandom,
      }),
      knows,
      needs,
      offers,
    });
  }

  return {
    npcs,
    npcEntities,
    npcAppearances,
  };
};

export const generateNpcEntities = ({
  section,
  sectionName,
  rerollState,
  settlementArchetypeId = null,
}: GenerateNpcEntitiesInput): GeneratedSectionNpcContent => {
  const archetype = resolveSettlementArchetype(section, settlementArchetypeId);
  const mergedRerolls = mergeRerollState(rerollState);
  const npcRandom = createSeededRandom(`${section.seed}:npcs:${mergedRerolls.npcs}`);

  return generateNpcContent({
    section,
    sectionName,
    archetype,
    nextRandom: npcRandom,
  });
};
