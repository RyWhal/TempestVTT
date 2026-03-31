import biomesRaw from '../../../DunGEN/biomes.json';
import biomeGenerationProfilesRaw from '../../../DunGEN/biome_generation_profiles.json';
import creatureFamiliesRaw from '../../../DunGEN/creatures.json';
import creatureAnchorTemplatesRaw from '../../../DunGEN/creature_anchor_templates.json';
import creatureVariantsRaw from '../../../DunGEN/creature_variant_modifiers.json';
import encounterTemplatesRaw from '../../../DunGEN/encounter_templates.json';
import floorMaterialProfilesRaw from '../../../DunGEN/floor_material_profiles.json';
import floorTransitionProfilesRaw from '../../../DunGEN/floor_transition_profiles.json';
import genAiDescriptionSchemaRaw from '../../../DunGEN/genai_description_schema.json';
import hookFragmentsRaw from '../../../DunGEN/hook_fragments.json';
import itemTablesRaw from '../../../DunGEN/item_tables.json';
import creatureBookFragmentsRaw from '../../../DunGEN/creature_book_fragments.json';
import namePhonemesRaw from '../../../DunGEN/gen_names_phonemes.json';
import npcAnchorTemplatesRaw from '../../../DunGEN/npc_anchor_templates.json';
import npcArchetypesRaw from '../../../DunGEN/npc_archetypes.json';
import npcBackstoryFragmentsRaw from '../../../DunGEN/npc_backstory_fragments.json';
import npcContextModifiersRaw from '../../../DunGEN/npc_context_modifiers.json';
import npcGenerationSchemaRaw from '../../../DunGEN/npc_generation_schema.json';
import npcModifiersRaw from '../../../DunGEN/npc_modifiers.json';
import npcPhysicalDescriptionsRaw from '../../../DunGEN/npc_physical_descriptions.json';
import npcRoleplayingRaw from '../../../DunGEN/npc_roleplaying.json';
import npcRoleToAnchorMappingRaw from '../../../DunGEN/npc_role_to_anchor_mapping.json';
import npcRolesRaw from '../../../DunGEN/npc_roles.json';
import roomPrimitivesRaw from '../../../DunGEN/room_primitives.json';
import rumorFragmentsRaw from '../../../DunGEN/rumor_fragments.json';
import sectionNarrativeFragmentsRaw from '../../../DunGEN/section_narrative_fragments.json';
import settlementGenerationProfilesRaw from '../../../DunGEN/settlement_generation_profiles.json';
import shopFlavorFragmentsRaw from '../../../DunGEN/shop_flavor_fragments.json';
import shopsRaw from '../../../DunGEN/shops.json';
import villageArchetypesRaw from '../../../DunGEN/village_archetypes.json';
import type { ProcgenContentPackId } from '../types';

export interface ContentManifestEntry<K extends ProcgenContentPackId = ProcgenContentPackId> {
  id: K;
  filePath: string;
  required: boolean;
  rawData: unknown;
}

