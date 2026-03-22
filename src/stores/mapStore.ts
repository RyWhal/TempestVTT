import { create } from 'zustand';
import type {
  Map,
  Character,
  NPCInstance,
  NPCTemplate,
  Handout,
  FogRegion,
  DrawingRegion,
  DrawingColor,
  DrawingShape,
  MapEffectTile,
  MapEffectType,
} from '../types';

interface MapState {
  // Maps
  maps: Map[];
  activeMap: Map | null;

  // Characters (player tokens)
  characters: Character[];

  // NPCs
  npcTemplates: NPCTemplate[];
  npcInstances: NPCInstance[];

  // Token positions per map
  tokenPositionsByMap: Record<
    string,
    {
      characters: Record<string, { x: number; y: number }>;
      npcs: Record<string, { x: number; y: number }>;
    }
  >;

  // Handouts
  handouts: Handout[];

  // Viewport state
  viewportScale: number;
  viewportX: number;
  viewportY: number;
  stageWidth: number;
  stageHeight: number;

  // Selected token
  selectedTokenId: string | null;
  selectedTokenType: 'character' | 'npc' | null;

  // Token locks
  tokenLocks: Record<string, string>;

  // Fog tool state (GM only)
  fogToolMode: 'reveal' | 'hide' | null;
  fogBrushSize: 'small' | 'medium' | 'large';
  fogToolShape: 'brush' | 'rectangle';

  // Drawing state
  drawingData: DrawingRegion[];
  drawingTool: DrawingShape | 'eraser' | null;
  drawingColor: DrawingColor;
  drawingStrokeWidth: number;
  drawingEmoji: string;
  drawingEmojiScale: number;

  // Map effects state
  effectPaintMode: boolean;
  effectType: MapEffectType;

  // Actions - Maps
  setMaps: (maps: Map[]) => void;
  addMap: (map: Map) => void;
  updateMap: (mapId: string, updates: Partial<Map>) => void;
  removeMap: (mapId: string) => void;
  setActiveMap: (map: Map | null) => void;

  // Actions - Characters
  setCharacters: (characters: Character[]) => void;
  addCharacter: (character: Character) => void;
  updateCharacter: (characterId: string, updates: Partial<Character>) => void;
  removeCharacter: (characterId: string) => void;
  moveCharacter: (characterId: string, x: number, y: number, mapId?: string) => void;

  // Actions - NPC Templates
  setNPCTemplates: (templates: NPCTemplate[]) => void;
  addNPCTemplate: (template: NPCTemplate) => void;
  updateNPCTemplate: (templateId: string, updates: Partial<NPCTemplate>) => void;
  removeNPCTemplate: (templateId: string) => void;

  // Actions - NPC Instances
  setNPCInstances: (instances: NPCInstance[]) => void;
  addNPCInstance: (instance: NPCInstance) => void;
  updateNPCInstance: (instanceId: string, updates: Partial<NPCInstance>) => void;
  removeNPCInstance: (instanceId: string) => void;
  moveNPCInstance: (instanceId: string, x: number, y: number, mapId?: string) => void;

  // Actions - Viewport
  setViewportScale: (scale: number) => void;
  setViewportPosition: (x: number, y: number) => void;
  setStageSize: (width: number, height: number) => void;
  resetViewport: () => void;
  fitMapToView: () => void;
  panBy: (dx: number, dy: number) => void;
  zoomTo: (scale: number, centerOnScreen?: boolean) => void;

  // Actions - Selection
  selectToken: (id: string | null, type: 'character' | 'npc' | null) => void;
  clearSelection: () => void;

  // Actions - Token locks
  setTokenLock: (tokenKey: string, username: string) => void;
  clearTokenLock: (tokenKey: string) => void;

  // Actions - Fog tools
  setFogToolMode: (mode: 'reveal' | 'hide' | null) => void;
  setFogBrushSize: (size: 'small' | 'medium' | 'large') => void;
  setFogToolShape: (shape: 'brush' | 'rectangle') => void;
  addFogRegion: (mapId: string, region: FogRegion) => void;
  clearFog: (mapId: string) => void;
  resetFog: (mapId: string) => void;

  // Actions - Drawings
  setDrawingTool: (tool: DrawingShape | 'eraser' | null) => void;
  setDrawingColor: (color: DrawingColor) => void;
  setDrawingStrokeWidth: (width: number) => void;
  setDrawingEmoji: (emoji: string) => void;
  setDrawingEmojiScale: (scale: number) => void;
  setDrawingData: (data: DrawingRegion[]) => void;
  addDrawingRegion: (mapId: string, region: DrawingRegion) => void;
  updateDrawingRegion: (mapId: string, regionId: string, updates: Partial<DrawingRegion>) => void;
  removeDrawingRegion: (mapId: string, regionId: string) => void;

