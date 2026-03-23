export type ProcgenLockState = 'unseen' | 'preview' | 'locked';
export type SectionKind = 'exploration' | 'settlement';
export type CardinalDirection = 'north' | 'south' | 'east' | 'west';
export type OverviewViewer = 'gm' | 'player';
export type OverviewNodeState = 'visited' | 'known_unvisited' | 'preview';
export type SectionLayoutType =
  | 'single_chamber'
  | 'linear_path'
  | 'branching_paths'
  | 'central_hub'
  | 'clustered_rooms';

export interface SectionSeedInput {
  worldSeed: string;
  sectionId: string;
  state?: ProcgenLockState;
}

export interface GeneratedSectionInput {
  worldSeed: string;
  sectionId: string;
  sectionKind?: SectionKind;
}

export interface RectBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface GeneratedSectionConnection {
  connectionId: string;
  fromRoomId: string;
  toRoomId: string;
}

export interface GeneratedSectionConnector {
  connectorId: string;
  primitiveId: string;
  family: 'corridor' | 'junction';
  segmentBounds: RectBounds[];
  connectedRoomIds: string[];
  tags: string[];
}

export interface GeneratedSectionRoom {
  roomId: string;
  primitiveId: string;
  roomTypeId: string;
  biomeId: string;
  bounds: RectBounds;
  connectedRoomIds: string[];
  isEntrance: boolean;
  isExit: boolean;
  tags: string[];
}

export interface GeneratedSection {
  sectionId: string;
  seed: string;
  sectionKind: SectionKind;
  layoutType: SectionLayoutType;
  grid: {
    width: number;
    height: number;
    tileSizeFt: number;
  };
  primaryBiomeId: string;
  rooms: GeneratedSectionRoom[];
  connections: GeneratedSectionConnection[];
  connectors: GeneratedSectionConnector[];
  entranceRoomIds: string[];
  exitRoomIds: string[];
}

export interface SectionRenderRect {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fill: string;
  stroke?: string;
  strokeWidth?: number;
  regionType?: 'room' | 'connector' | 'courtyard' | 'street';
  materialKey?: string;
}

export interface SectionRenderLine {
  id: string;
  points: [number, number, number, number];
  stroke: string;
  strokeWidth: number;
  surfaceType?: 'wall' | 'threshold';
  materialKey?: string;
}

export interface SectionRenderMarker {
  id: string;
  kind: 'entrance' | 'exit';
  x: number;
  y: number;
  radius: number;
  fill: string;
  materialKey?: string;
}

export interface SectionRenderAtmosphere {
  color: string;
  opacity: number;
}

export interface SectionRenderPayload {
  width: number;
  height: number;
  tileSizePx: number;
  backgroundColor: string;
  floors: SectionRenderRect[];
  walls: SectionRenderLine[];
  markers: SectionRenderMarker[];
  doors?: SectionRenderLine[];
  hazards?: SectionRenderRect[];
  objects?: SectionRenderRect[];
  atmosphere?: SectionRenderAtmosphere | null;
}

export interface OverviewNode {
  sectionId: string;
  label: string;
  x: number;
  y: number;
  state: OverviewNodeState;
  visitIndex: number | null;
}

export interface OverviewEdge {
  id: string;
  fromSectionId: string;
  toSectionId: string;
  state: 'available' | 'blocked' | 'preview';
}

export interface ProcgenIdentifiedRecord {
  id: string;
  name?: string;
  [key: string]: unknown;
}

export interface Biome extends ProcgenIdentifiedRecord {}
export interface CreatureFamily extends ProcgenIdentifiedRecord {}
export interface CreatureVariant extends ProcgenIdentifiedRecord {}
export interface NamePhonemeSet extends ProcgenIdentifiedRecord {}
export interface NpcAnchorTemplate extends ProcgenIdentifiedRecord {}
export interface PrimitiveGridFootprint {
  min_w: number;
  max_w: number;
  min_h: number;
  max_h: number;
}
export interface NpcRoleToAnchorMapping {
  role_id: string;
  anchor_template_id: string;
  tier?: string;
  [key: string]: unknown;
}
export interface NpcRole extends ProcgenIdentifiedRecord {}
export interface NpcModifier extends ProcgenIdentifiedRecord {}
export interface VillageArchetype extends ProcgenIdentifiedRecord {}
export interface ShopType extends ProcgenIdentifiedRecord {}
export interface RoomPrimitive extends ProcgenIdentifiedRecord {
  family?: string;
  grid_footprint?: PrimitiveGridFootprint;
  supports_rotation?: boolean;
  [key: string]: unknown;
}
export interface RoomType extends ProcgenIdentifiedRecord {}
export interface ItemTemplate extends ProcgenIdentifiedRecord {}
export interface NpcGenerationSchema {
  [key: string]: unknown;
}
export interface GenAiDescriptionSchema {
  [key: string]: unknown;
}

export interface BiomesPack {
  biomes: Biome[];
}

export interface CreatureFamiliesPack {
  creatureFamilies: CreatureFamily[];
}

export interface CreatureVariantsPack {
  creatureVariants: CreatureVariant[];
}

export interface NamePhonemesPack {
  namePhonemes: NamePhonemeSet[];
}

export interface NpcAnchorTemplatesPack {
  npcAnchorTemplates: NpcAnchorTemplate[];
}

export interface NpcRoleToAnchorMappingPack {
  npcRoleToAnchorMapping: NpcRoleToAnchorMapping[];
}

export interface NpcRolesPack {
  npcRoles: NpcRole[];
}

export interface NpcModifiersPack {
  npcModifiers: NpcModifier[];
}

export interface VillageArchetypesPack {
  villageArchetypes: VillageArchetype[];
}

export interface NpcGenerationSchemaPack {
  npcGenerationSchema: NpcGenerationSchema;
}

export interface GenAiDescriptionSchemaPack {
  genAiDescriptionSchema: GenAiDescriptionSchema;
}

export interface ShopTypesPack {
  shopTypes: ShopType[];
}

export interface RoomPrimitivesPack {
  roomPrimitives: RoomPrimitive[];
}

export interface RoomTypeLibraryPack {
  roomTypes: RoomType[];
}

export interface ItemTablesPack {
  itemTemplates: ItemTemplate[];
  itemCategories: ProcgenIdentifiedRecord[];
}

export interface ProcgenContentPackMap {
  biomes: BiomesPack;
  creature_families: CreatureFamiliesPack;
  creature_variants: CreatureVariantsPack;
  name_phonemes: NamePhonemesPack;
  npc_anchor_templates: NpcAnchorTemplatesPack;
  npc_generation_schema: NpcGenerationSchemaPack;
  npc_modifiers: NpcModifiersPack;
  npc_role_to_anchor_mapping: NpcRoleToAnchorMappingPack;
  npc_roles: NpcRolesPack;
  village_archetypes: VillageArchetypesPack;
  genai_description_schema: GenAiDescriptionSchemaPack;
  shop_types: ShopTypesPack;
  room_primitives: RoomPrimitivesPack;
  room_type_library: RoomTypeLibraryPack;
  item_tables: ItemTablesPack;
}

export type ProcgenContentPackId = keyof ProcgenContentPackMap;
