import type {
  ProcgenContentPackId,
  ProcgenContentPackMap,
  ProcgenIdentifiedRecord,
  ShopTypesPack,
} from '../types';
import type { RawContentPackResult } from './loadContentPack';

const isObjectRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const expectObjectRecord = (value: unknown, packId: string): Record<string, unknown> => {
  if (!isObjectRecord(value)) {
    throw new Error(`Content pack "${packId}" must be an object.`);
  }

  return value;
};

const expectIdentifiedArray = <T extends ProcgenIdentifiedRecord>(
  value: unknown,
  packId: string,
  key: string
): T[] => {
  if (!Array.isArray(value)) {
    throw new Error(`Content pack "${packId}" is missing an array at "${key}".`);
  }

  for (const item of value) {
    if (!isObjectRecord(item) || typeof item.id !== 'string') {
      throw new Error(`Content pack "${packId}" has an invalid item in "${key}".`);
    }
  }

  return value as T[];
};

const expectNestedObject = (
  value: unknown,
  packId: string,
  key: string
): Record<string, unknown> => {
  if (!isObjectRecord(value)) {
    throw new Error(`Content pack "${packId}" is missing an object at "${key}".`);
  }

  return value;
};

const expectObjectArray = <T extends Record<string, unknown>>(
  value: unknown,
  packId: string,
  key: string
): T[] => {
  if (!Array.isArray(value)) {
    throw new Error(`Content pack "${packId}" is missing an array at "${key}".`);
  }

  for (const item of value) {
    if (!isObjectRecord(item)) {
      throw new Error(`Content pack "${packId}" has an invalid item in "${key}".`);
    }
  }

  return value as T[];
};

const OPTIONAL_PACK_DEFAULTS: Pick<
  ProcgenContentPackMap,
  'room_type_library' | 'shop_types'
> = {
  room_type_library: {
    roomTypes: [],
  },
  shop_types: {
    shopTypes: [],
  },
};

const normalizeShopTypes = (rawData: unknown): ShopTypesPack => {
  if (rawData === undefined) {
    return OPTIONAL_PACK_DEFAULTS.shop_types;
  }

  const record = expectObjectRecord(rawData, 'shop_types');
  return {
    shopTypes: expectIdentifiedArray(record.shop_types, 'shop_types', 'shop_types'),
  };
};

const normalizeRoomTypeLibrary = (rawData: unknown): ProcgenContentPackMap['room_type_library'] => {
  if (rawData === undefined) {
    return OPTIONAL_PACK_DEFAULTS.room_type_library;
  }

  const record = expectObjectRecord(rawData, 'room_type_library');
  return {
    roomTypes: expectIdentifiedArray(record.room_type_library, 'room_type_library', 'room_type_library'),
  };
};

export const normalizeContentPack = <K extends ProcgenContentPackId>(
  result: RawContentPackResult<K>
): ProcgenContentPackMap[K] => {
  const { packId, rawData } = result;

  switch (packId) {
    case 'biomes': {
      const record = expectObjectRecord(rawData, packId);
      return {
        biomes: expectIdentifiedArray(record.biomes, packId, 'biomes'),
      } as ProcgenContentPackMap[K];
    }
    case 'creature_families': {
      const record = expectObjectRecord(rawData, packId);
      return {
        creatureFamilies: expectIdentifiedArray(record.creature_families, packId, 'creature_families'),
      } as ProcgenContentPackMap[K];
    }
    case 'creature_variants': {
      const record = expectObjectRecord(rawData, packId);
      return {
        creatureVariants: expectIdentifiedArray(record.creature_variants, packId, 'creature_variants'),
      } as ProcgenContentPackMap[K];
    }
    case 'name_phonemes': {
      const record = expectObjectRecord(rawData, packId);
      return {
        namePhonemes: expectIdentifiedArray(record.phoneme_sets, packId, 'phoneme_sets'),
      } as ProcgenContentPackMap[K];
    }
    case 'npc_anchor_templates': {
      const record = expectObjectRecord(rawData, packId);
      return {
        npcAnchorTemplates: expectIdentifiedArray(record.npc_anchor_templates, packId, 'npc_anchor_templates'),
      } as ProcgenContentPackMap[K];
    }
    case 'npc_generation_schema': {
      const record = expectObjectRecord(rawData, packId);
      return {
        npcGenerationSchema: expectNestedObject(record.npc_generation_schema, packId, 'npc_generation_schema'),
      } as ProcgenContentPackMap[K];
    }
    case 'npc_modifiers': {
      const record = expectObjectRecord(rawData, packId);
      return {
        npcModifiers: expectIdentifiedArray(record.npc_modifiers, packId, 'npc_modifiers'),
      } as ProcgenContentPackMap[K];
    }
    case 'npc_role_to_anchor_mapping': {
      const record = expectObjectRecord(rawData, packId);
      return {
        npcRoleToAnchorMapping: expectObjectArray(
          record.npc_role_to_anchor_mapping,
          packId,
          'npc_role_to_anchor_mapping'
        ),
      } as ProcgenContentPackMap[K];
    }
    case 'npc_roles': {
      const record = expectObjectRecord(rawData, packId);
      return {
        npcRoles: expectIdentifiedArray(record.npc_roles, packId, 'npc_roles'),
      } as ProcgenContentPackMap[K];
    }
    case 'village_archetypes': {
      const record = expectObjectRecord(rawData, packId);
      return {
        villageArchetypes: expectIdentifiedArray(record.village_archetypes, packId, 'village_archetypes'),
      } as ProcgenContentPackMap[K];
    }
    case 'genai_description_schema': {
      const record = expectObjectRecord(rawData, packId);
      return {
        genAiDescriptionSchema: expectNestedObject(
          record.genai_description_schema,
          packId,
          'genai_description_schema'
        ),
      } as ProcgenContentPackMap[K];
    }
    case 'item_tables': {
      const record = expectObjectRecord(rawData, packId);
      return {
        itemTemplates: expectIdentifiedArray(record.item_templates, packId, 'item_templates'),
        itemCategories: expectIdentifiedArray(record.item_categories, packId, 'item_categories'),
      } as ProcgenContentPackMap[K];
    }
    case 'room_primitives': {
      const record = expectObjectRecord(rawData, packId);
      return {
        roomPrimitives: expectIdentifiedArray(record.room_primitives, packId, 'room_primitives'),
      } as ProcgenContentPackMap[K];
    }
    case 'room_type_library':
      return normalizeRoomTypeLibrary(rawData) as ProcgenContentPackMap[K];
    case 'shop_types':
      return normalizeShopTypes(rawData) as ProcgenContentPackMap[K];
    default: {
      const unsupportedPackId: never = packId;
      throw new Error(`Unsupported content pack: ${unsupportedPackId}`);
    }
  }
};
