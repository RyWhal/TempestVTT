// types/index.ts - TypeScript type definitions for Tempest Table

export type TokenSize = 'tiny' | 'small' | 'medium' | 'large' | 'huge' | 'gargantuan';

export const TOKEN_SIZE_MULTIPLIERS: Record<TokenSize, number> = {
  tiny: 0.5,      // Half a grid square
  small: 1,       // 1x1 squares
  medium: 1,      // 1x1 squares
  large: 2,       // 2x2 squares
  huge: 3,        // 3x3 squares
  gargantuan: 4,  // 4x4 squares
};

export interface Session {
  id: string;
  code: string;
  name: string;
  activeMapId: string | null;
  currentGmUsername: string | null;
  notepadContent: string;
  allowPlayersRenameNpcs: boolean;
  allowPlayersMoveNpcs: boolean;
  enableInitiativePhase: boolean;
  enablePlotDice: boolean;
  allowPlayersDrawings: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SessionPlayer {
  id: string;
  sessionId: string;
  username: string;
  characterId: string | null;
  isGm: boolean;
  initiativeModifier: number;
  lastSeen: string;
}

export interface Map {
  id: string;
  sessionId: string;
  name: string;
  imageUrl: string;
  width: number;
  height: number;
  sortOrder: number;
  createdAt: string;

  // Grid
  gridEnabled: boolean;
  gridOffsetX: number;
  gridOffsetY: number;
  gridCellSize: number;
  gridColor: string;
  tokenSizeOverrideEnabled: boolean;
  mediumTokenSizePx: number | null;

  // Fog
  fogEnabled: boolean;
  fogDefaultState: 'fogged' | 'revealed';
  fogData: FogRegion[];
  drawingData: DrawingRegion[];
  effectsEnabled: boolean;
  effectData: MapEffectTile[];