export const contentManifest: Partial<Record<ProcgenContentPackId, ContentManifestEntry>> = {
  biomes: {
    id: 'biomes',
    filePath: 'DunGEN/biomes.json',
    required: true,
    rawData: biomesRaw,
  },
  biome_generation_profiles: {
    id: 'biome_generation_profiles',
    filePath: 'DunGEN/biome_generation_profiles.json',
    required: true,
    rawData: biomeGenerationProfilesRaw,
  },
  creature_families: {
    id: 'creature_families',
    filePath: 'DunGEN/creatures.json',
    required: true,
    rawData: creatureFamiliesRaw,
  },
  creature_variants: {
    id: 'creature_variants',
    filePath: 'DunGEN/creature_variant_modifiers.json',
    required: true,
    rawData: creatureVariantsRaw,
  },
  creature_anchor_templates: {
    id: 'creature_anchor_templates',
    filePath: 'DunGEN/creature_anchor_templates.json',
    required: true,
    rawData: creatureAnchorTemplatesRaw,
  },
  encounter_templates: {
    id: 'encounter_templates',
    filePath: 'DunGEN/encounter_templates.json',
    required: true,
    rawData: encounterTemplatesRaw,
  },
  hook_fragments: {
    id: 'hook_fragments',
    filePath: 'DunGEN/hook_fragments.json',
    required: true,
    rawData: hookFragmentsRaw,
  },
  creature_book_fragments: {
    id: 'creature_book_fragments',
    filePath: 'DunGEN/creature_book_fragments.json',
    required: true,
    rawData: creatureBookFragmentsRaw,
  },
  name_phonemes: {
    id: 'name_phonemes',
    filePath: 'DunGEN/gen_names_phonemes.json',
    required: true,
    rawData: namePhonemesRaw,
  },
  npc_anchor_templates: {
    id: 'npc_anchor_templates',
    filePath: 'DunGEN/npc_anchor_templates.json',
    required: true,
    rawData: npcAnchorTemplatesRaw,
  },
  npc_generation_schema: {
    id: 'npc_generation_schema',
    filePath: 'DunGEN/npc_generation_schema.json',
    required: true,
    rawData: npcGenerationSchemaRaw,
  },
  npc_modifiers: {
    id: 'npc_modifiers',
    filePath: 'DunGEN/npc_modifiers.json',
    required: true,
    rawData: npcModifiersRaw,
  },
  npc_archetypes: {
    id: 'npc_archetypes',
    filePath: 'DunGEN/npc_archetypes.json',
    required: true,
    rawData: npcArchetypesRaw,
  },
  npc_physical_descriptions: {
    id: 'npc_physical_descriptions',
    filePath: 'DunGEN/npc_physical_descriptions.json',
    required: true,
    rawData: npcPhysicalDescriptionsRaw,
  },
  npc_roleplaying: {
    id: 'npc_roleplaying',
    filePath: 'DunGEN/npc_roleplaying.json',
    required: true,
    rawData: npcRoleplayingRaw,
  },
  npc_backstory_fragments: {
    id: 'npc_backstory_fragments',
    filePath: 'DunGEN/npc_backstory_fragments.json',
    required: true,
    rawData: npcBackstoryFragmentsRaw,
  },
  npc_context_modifiers: {
    id: 'npc_context_modifiers',
    filePath: 'DunGEN/npc_context_modifiers.json',
    required: true,
    rawData: npcContextModifiersRaw,
  },
  npc_role_to_anchor_mapping: {
    id: 'npc_role_to_anchor_mapping',
    filePath: 'DunGEN/npc_role_to_anchor_mapping.json',
    required: true,
    rawData: npcRoleToAnchorMappingRaw,
  },
  npc_roles: {
    id: 'npc_roles',
    filePath: 'DunGEN/npc_roles.json',
    required: true,
    rawData: npcRolesRaw,
  },
  village_archetypes: {
    id: 'village_archetypes',
    filePath: 'DunGEN/village_archetypes.json',
    required: true,
    rawData: villageArchetypesRaw,
  },
  rumor_fragments: {
    id: 'rumor_fragments',
    filePath: 'DunGEN/rumor_fragments.json',
    required: true,
    rawData: rumorFragmentsRaw,
  },
  section_narrative_fragments: {
    id: 'section_narrative_fragments',
    filePath: 'DunGEN/section_narrative_fragments.json',
    required: true,
    rawData: sectionNarrativeFragmentsRaw,
  },
  shop_flavor_fragments: {
    id: 'shop_flavor_fragments',
    filePath: 'DunGEN/shop_flavor_fragments.json',
    required: true,
    rawData: shopFlavorFragmentsRaw,
  },
  genai_description_schema: {
    id: 'genai_description_schema',
    filePath: 'DunGEN/genai_description_schema.json',
    required: true,
    rawData: genAiDescriptionSchemaRaw,
  },
  item_tables: {
    id: 'item_tables',
    filePath: 'DunGEN/item_tables.json',
    required: true,
    rawData: itemTablesRaw,
  },
  room_primitives: {
    id: 'room_primitives',
    filePath: 'DunGEN/room_primitives.json',
    required: true,
    rawData: roomPrimitivesRaw,
  },
  shop_types: {
    id: 'shop_types',
    filePath: 'DunGEN/shops.json',
    required: true,
    rawData: shopsRaw,
  },
  settlement_generation_profiles: {
    id: 'settlement_generation_profiles',
    filePath: 'DunGEN/settlement_generation_profiles.json',
    required: true,
    rawData: settlementGenerationProfilesRaw,
  },
  floor_material_profiles: {
    id: 'floor_material_profiles',
    filePath: 'DunGEN/floor_material_profiles.json',
    required: true,
    rawData: floorMaterialProfilesRaw,
  },
  floor_transition_profiles: {
    id: 'floor_transition_profiles',
    filePath: 'DunGEN/floor_transition_profiles.json',
    required: true,
    rawData: floorTransitionProfilesRaw,
  },
};
