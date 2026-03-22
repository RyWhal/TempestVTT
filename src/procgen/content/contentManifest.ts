import biomesRaw from '../../../DunGEN/biomes.json';
import creatureFamiliesRaw from '../../../DunGEN/creatures.json';
import creatureVariantsRaw from '../../../DunGEN/creature_variant_modifiers.json';
import genAiDescriptionSchemaRaw from '../../../DunGEN/genai_description_schema.json';
import itemTablesRaw from '../../../DunGEN/item_tables.json';
import namePhonemesRaw from '../../../DunGEN/gen_names_phonemes.json';
import npcAnchorTemplatesRaw from '../../../DunGEN/npc_anchor_templates.json';
import npcGenerationSchemaRaw from '../../../DunGEN/npc_generation_schema.json';
import npcModifiersRaw from '../../../DunGEN/npc_modifiers.json';
import npcRoleToAnchorMappingRaw from '../../../DunGEN/npc_role_to_anchor_mapping.json';
import npcRolesRaw from '../../../DunGEN/npc_roles.json';
import roomPrimitivesRaw from '../../../DunGEN/room_primitives.json';
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
};