  showPlayerTokens: boolean;
}

export type HandoutKind = 'image' | 'text';

export interface Handout {
  id: string;
  sessionId: string;
  title: string;
  kind: HandoutKind;
  imageUrl: string | null;
  body: string | null;
  sortOrder: number;
  createdAt: string;
}

export interface FogRegion {
  type: 'reveal' | 'hide';
  points: { x: number; y: number }[];
  brushSize: number;
}

export type DrawingShape = 'free' | 'line' | 'square' | 'circle' | 'triangle' | 'emoji';
export type DrawingAuthorRole = 'gm' | 'player';
export type MapEffectType = 'fire' | 'poison' | 'water' | 'ice' | 'arcane' | 'darkness';

export interface MapEffectTile {
  id: string;
  gridX: number;
  gridY: number;
  type: MapEffectType;
  seed: number;
}

export const DRAWING_COLORS = {
  black: '#000000',
  white: '#ffffff',
  red: '#ef4444',
  blue: '#3b82f6',
  green: '#22c55e',
  yellow: '#eab308',
  brown: '#92400e',
  gray: '#6b7280',
} as const;

export type DrawingColor = (typeof DRAWING_COLORS)[keyof typeof DRAWING_COLORS];

export const DRAWING_COLOR_OPTIONS: Array<{ label: string; value: DrawingColor }> = [
  { label: 'Black', value: DRAWING_COLORS.black },
  { label: 'White', value: DRAWING_COLORS.white },
  { label: 'Red', value: DRAWING_COLORS.red },
  { label: 'Blue', value: DRAWING_COLORS.blue },
  { label: 'Green', value: DRAWING_COLORS.green },
  { label: 'Yellow', value: DRAWING_COLORS.yellow },
  { label: 'Brown', value: DRAWING_COLORS.brown },
  { label: 'Gray', value: DRAWING_COLORS.gray },
];

export const isDrawingColor = (value: string): value is DrawingColor => {
  return Object.values(DRAWING_COLORS).includes(value as DrawingColor);
};

export interface DrawingRegion {
  id: string;
  authorRole: DrawingAuthorRole;
  authorUsername?: string;
  shape: DrawingShape;
  points: { x: number; y: number }[];
  strokeWidth: number;
  color: DrawingColor;
  filled: boolean;
  emoji?: string;
  emojiScale?: number;
  createdAt: string;
}

export interface Character {
  id: string;
  sessionId: string;
  name: string;
  tokenUrl: string | null;
  size: TokenSize;
  statusRingColor: string | null;
  positionX: number;
  positionY: number;
  isClaimed: boolean;
  claimedByUsername: string | null;
  inventory: InventoryItem[];
  notes: string;
  createdAt: string;
}

export interface InventoryItem {
  name: string;
  quantity: number;
  notes?: string;
}

export interface NPCTemplate {
  id: string;
  sessionId: string;
  name: string;
  tokenUrl: string | null;
  defaultSize: TokenSize;
  notes: string;
  createdAt: string;
}

export interface NPCInstance {
  id: string;
  mapId: string;
  templateId: string | null;
  displayName: string | null;
  tokenUrl: string | null;
  size: TokenSize | null;
  statusRingColor: string | null;
  positionX: number;
  positionY: number;
  isVisible: boolean;
  notes: string;
  createdAt: string;
}

export interface DiceRoll {
  id: string;
  sessionId: string;
  username: string;
  characterName: string | null;
  rollExpression: string;
  rollResults: RollResults;
  visibility: RollVisibility;
  plotDiceResults: PlotDieResult[] | null;
  createdAt: string;
}

export interface RollResults {
  dice: { type: string; count: number; results: number[] }[];
  modifier: number;
  total: number;
}

export type PlotDieFace = 'opportunity' | 'complication' | 'blank';

export interface PlotDieResult {
  face: PlotDieFace;
}

export interface ChatMessage {
  id: string;
  sessionId: string;
  username: string;
  message: string;
  isGmAnnouncement: boolean;
  createdAt: string;
}

export type RollVisibility = 'public' | 'gm_only' | 'self';

export type InitiativePhase = 'fast' | 'slow';
export type InitiativeVisibility = 'public' | 'gm_only';

export interface InitiativeEntry {
  id: string;
  sessionId: string;
  sourceType: 'player' | 'npc';
  sourceId: string | null;
  sourceName: string;
  rolledByUsername: string;
  modifier: number;
  rollValue: number | null;
  total: number | null;
  phase: InitiativePhase;
  visibility: InitiativeVisibility;
  isManualOverride: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface InitiativeRollLog {
  id: string;
  sessionId: string;
  sourceType: 'player' | 'npc';
  sourceId: string | null;
  sourceName: string;
  rolledByUsername: string;
  phase: InitiativePhase;
  visibility: InitiativeVisibility;
  modifier: number;
  rollValue: number;
  total: number;
  entryId: string | null;
  createdAt: string;
}

// Session export/import types
export interface SessionExport {
  version: '1.0';
  exportedAt: string;
  session: {
    name: string;
    notepadContent: string;
  };
  maps: Array<{
    name: string;
    imageBase64: string;
    width: number;
    height: number;
    gridSettings: {
      enabled: boolean;
      offsetX: number;
      offsetY: number;
      cellSize: number;
      color: string;
    };
    tokenSettings: {
      overrideEnabled: boolean;
      mediumSizePx: number | null;
    };
    fogSettings: {
      enabled: boolean;
      defaultState: string;
      fogData: FogRegion[];
    };
    showPlayerTokens: boolean;
    npcInstances: Array<{
      displayName: string;
      templateName: string;
      tokenBase64: string | null;
      size: TokenSize;
      positionX: number;
      positionY: number;
      isVisible: boolean;
      notes: string;
    }>;
  }>;
  characters: Array<{
    name: string;
    tokenBase64: string | null;
    inventory: InventoryItem[];
    notes: string;
  }>;
  npcTemplates: Array<{
    name: string;
    tokenBase64: string | null;
    defaultSize: TokenSize;
    notes: string;
  }>;
}

// Database row types (snake_case as returned from Supabase)
export interface DbSession {
  id: string;
  code: string;
  name: string;
  active_map_id: string | null;
  current_gm_username: string | null;
  notepad_content: string;
  allow_players_rename_npcs: boolean;
  allow_players_move_npcs: boolean;
  enable_initiative_phase: boolean;
  enable_plot_dice: boolean;
  allow_players_drawings: boolean;
  created_at: string;
  updated_at: string;
}

export interface DbSessionPlayer {
  id: string;
  session_id: string;
  username: string;
  character_id: string | null;
  is_gm: boolean;
  initiative_modifier: number;
  last_seen: string;
}

export interface DbMap {
  id: string;
  session_id: string;
  name: string;
  image_url: string;
  width: number;
  height: number;
  sort_order: number;
  created_at: string;
  grid_enabled: boolean;
  grid_offset_x: number;
  grid_offset_y: number;
  grid_cell_size: number;
  grid_color: string;
  token_size_override_enabled: boolean | null;
  medium_token_size_px: number | null;
  fog_enabled: boolean;
  fog_default_state: 'fogged' | 'revealed';
  fog_data: FogRegion[];
  drawing_data: DrawingRegion[];
  effects_enabled: boolean;
  effect_data: MapEffectTile[];
  show_player_tokens: boolean;
}

export interface DbCharacter {
  id: string;
  session_id: string;
  name: string;
  token_url: string | null;
  size: TokenSize | null;
  status_ring_color: string | null;
  position_x: number;
  position_y: number;
  is_claimed: boolean;
  claimed_by_username: string | null;
  inventory: InventoryItem[];
  notes: string;
  created_at: string;
}

export interface DbNPCTemplate {
  id: string;
  session_id: string;
  name: string;
  token_url: string | null;
  default_size: TokenSize;
  notes: string;
  created_at: string;
}

export interface DbHandout {
  id: string;
  session_id: string;
  title: string;
  kind: HandoutKind;
  image_url: string | null;
  body: string | null;
  sort_order: number;
  created_at: string;
}

export interface DbNPCInstance {
  id: string;
  session_id: string;
  map_id: string;
  template_id: string | null;
  display_name: string | null;
  token_url: string | null;
  size: TokenSize | null;
  status_ring_color: string | null;
  position_x: number;
  position_y: number;
  is_visible: boolean;
  notes: string;
  created_at: string;
}

export interface DbDiceRoll {
  id: string;
  session_id: string;
  username: string;
  character_name: string | null;
  roll_expression: string;
  roll_results: RollResults;
  visibility: RollVisibility;
  plot_dice_results: PlotDieResult[] | null;
  created_at: string;
}

export interface DbInitiativeEntry {
  id: string;
  session_id: string;
  source_type: 'player' | 'npc';
  source_id: string | null;
  source_name: string;
  rolled_by_username: string;
  modifier: number;
  roll_value: number | null;
  total: number | null;
  phase: InitiativePhase;
  visibility: InitiativeVisibility;
  is_manual_override: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface DbInitiativeRollLog {
  id: string;
  session_id: string;
  source_type: 'player' | 'npc';
  source_id: string | null;
  source_name: string;
  rolled_by_username: string;
  phase: InitiativePhase;
  visibility: InitiativeVisibility;
  modifier: number;
  roll_value: number;
  total: number;
  entry_id: string | null;
  created_at: string;
}

export interface DbChatMessage {
  id: string;
  session_id: string;
  username: string;
  message: string;
  is_gm_announcement: boolean;
  created_at: string;
}

// Utility type converters
export function dbSessionToSession(db: DbSession): Session {
  return {
    id: db.id,
    code: db.code,
    name: db.name,
    activeMapId: db.active_map_id,
    currentGmUsername: db.current_gm_username,
    notepadContent: db.notepad_content,
    allowPlayersRenameNpcs: db.allow_players_rename_npcs ?? true,
    allowPlayersMoveNpcs: db.allow_players_move_npcs ?? true,
    enableInitiativePhase: db.enable_initiative_phase ?? true,
    enablePlotDice: db.enable_plot_dice ?? true,
    allowPlayersDrawings: db.allow_players_drawings ?? true,
    createdAt: db.created_at,
    updatedAt: db.updated_at,
  };
}

export function dbMapToMap(db: DbMap): Map {
  return {
    id: db.id,
    sessionId: db.session_id,
    name: db.name,
    imageUrl: db.image_url,
    width: db.width,
    height: db.height,
    sortOrder: db.sort_order,
    createdAt: db.created_at,
    gridEnabled: db.grid_enabled,
    gridOffsetX: db.grid_offset_x,
    gridOffsetY: db.grid_offset_y,
    gridCellSize: db.grid_cell_size,
    gridColor: db.grid_color,
    tokenSizeOverrideEnabled: db.token_size_override_enabled ?? false,
    mediumTokenSizePx: db.medium_token_size_px ?? null,
    fogEnabled: db.fog_enabled,
    fogDefaultState: db.fog_default_state,
    fogData: db.fog_data || [],
    drawingData: db.drawing_data || [],
    effectsEnabled: db.effects_enabled ?? false,
    effectData: db.effect_data || [],
    showPlayerTokens: db.show_player_tokens,
  };
}

export function dbCharacterToCharacter(db: DbCharacter): Character {
  return {
    id: db.id,
    sessionId: db.session_id,
    name: db.name,
    tokenUrl: db.token_url,
    size: db.size || 'medium',
    statusRingColor: db.status_ring_color,
    positionX: db.position_x,
    positionY: db.position_y,
    isClaimed: db.is_claimed,
    claimedByUsername: db.claimed_by_username,
    inventory: db.inventory || [],
    notes: db.notes,
    createdAt: db.created_at,
  };
}

export function dbNPCTemplateToNPCTemplate(db: DbNPCTemplate): NPCTemplate {
  return {
    id: db.id,
    sessionId: db.session_id,
    name: db.name,
    tokenUrl: db.token_url,
    defaultSize: db.default_size,
    notes: db.notes,
    createdAt: db.created_at,
  };
}

export function dbHandoutToHandout(db: DbHandout): Handout {
  return {
    id: db.id,
    sessionId: db.session_id,
    title: db.title,
    kind: db.kind,
    imageUrl: db.image_url,
    body: db.body,
    sortOrder: db.sort_order,
    createdAt: db.created_at,
  };
}

export function dbNPCInstanceToNPCInstance(db: DbNPCInstance): NPCInstance {
  return {
    id: db.id,
    mapId: db.map_id,
    templateId: db.template_id,
    displayName: db.display_name,
    tokenUrl: db.token_url,
    size: db.size,
    statusRingColor: db.status_ring_color,
    positionX: db.position_x,
    positionY: db.position_y,
    isVisible: db.is_visible,
    notes: db.notes,
    createdAt: db.created_at,
  };
}

export function dbDiceRollToDiceRoll(db: DbDiceRoll): DiceRoll {
  return {
    id: db.id,
    sessionId: db.session_id,
    username: db.username,
    characterName: db.character_name,
    rollExpression: db.roll_expression,
    rollResults: db.roll_results,
    visibility: db.visibility,
    plotDiceResults: db.plot_dice_results,
    createdAt: db.created_at,
  };
}

export function dbInitiativeEntryToInitiativeEntry(db: DbInitiativeEntry): InitiativeEntry {
  return {
    id: db.id,
    sessionId: db.session_id,
    sourceType: db.source_type,
    sourceId: db.source_id,
    sourceName: db.source_name,
    rolledByUsername: db.rolled_by_username,
    modifier: db.modifier ?? 0,
    rollValue: db.roll_value,
    total: db.total,
    phase: db.phase,
    visibility: db.visibility,
    isManualOverride: db.is_manual_override ?? false,
    sortOrder: db.sort_order ?? 0,
    createdAt: db.created_at,
    updatedAt: db.updated_at,
  };
}

export function dbInitiativeRollLogToInitiativeRollLog(db: DbInitiativeRollLog): InitiativeRollLog {
  return {
    id: db.id,
    sessionId: db.session_id,
    sourceType: db.source_type,
    sourceId: db.source_id,
    sourceName: db.source_name,
    rolledByUsername: db.rolled_by_username,
    phase: db.phase,
    visibility: db.visibility,
    modifier: db.modifier ?? 0,
    rollValue: db.roll_value,
    total: db.total,
    entryId: db.entry_id,
    createdAt: db.created_at,
  };
}

export function dbChatMessageToChatMessage(db: DbChatMessage): ChatMessage {
  return {
    id: db.id,
    sessionId: db.session_id,
    username: db.username,
    message: db.message,
    isGmAnnouncement: db.is_gm_announcement,
    createdAt: db.created_at,
  };
}

export function dbSessionPlayerToSessionPlayer(db: DbSessionPlayer): SessionPlayer {
  return {
    id: db.id,
    sessionId: db.session_id,
    username: db.username,
    characterId: db.character_id,
    isGm: db.is_gm,
    initiativeModifier: db.initiative_modifier ?? 0,
    lastSeen: db.last_seen,
  };
}