  // Actions - Effects
  setEffectPaintMode: (enabled: boolean) => void;
  setEffectType: (effect: MapEffectType) => void;
  setEffectData: (mapId: string, tiles: MapEffectTile[]) => void;

  // Actions - Handouts
  setHandouts: (handouts: Handout[]) => void;
  addHandout: (handout: Handout) => void;
  updateHandout: (handoutId: string, updates: Partial<Handout>) => void;
  removeHandout: (handoutId: string) => void;

  // Clear all state
  clearMapState: () => void;
}

const FOG_BRUSH_SIZES = {
  small: 30,
  medium: 60,
  large: 120,
};

export const useMapStore = create<MapState>()((set, get) => ({
  // Initial state
  maps: [],
  activeMap: null,
  characters: [],
  npcTemplates: [],
  npcInstances: [],
  tokenPositionsByMap: {},
  handouts: [],
  viewportScale: 1,
  viewportX: 0,
  viewportY: 0,
  stageWidth: 800,
  stageHeight: 600,
  selectedTokenId: null,
  selectedTokenType: null,
  tokenLocks: {},
  fogToolMode: null,
  fogBrushSize: 'medium',
  fogToolShape: 'brush',
  drawingData: [],
  drawingTool: null,
  drawingColor: '#000000',
  drawingStrokeWidth: 4,
  drawingEmoji: '🌲',
  drawingEmojiScale: 1,
  effectPaintMode: false,
  effectType: 'fire',

  // Map actions
  setMaps: (maps) => set({ maps }),

  addMap: (map) =>
    set((state) => ({
      maps: [...state.maps.filter((m) => m.id !== map.id), map],
    })),

  updateMap: (mapId, updates) =>
    set((state) => {
      const isActive = state.activeMap?.id === mapId;
      const hasDrawingUpdate = Object.prototype.hasOwnProperty.call(updates, 'drawingData');
      const nextActiveMap =
        isActive && state.activeMap
          ? ({ ...state.activeMap, ...updates } as Map)
          : state.activeMap;
      return {
        maps: state.maps.map((m) => (m.id === mapId ? { ...m, ...updates } : m)),
        activeMap: nextActiveMap,
        drawingData:
          isActive && hasDrawingUpdate ? updates.drawingData ?? [] : state.drawingData,
      };
    }),

  removeMap: (mapId) =>
    set((state) => ({
      maps: state.maps.filter((m) => m.id !== mapId),
      activeMap: state.activeMap?.id === mapId ? null : state.activeMap,
      drawingData: state.activeMap?.id === mapId ? [] : state.drawingData,
    })),

  setActiveMap: (map) => {
    set((state) => {
      if (!map) {
        return { activeMap: null, drawingData: [] };
      }

      const mapTokenPositions = state.tokenPositionsByMap[map.id];
      const characters = mapTokenPositions
        ? state.characters.map((character) => {
            const position = mapTokenPositions.characters[character.id];
            return position
              ? { ...character, positionX: position.x, positionY: position.y }
              : character;
          })
        : state.characters;

      const npcInstances = mapTokenPositions
        ? state.npcInstances.map((instance) => {
            if (instance.mapId !== map.id) return instance;
            const position = mapTokenPositions.npcs[instance.id];
            return position
              ? { ...instance, positionX: position.x, positionY: position.y }
              : instance;
          })
        : state.npcInstances;

      return {
        activeMap: map,
        drawingData: map.drawingData ?? [],
        characters,
        npcInstances,
      };
    });
    // Auto-fit map to view when a new map is activated
    if (map) {
      setTimeout(() => get().fitMapToView(), 50);
    }
  },

  // Character actions
  setCharacters: (characters) =>
    set((state) => {
      const activeMapId = state.activeMap?.id;
      if (!activeMapId) return { characters };

      const mapTokenPositions = state.tokenPositionsByMap[activeMapId];
      if (!mapTokenPositions) return { characters };

      return {
        characters: characters.map((character) => {
          const position = mapTokenPositions.characters[character.id];
          return position
            ? { ...character, positionX: position.x, positionY: position.y }
            : character;
        }),
      };
    }),

  addCharacter: (character) =>
    set((state) => ({
      characters: [
        ...state.characters.filter((c) => c.id !== character.id),
        character,
      ],
    })),

  updateCharacter: (characterId, updates) =>
    set((state) => ({
      characters: state.characters.map((c) =>
        c.id === characterId ? { ...c, ...updates } : c
      ),
    })),

  removeCharacter: (characterId) =>
    set((state) => ({
      characters: state.characters.filter((c) => c.id !== characterId),
      selectedTokenId:
        state.selectedTokenId === characterId ? null : state.selectedTokenId,
      selectedTokenType:
        state.selectedTokenId === characterId ? null : state.selectedTokenType,
    })),

  moveCharacter: (characterId, x, y, mapId) =>
    set((state) => {
      const resolvedMapId = mapId ?? state.activeMap?.id;
      const mapPositions = resolvedMapId
        ? state.tokenPositionsByMap[resolvedMapId] ?? { characters: {}, npcs: {} }
        : null;
      const shouldUpdateVisibleCharacter = !resolvedMapId || resolvedMapId === state.activeMap?.id;

      return {
        characters: shouldUpdateVisibleCharacter
          ? state.characters.map((c) =>
              c.id === characterId ? { ...c, positionX: x, positionY: y } : c
            )
          : state.characters,
        tokenPositionsByMap:
          resolvedMapId && mapPositions
            ? {
                ...state.tokenPositionsByMap,
                [resolvedMapId]: {
                  ...mapPositions,
                  characters: {
                    ...mapPositions.characters,
                    [characterId]: { x, y },
                  },
                },
              }
            : state.tokenPositionsByMap,
      };
    }),

  // NPC Template actions
  setNPCTemplates: (templates) => set({ npcTemplates: templates }),

  addNPCTemplate: (template) =>
    set((state) => ({
      npcTemplates: [
        ...state.npcTemplates.filter((t) => t.id !== template.id),
        template,
      ],
    })),

  updateNPCTemplate: (templateId, updates) =>
    set((state) => ({
      npcTemplates: state.npcTemplates.map((t) =>
        t.id === templateId ? { ...t, ...updates } : t
      ),
    })),

  removeNPCTemplate: (templateId) =>
    set((state) => ({
      npcTemplates: state.npcTemplates.filter((t) => t.id !== templateId),
    })),

  // NPC Instance actions
  setNPCInstances: (instances) =>
    set((state) => {
      const activeMapId = state.activeMap?.id;
      if (!activeMapId) return { npcInstances: instances };

      const mapTokenPositions = state.tokenPositionsByMap[activeMapId];
      if (!mapTokenPositions) return { npcInstances: instances };

      return {
        npcInstances: instances.map((instance) => {
          if (instance.mapId !== activeMapId) return instance;
          const position = mapTokenPositions.npcs[instance.id];
          return position
            ? { ...instance, positionX: position.x, positionY: position.y }
            : instance;
        }),
      };
    }),

  addNPCInstance: (instance) =>
    set((state) => ({
      npcInstances: [
        ...state.npcInstances.filter((i) => i.id !== instance.id),
        instance,
      ],
    })),

  updateNPCInstance: (instanceId, updates) =>
    set((state) => ({
      npcInstances: state.npcInstances.map((i) =>
        i.id === instanceId ? { ...i, ...updates } : i
      ),
    })),

  removeNPCInstance: (instanceId) =>
    set((state) => ({
      npcInstances: state.npcInstances.filter((i) => i.id !== instanceId),
      selectedTokenId:
        state.selectedTokenId === instanceId ? null : state.selectedTokenId,
      selectedTokenType:
        state.selectedTokenId === instanceId ? null : state.selectedTokenType,
    })),

  moveNPCInstance: (instanceId, x, y, mapId) =>
    set((state) => {
      const instance = state.npcInstances.find((i) => i.id === instanceId);
      const resolvedMapId = mapId ?? instance?.mapId ?? state.activeMap?.id;
      const mapPositions = resolvedMapId
        ? state.tokenPositionsByMap[resolvedMapId] ?? { characters: {}, npcs: {} }
        : null;

      return {
        npcInstances: state.npcInstances.map((i) =>
          i.id === instanceId ? { ...i, positionX: x, positionY: y } : i
        ),
        tokenPositionsByMap:
          resolvedMapId && mapPositions
            ? {
                ...state.tokenPositionsByMap,
                [resolvedMapId]: {
                  ...mapPositions,
                  npcs: {
                    ...mapPositions.npcs,
                    [instanceId]: { x, y },
                  },
                },
              }
            : state.tokenPositionsByMap,
      };
    }),

  // Viewport actions
  setViewportScale: (scale) =>
    set({ viewportScale: Math.max(0.1, Math.min(5, scale)) }),

  setViewportPosition: (x, y) => set({ viewportX: x, viewportY: y }),

  setStageSize: (width, height) => set({ stageWidth: width, stageHeight: height }),

  resetViewport: () => set({ viewportScale: 1, viewportX: 0, viewportY: 0 }),

  fitMapToView: () => {
    const state = get();
    const { activeMap, stageWidth, stageHeight } = state;
    if (!activeMap || stageWidth === 0 || stageHeight === 0) return;

    // Keep a small, responsive edge margin so wide/tall maps can use more of the viewport
    const padding = Math.max(16, Math.min(40, Math.round(Math.min(stageWidth, stageHeight) * 0.02)));
    const availableWidth = Math.max(1, stageWidth - padding * 2);
    const availableHeight = Math.max(1, stageHeight - padding * 2);

    // Calculate scale to fit map in view
    const scaleX = availableWidth / activeMap.width;
    const scaleY = availableHeight / activeMap.height;
    const scale = Math.max(0.1, Math.min(scaleX, scaleY));

    // Center the map
    const scaledWidth = activeMap.width * scale;
    const scaledHeight = activeMap.height * scale;
    const x = (stageWidth - scaledWidth) / 2;
    const y = (stageHeight - scaledHeight) / 2;

    set({
      viewportScale: scale,
      viewportX: x,
      viewportY: y,
    });
  },

  panBy: (dx, dy) =>
    set((state) => ({
      viewportX: state.viewportX + dx,
      viewportY: state.viewportY + dy,
    })),

  zoomTo: (scale, centerOnScreen = true) => {
    const state = get();
    const clampedScale = Math.max(0.1, Math.min(5, scale));

    if (centerOnScreen) {
      // Zoom towards center of screen
      const centerX = state.stageWidth / 2;
      const centerY = state.stageHeight / 2;

      const oldScale = state.viewportScale;
      const mousePointTo = {
        x: (centerX - state.viewportX) / oldScale,
        y: (centerY - state.viewportY) / oldScale,
      };

      const newPos = {
        x: centerX - mousePointTo.x * clampedScale,
        y: centerY - mousePointTo.y * clampedScale,
      };

      set({
        viewportScale: clampedScale,
        viewportX: newPos.x,
        viewportY: newPos.y,
      });
    } else {
      set({ viewportScale: clampedScale });
    }
  },

  // Selection actions
  selectToken: (id, type) =>
    set({ selectedTokenId: id, selectedTokenType: type }),

  clearSelection: () => set({ selectedTokenId: null, selectedTokenType: null }),

  setTokenLock: (tokenKey, username) =>
    set((state) => ({
      tokenLocks: { ...state.tokenLocks, [tokenKey]: username },
    })),

  clearTokenLock: (tokenKey) =>
    set((state) => {
      if (!state.tokenLocks[tokenKey]) return state;
      const { [tokenKey]: _removed, ...rest } = state.tokenLocks;
      return { tokenLocks: rest };
    }),

  // Fog actions
  setFogToolMode: (mode) => set({ fogToolMode: mode }),

  setFogBrushSize: (size) => set({ fogBrushSize: size }),

  setFogToolShape: (shape) => set({ fogToolShape: shape }),

  addFogRegion: (mapId, region) => {
    const state = get();
    const map = state.maps.find((m) => m.id === mapId);
    if (!map) return;

    const newFogData = [...map.fogData, region];
    set((state) => ({
      maps: state.maps.map((m) =>
        m.id === mapId ? { ...m, fogData: newFogData } : m
      ),
      activeMap:
        state.activeMap?.id === mapId
          ? { ...state.activeMap, fogData: newFogData }
          : state.activeMap,
    }));
  },

  clearFog: (mapId) => {
    // Reveal all fog (set fog data to cover everything with reveal)
    set((state) => ({
      maps: state.maps.map((m) =>
        m.id === mapId ? { ...m, fogData: [] } : m
      ),
      activeMap:
        state.activeMap?.id === mapId
          ? { ...state.activeMap, fogData: [] }
          : state.activeMap,
    }));
  },

  resetFog: (mapId) => {
    // Reset to default fog state (clear all regions)
    set((state) => ({
      maps: state.maps.map((m) =>
        m.id === mapId ? { ...m, fogData: [] } : m
      ),
      activeMap:
        state.activeMap?.id === mapId
          ? { ...state.activeMap, fogData: [] }
          : state.activeMap,
    }));
  },

  // Drawing actions
  setDrawingTool: (tool) => set({ drawingTool: tool }),

  setDrawingColor: (color) => set({ drawingColor: color }),

  setDrawingStrokeWidth: (width) => set({ drawingStrokeWidth: Math.max(1, width) }),

  setDrawingEmoji: (emoji) => set({ drawingEmoji: emoji }),

  setDrawingEmojiScale: (scale) => set({ drawingEmojiScale: Math.max(0.5, Math.min(3, scale)) }),

  setDrawingData: (data) => set({ drawingData: data }),

  addDrawingRegion: (mapId, region) => {
    const state = get();
    const map = state.maps.find((m) => m.id === mapId);
    if (!map) return;

    const newDrawingData = [...map.drawingData, region];
    set((state) => ({
      maps: state.maps.map((m) =>
        m.id === mapId ? { ...m, drawingData: newDrawingData } : m
      ),
      activeMap:
        state.activeMap?.id === mapId
          ? { ...state.activeMap, drawingData: newDrawingData }
          : state.activeMap,
      drawingData:
        state.activeMap?.id === mapId ? newDrawingData : state.drawingData,
    }));
  },

  updateDrawingRegion: (mapId, regionId, updates) => {
    const state = get();
    const map = state.maps.find((m) => m.id === mapId);
    if (!map) return;

    const newDrawingData = map.drawingData.map((region) =>
      region.id === regionId ? { ...region, ...updates } : region
    );
    set((state) => ({
      maps: state.maps.map((m) =>
        m.id === mapId ? { ...m, drawingData: newDrawingData } : m
      ),
      activeMap:
        state.activeMap?.id === mapId
          ? { ...state.activeMap, drawingData: newDrawingData }
          : state.activeMap,
      drawingData:
        state.activeMap?.id === mapId ? newDrawingData : state.drawingData,
    }));
  },

  removeDrawingRegion: (mapId, regionId) => {
    const state = get();
    const map = state.maps.find((m) => m.id === mapId);
    if (!map) return;

    const newDrawingData = map.drawingData.filter((region) => region.id !== regionId);
    set((state) => ({
      maps: state.maps.map((m) =>
        m.id === mapId ? { ...m, drawingData: newDrawingData } : m
      ),
      activeMap:
        state.activeMap?.id === mapId
          ? { ...state.activeMap, drawingData: newDrawingData }
          : state.activeMap,
      drawingData:
        state.activeMap?.id === mapId ? newDrawingData : state.drawingData,
    }));
  },

  setEffectPaintMode: (enabled) => set({ effectPaintMode: enabled }),

  setEffectType: (effect) => set({ effectType: effect }),

  setEffectData: (mapId, tiles) =>
    set((state) => ({
      maps: state.maps.map((m) => (m.id === mapId ? { ...m, effectData: tiles } : m)),
      activeMap: state.activeMap?.id === mapId ? { ...state.activeMap, effectData: tiles } : state.activeMap,
    })),

  setHandouts: (handouts) => set({ handouts }),

  addHandout: (handout) =>
    set((state) => ({
      handouts: [...state.handouts.filter((h) => h.id !== handout.id), handout],
    })),

  updateHandout: (handoutId, updates) =>
    set((state) => ({
      handouts: state.handouts.map((handout) =>
        handout.id === handoutId ? { ...handout, ...updates } : handout
      ),
    })),

  removeHandout: (handoutId) =>
    set((state) => ({
      handouts: state.handouts.filter((handout) => handout.id !== handoutId),
    })),

  clearMapState: () =>
    set({
      maps: [],
      activeMap: null,
      characters: [],
      npcTemplates: [],
      npcInstances: [],
      tokenPositionsByMap: {},
      handouts: [],
      viewportScale: 1,
      viewportX: 0,
      viewportY: 0,
      selectedTokenId: null,
      selectedTokenType: null,
      tokenLocks: {},
      fogToolMode: null,
      fogToolShape: 'brush',
      drawingData: [],
      drawingTool: null,
      drawingColor: '#000000',
      drawingStrokeWidth: 4,
  drawingEmoji: '🌲',
  drawingEmojiScale: 1,
  effectPaintMode: false,
  effectType: 'fire',
    }),
}));

// Selector hooks
export const useActiveMap = () => useMapStore((state) => state.activeMap);
export const useCharacters = () => useMapStore((state) => state.characters);
export const useNPCInstances = () => useMapStore((state) => state.npcInstances);
export const useSelectedToken = () =>
  useMapStore((state) => ({
    id: state.selectedTokenId,
    type: state.selectedTokenType,
  }));

// Get fog brush size in pixels
export const getFogBrushPixelSize = (size: 'small' | 'medium' | 'large'): number => {
  return FOG_BRUSH_SIZES[size];
};
