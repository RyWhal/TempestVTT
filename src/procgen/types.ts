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
  sectionProfile?: ResolvedSectionProfile;
}

export interface SectionCoordinates {
  x: number;
  y: number;
}

export interface ResolvedSectionProfile {
  seed: string;
  coordinates: SectionCoordinates;
  graphDepth: number;
  sectionKind: SectionKind;
  biomeProfileId: string;
  settlementProfileId: string | null;
  livabilityScore: number;
  defaultFloorMaterialKey: string;
  roomPrimitiveDensity: number;
  corridorDensity: number;
  junctionDensity: number;
  openSpaceRatio: number;
  landmarkFrequency: number;
  allowedRoomPrimitiveIds: string[];
  allowedCorridorPrimitiveIds: string[];
  settlementPrimitivePreferenceIds: string[];
}

export interface ResolvedSectionProfileInput {
  worldSeed: string;
  coordinates: SectionCoordinates;
  graphDepth?: number;
  requestedSectionKind?: SectionKind;
  forcedBiomeProfileId?: string;
  forcedSettlementProfileId?: string;
  siblingBiomeIds?: string[];
  siblingSettlementProfileIds?: string[];
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

export interface GeneratedConnectorAnchor {
  roomId: string;
  side: CardinalDirection;
  x: number;
  y: number;
}

export interface GeneratedSectionConnector {
  connectorId: string;
  primitiveId: string;
  family: 'corridor' | 'junction';
  segmentBounds: RectBounds[];
  connectedRoomIds: string[];
  roomAnchors: GeneratedConnectorAnchor[];
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
  defaultFloorMaterialKey: string;
  sectionProfile: ResolvedSectionProfile | null;
  rooms: GeneratedSectionRoom[];
  connections: GeneratedSectionConnection[];
  connectors: GeneratedSectionConnector[];
  entranceRoomIds: string[];
  exitRoomIds: string[];
}

export type SectionContentRerollScope =
  | 'all'
  | 'summary'
  | 'npcs'
  | 'creatures'
  | 'encounters'
  | 'shops'
  | 'hazards'
  | 'rumors';

export interface SectionContentRerollState {
  summary: number;
  npcs: number;
  creatures: number;
  encounters: number;
  shops: number;
  hazards: number;
  rumors: number;
}

export interface GeneratedSectionNpc {
  id: string;
  name: string;
  roleId: string;
  roleName: string;
  trait: string;
  motivation: string;
  secret: string;
  rumor: string;
}

export interface GeneratedSectionNpcContent {
  npcs: GeneratedSectionNpc[];
  npcEntities: GeneratedNpcEntity[];
  npcAppearances: GeneratedNpcAppearance[];
}

export interface GeneratedSectionCreature {
  id: string;
  familyId: string;
  name: string;
  origin: string;
  sizeClass: string;
  intelligence: string;
  temperament: string;
  hook: string;
  role: string;
  societyLevel: string;
  base5eAnalog: string;
  visualKeywords: string[];
  signatureTraits: string[];
  lootTags: string[];
  variantIds: string[];
  variantNames: string[];
  variantVisualKeywords: string[];
  behaviorAdjustments: string[];
  resolvedStats: {
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
  };
  actions: Array<{
    name: string;
    summary: string;
  }>;
  traits: string[];
}

export interface GeneratedSectionEncounter {
  id: string;
  title: string;
  summary: string;
  detail: string;
  threatLevel: 'low' | 'moderate' | 'high';
}

export interface GeneratedSectionShop {
  id: string;
  shopTypeId: string;
  name: string;
  ownerName: string;
  services: string[];
  featuredStock: string[];
  description: string;
  pressure: string;
}

export interface GeneratedSectionHazard {
  id: string;
  name: string;
  summary: string;
}

export interface GeneratedSectionRumor {
  id: string;
  text: string;
  source: string;
}

export interface GeneratedSectionHook {
  id: string;
  title: string;
  text: string;
  source: string;
}

export interface GeneratedSectionContent {
  sectionName: string;
  biomeName: string;
  summary: string;
  tone: string;
  biomeDescription: string;
  settlementArchetypeId: string | null;
  settlementArchetypeName: string | null;
  npcEntities: GeneratedNpcEntity[];
  npcAppearances: GeneratedNpcAppearance[];
  npcs: GeneratedSectionNpc[];
  creatures: GeneratedSectionCreature[];
  encounters: GeneratedSectionEncounter[];
  shops: GeneratedSectionShop[];
  hazards: GeneratedSectionHazard[];
  rumors: GeneratedSectionRumor[];
  hooks: GeneratedSectionHook[];
  campaignBook: GeneratedCampaignBook;
}

export const CAMPAIGN_BOOK_ENTRY_TYPES = [
  'read_aloud_intro',
  'area_impression',
  'room_scene',
  'npc_profile',
  'npc_roleplay_note',
  'encounter_seed',
  'creature_seed',
  'shop_seed',
  'item_seed',
  'hazard_seed',
  'hook_seed',
] as const;

export type CampaignBookEntryType = (typeof CAMPAIGN_BOOK_ENTRY_TYPES)[number];

export const CAMPAIGN_BOOK_ENTRY_STATUSES = [
  'suggested',
  'accepted',
  'crossed_out',
  'gm_added',
] as const;

export type CampaignBookEntryStatus = (typeof CAMPAIGN_BOOK_ENTRY_STATUSES)[number];

export interface GeneratedCampaignBookEntry {
  id: string;
  sectionId: string;
  type: CampaignBookEntryType;
  title: string;
  body: string;
  summary: string | null;
  status: CampaignBookEntryStatus;
  tags: string[];
  relatedRoomIds: string[];
  relatedNpcIds: string[];
  relatedCreatureIds: string[];
  relatedShopIds: string[];
  provenance?: {
    biomeId: string | null;
    sectionSeed: string | null;
  };
}

export interface GeneratedSectionNarrativeBeat {
  id: string;
  type: Extract<CampaignBookEntryType, 'read_aloud_intro' | 'area_impression' | 'room_scene'>;
  title: string;
  body: string;
  summary: string | null;
  tags: string[];
  relatedRoomIds: string[];
}

export interface GeneratedSectionNarrative {
  readAloudIntro: GeneratedSectionNarrativeBeat;
  areaImpressions: GeneratedSectionNarrativeBeat[];
  roomScenes: GeneratedSectionNarrativeBeat[];
}

export interface GeneratedNpcEntity {
  id: string;
  name: string;
  speciesId: string;
  speciesOrigin: string;
  roleId: string | null;
  roleName: string | null;
  category: string | null;
  tier: string | null;
  settlementType: string | null;
  biomeId: string | null;
  anchorTemplateId: string | null;
  anchorTemplateName: string | null;
  modifierIds: string[];
  modifierNames: string[];
  baselineBackstory: string;
  appearanceSummary: string;
  personality: string;
  voice: string;
  mannerisms: string[];
  motivations: string[];
  secrets: string[];
  rumorKnowledge: string[];
  knownFor: string[];
  currentDisposition: string | null;
  factionId: string | null;
  shopId: string | null;
  resolvedStats: {
    ac: number;
    hp: number;
    hitDice: string;
    speed: number;
    abilities: {
      str: number;
      dex: number;
      con: number;
      int: number;
      wis: number;
      cha: number;
    };
    savingThrows: string[];
    skills: string[];
    senses: string[];
    languages: string[];
    proficiencyBonus: number;
    cr: number;
  };
  actions: Array<Record<string, unknown>>;
  spellcasting: Record<string, unknown> | null;
  equipment: string[];
  traits: string[];
  shortDescription: string;
  portraitPrompt: string;
  gmNotes: string;
}

export interface GeneratedNpcAppearance {
  id: string;
  sectionId: string;
  npcId: string;
  context: string;
  roleInSection: string;
  wantsFromPlayers: string;
  framing: string;
  knows: string[];
  needs: string[];
  offers: string[];
}

export interface GeneratedCampaignBook {
  sectionId: string;
  entries: GeneratedCampaignBookEntry[];
  persistentNpcs: GeneratedNpcEntity[];
  npcAppearances: GeneratedNpcAppearance[];
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
  transitionMaterialKey?: string;
  materialCategory?: string;
  sourceRoomId?: string;
  sourceConnectorId?: string;
}

export interface SectionRenderLine {
  id: string;
  points: [number, number, number, number];
  stroke: string;
  strokeWidth: number;
  surfaceType?: 'wall' | 'threshold';
  materialKey?: string;
  sourceRoomId?: string;
  sourceConnectorId?: string;
  biomeId?: string;
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

export interface SectionBakedFloorChunk {
  chunkX: number;
  chunkY: number;
  x: number;
  y: number;
  widthPx: number;
  heightPx: number;
  imagePath: string;
  imageUrl: string;
  tileSprites?: SectionBakedFloorTileSprite[];
  wallSprites?: SectionBakedWallSprite[];
  dressingSprites?: SectionBakedDressingSprite[];
  transitionOverlays?: SectionBakedFloorTransitionOverlay[];
}

export interface SectionBakedEnvironmentSprite {
  assetId: string;
  assetUrl: string;
  fallbackAssetUrls?: string[];
  x: number;
  y: number;
  widthPx: number;
  heightPx: number;
  rotationDegrees: number;
  flipHorizontal: boolean;
  flipVertical: boolean;
}

export type SectionBakedFloorTileSprite = SectionBakedEnvironmentSprite;
export type SectionBakedWallSprite = SectionBakedEnvironmentSprite;
export type SectionBakedDressingSprite = SectionBakedEnvironmentSprite;

export interface SectionBakedFloorTransitionOverlay {
  id: string;
  x: number;
  y: number;
  widthPx: number;
  heightPx: number;
  fill: string;
}

export interface SectionBakedFloorLayer {
  status: 'pending' | 'running' | 'complete' | 'failed';
  chunkSizePx: number;
  tileResolutionPx: number;
  floorCellsPerChunk: number;
  chunks: SectionBakedFloorChunk[];
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
  bakedFloor?: SectionBakedFloorLayer;
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
export interface BiomeGenerationProfile extends ProcgenIdentifiedRecord {
  label: string;
  allowed_section_kinds?: SectionKind[];
  allowed_room_primitive_ids?: string[];
  room_primitive_density: number;
  allowed_corridor_primitive_ids?: string[];
  corridor_density: number;
  junction_density: number;
  open_space_ratio: number;
  landmark_frequency: number;
  hazard_pressure: number;
  settlement_pressure: number;
  default_floor_material_key: string;
  alternate_floor_material_keys?: string[];
}
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
export interface SettlementGenerationProfile extends ProcgenIdentifiedRecord {
  label: string;
  allowed_biomes?: string[];
  water_support: number;
  food_support: number;
  safety_modifier: number;
  route_centrality_modifier: number;
  open_space_preference: number;
  primitive_preferences: string[];
  minimum_livability_score: number;
  npc_role_weights: Record<string, number>;
  shop_type_weights: Record<string, number>;
  default_floor_material_key: string;
}
export interface NpcArchetype extends ProcgenIdentifiedRecord {
  category?: string;
  allowed_roles?: string[];
  allowed_archetypes?: string[];
  allowed_settlement_archetypes?: string[];
  allowed_biomes?: string[];
  allowed_section_kinds?: string[];
  allowed_shop_types?: string[];
  required_shop_roles?: string[];
  requires_hazard?: boolean;
  [key: string]: unknown;
}
export interface NpcPhysicalDescription extends ProcgenIdentifiedRecord {
  category?: string;
  text: string;
  allowed_roles?: string[];
  allowed_archetypes?: string[];
  allowed_settlement_archetypes?: string[];
  allowed_biomes?: string[];
  allowed_section_kinds?: string[];
  allowed_shop_types?: string[];
  required_shop_roles?: string[];
  requires_hazard?: boolean;
  [key: string]: unknown;
}
export interface NpcRoleplayingEntry extends ProcgenIdentifiedRecord {
  category?: string;
  text: string;
  allowed_roles?: string[];
  allowed_archetypes?: string[];
  allowed_settlement_archetypes?: string[];
  allowed_biomes?: string[];
  allowed_section_kinds?: string[];
  allowed_shop_types?: string[];
  required_shop_roles?: string[];
  requires_hazard?: boolean;
  [key: string]: unknown;
}
export interface NpcBackstoryFragment extends ProcgenIdentifiedRecord {
  category?: string;
  text: string;
  allowed_roles?: string[];
  allowed_archetypes?: string[];
  allowed_settlement_archetypes?: string[];
  allowed_biomes?: string[];
  allowed_section_kinds?: string[];
  allowed_shop_types?: string[];
  required_shop_roles?: string[];
  requires_hazard?: boolean;
  [key: string]: unknown;
}
export interface NpcContextEntry extends ProcgenIdentifiedRecord {
  category?: string;
  text: string;
  allowed_roles?: string[];
  allowed_archetypes?: string[];
  allowed_settlement_archetypes?: string[];
  allowed_biomes?: string[];
  allowed_section_kinds?: string[];
  allowed_shop_types?: string[];
  required_shop_roles?: string[];
  requires_hazard?: boolean;
  [key: string]: unknown;
}
export interface ShopFlavorFragment extends ProcgenIdentifiedRecord {
  category?: string;
  text: string;
  allowed_roles?: string[];
  allowed_archetypes?: string[];
  allowed_shop_types?: string[];
  allowed_settlement_archetypes?: string[];
  allowed_biomes?: string[];
  allowed_section_kinds?: string[];
  required_shop_roles?: string[];
  requires_hazard?: boolean;
  [key: string]: unknown;
}
export interface EncounterTemplate extends ProcgenIdentifiedRecord {
  category?: string;
  title: string;
  summary: string;
  detail: string;
  threat_level: 'low' | 'moderate' | 'high';
  allowed_roles?: string[];
  allowed_archetypes?: string[];
  allowed_section_kinds?: string[];
  allowed_settlement_archetypes?: string[];
  allowed_biomes?: string[];
  required_shop_roles?: string[];
  requires_hazard?: boolean;
  [key: string]: unknown;
}
export interface RumorFragment extends ProcgenIdentifiedRecord {
  category?: string;
  text: string;
  source?: string;
  allowed_roles?: string[];
  allowed_archetypes?: string[];
  allowed_section_kinds?: string[];
  allowed_settlement_archetypes?: string[];
  allowed_biomes?: string[];
  allowed_shop_types?: string[];
  required_shop_roles?: string[];
  requires_hazard?: boolean;
  [key: string]: unknown;
}
export interface HookFragment extends ProcgenIdentifiedRecord {
  category?: string;
  title: string;
  text: string;
  source?: string;
  allowed_roles?: string[];
  allowed_archetypes?: string[];
  allowed_section_kinds?: string[];
  allowed_settlement_archetypes?: string[];
  allowed_biomes?: string[];
  allowed_shop_types?: string[];
  required_shop_roles?: string[];
  requires_hazard?: boolean;
  [key: string]: unknown;
}
export interface SectionNarrativeFragment extends ProcgenIdentifiedRecord {
  category?: string;
  title_template: string;
  text: string;
  summary_text: string;
  allowed_roles?: string[];
  allowed_archetypes?: string[];
  allowed_section_kinds?: string[];
  allowed_settlement_archetypes?: string[];
  allowed_biomes?: string[];
  allowed_shop_types?: string[];
  required_shop_roles?: string[];
  requires_hazard?: boolean;
  [key: string]: unknown;
}
export interface CreatureBookFragment extends ProcgenIdentifiedRecord {
  category?: string;
  title_template: string;
  text: string;
  summary_text: string;
  allowed_roles?: string[];
  allowed_archetypes?: string[];
  allowed_section_kinds?: string[];
  allowed_settlement_archetypes?: string[];
  allowed_biomes?: string[];
  allowed_shop_types?: string[];
  required_shop_roles?: string[];
  requires_hazard?: boolean;
  [key: string]: unknown;
}
export interface CreatureAnchorTemplate extends ProcgenIdentifiedRecord {
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
  actions: Array<{
    name: string;
    summary: string;
  }>;
  traits: string[];
}
export interface RoomPrimitive extends ProcgenIdentifiedRecord {
  family?: string;
  grid_footprint?: PrimitiveGridFootprint;
  supports_rotation?: boolean;
  [key: string]: unknown;
}
export interface RoomType extends ProcgenIdentifiedRecord {}
export interface ItemTemplate extends ProcgenIdentifiedRecord {}
export interface FloorMaterialProfile extends ProcgenIdentifiedRecord {
  label: string;
  category: string;
  fallback_material_key: string;
  asset_path: string;
  variant_asset_paths: string[];
  supports_tiling: boolean;
}
export interface FloorTransitionProfile extends ProcgenIdentifiedRecord {
  from_material_key: string;
  to_material_key: string;
  asset_path: string;
  fallback_material_key: string;
}
export interface WallAssetVariant {
  id: string;
  path: string;
  weight: number;
}

export interface WallAssetFamily {
  biome_id: string;
  wallset_id: string;
  rotation_safe: boolean;
  flip_safe: boolean;
  assets: {
    base: WallAssetVariant[];
  };
}

export interface WallAssetRegistry {
  schema_version: string;
  registry_id: string;
  biome_wallsets: WallAssetFamily[];
}
export interface NpcGenerationSchema {
  required_inputs?: Record<string, unknown>;
  generation_steps?: string[];
  resolved_output_schema?: Record<string, unknown>;
  portrait_prompt_template?: string;
  short_description_template?: string;
  fallback_rules?: Record<string, unknown>;
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

export interface NpcArchetypesPack {
  npcArchetypes: NpcArchetype[];
}

export interface NpcPhysicalDescriptionsPack {
  npcPhysicalDescriptions: NpcPhysicalDescription[];
}

export interface NpcRoleplayingPack {
  voice: NpcRoleplayingEntry[];
  mannerisms: NpcRoleplayingEntry[];
  framing: NpcRoleplayingEntry[];
  currentPressure: NpcRoleplayingEntry[];
}

export interface NpcBackstoryFragmentsPack {
  npcBackstoryFragments: NpcBackstoryFragment[];
}

export interface NpcContextModifiersPack {
  knows: NpcContextEntry[];
  needs: NpcContextEntry[];
  offers: NpcContextEntry[];
  knownFor: NpcContextEntry[];
}

export interface ShopFlavorFragmentsPack {
  descriptions: ShopFlavorFragment[];
  pressures: ShopFlavorFragment[];
}

export interface EncounterTemplatesPack {
  encounterTemplates: EncounterTemplate[];
}

export interface RumorFragmentsPack {
  rumorFragments: RumorFragment[];
}

export interface HookFragmentsPack {
  hookFragments: HookFragment[];
}

export interface SectionNarrativeFragmentsPack {
  sectionNarrativeFragments: SectionNarrativeFragment[];
}

export interface CreatureBookFragmentsPack {
  creatureBookFragments: CreatureBookFragment[];
}

export interface CreatureAnchorTemplatesPack {
  creatureAnchorTemplates: CreatureAnchorTemplate[];
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

export interface BiomeGenerationProfilesPack {
  entries: BiomeGenerationProfile[];
}

export interface SettlementGenerationProfilesPack {
  entries: SettlementGenerationProfile[];
}

export interface FloorMaterialProfilesPack {
  entries: FloorMaterialProfile[];
}

export interface FloorTransitionProfilesPack {
  entries: FloorTransitionProfile[];
}

export interface ProcgenContentPackMap {
  biomes: BiomesPack;
  biome_generation_profiles: BiomeGenerationProfilesPack;
  creature_families: CreatureFamiliesPack;
  creature_variants: CreatureVariantsPack;
  name_phonemes: NamePhonemesPack;
  npc_anchor_templates: NpcAnchorTemplatesPack;
  npc_generation_schema: NpcGenerationSchemaPack;
  npc_modifiers: NpcModifiersPack;
  npc_archetypes: NpcArchetypesPack;
  npc_physical_descriptions: NpcPhysicalDescriptionsPack;
  npc_roleplaying: NpcRoleplayingPack;
  npc_backstory_fragments: NpcBackstoryFragmentsPack;
  npc_context_modifiers: NpcContextModifiersPack;
  shop_flavor_fragments: ShopFlavorFragmentsPack;
  encounter_templates: EncounterTemplatesPack;
  rumor_fragments: RumorFragmentsPack;
  hook_fragments: HookFragmentsPack;
  section_narrative_fragments: SectionNarrativeFragmentsPack;
  creature_book_fragments: CreatureBookFragmentsPack;
  creature_anchor_templates: CreatureAnchorTemplatesPack;
  npc_role_to_anchor_mapping: NpcRoleToAnchorMappingPack;
  npc_roles: NpcRolesPack;
  village_archetypes: VillageArchetypesPack;
  genai_description_schema: GenAiDescriptionSchemaPack;
  shop_types: ShopTypesPack;
  settlement_generation_profiles: SettlementGenerationProfilesPack;
  room_primitives: RoomPrimitivesPack;
  room_type_library: RoomTypeLibraryPack;
  item_tables: ItemTablesPack;
  floor_material_profiles: FloorMaterialProfilesPack;
  floor_transition_profiles: FloorTransitionProfilesPack;
}

export type ProcgenContentPackId = keyof ProcgenContentPackMap;
