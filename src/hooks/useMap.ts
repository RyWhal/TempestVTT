import { useCallback } from 'react';
import { supabase, uploadFile, deleteFile, STORAGE_BUCKETS } from '../lib/supabase';
import { useSessionStore } from '../stores/sessionStore';
import { useMapStore } from '../stores/mapStore';
import { dbMapToMap, type DbMap, type Map, type FogRegion, type DrawingRegion, type MapEffectTile } from '../types';
import { nanoid } from 'nanoid';
import { broadcastActiveMap } from '../lib/tokenBroadcast';

export const useMap = () => {
  const session = useSessionStore((state) => state.session);
  const { maps, activeMap, setActiveMap, addMap, updateMap, removeMap } = useMapStore();

  /**
   * Upload a new map
   */
  const uploadMap = useCallback(
    async (
      file: File,
      name: string,
      width: number,
      height: number
    ): Promise<{ success: boolean; map?: Map; error?: string }> => {
      if (!session) {
        return { success: false, error: 'Not in a session' };
      }

      try {
        // Upload image to storage
        const fileId = nanoid();
        const extension = file.name.split('.').pop() || 'png';
        const storagePath = `${session.id}/${fileId}.${extension}`;

        const uploadResult = await uploadFile(STORAGE_BUCKETS.MAPS, storagePath, file);
        if ('error' in uploadResult) {
          return { success: false, error: uploadResult.error };
        }

        // Create map record
        const { data, error } = await supabase
          .from('maps')
          .insert({
            session_id: session.id,
            name,
            image_url: uploadResult.url,
            width,
            height,
            sort_order: maps.length,
          })
          .select()
          .single();

        if (error || !data) {
          // Cleanup uploaded file
          await deleteFile(STORAGE_BUCKETS.MAPS, storagePath);
          return { success: false, error: error?.message || 'Failed to create map' };
        }

        const newMap = dbMapToMap(data as DbMap);
        addMap(newMap);

        // If this is the first map, set it as active
        if (maps.length === 0) {
          await setMapActive(newMap.id);
        }

        return { success: true, map: newMap };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    },
    [session, maps, addMap]
  );

  /**
   * Add a map from a global asset (pre-existing URL)
   */
  const addMapFromGlobalAsset = useCallback(
    async (
      name: string,
      imageUrl: string,
      width: number,
      height: number
    ): Promise<{ success: boolean; map?: Map; error?: string }> => {
      if (!session) {
        return { success: false, error: 'Not in a session' };
      }

      try {
        // Create map record with existing URL
        const { data, error } = await supabase
          .from('maps')
          .insert({
            session_id: session.id,
            name,
            image_url: imageUrl,
            width,
            height,
            sort_order: maps.length,
          })
          .select()
          .single();

        if (error || !data) {
          return { success: false, error: error?.message || 'Failed to create map' };
        }

        const newMap = dbMapToMap(data as DbMap);
        addMap(newMap);

        // If this is the first map, set it as active
        if (maps.length === 0) {
          await setMapActive(newMap.id);
        }

        return { success: true, map: newMap };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    },
    [session, maps, addMap]
  );

  /**
   * Set a map as active
   */
  const setMapActive = useCallback(
    async (mapId: string): Promise<{ success: boolean; error?: string }> => {
      if (!session) {
        return { success: false, error: 'Not in a session' };
      }

      const map = maps.find((m) => m.id === mapId);
      if (!map) {
        return { success: false, error: 'Map not found' };
      }

      try {
        const { error } = await supabase
          .from('sessions')
          .update({ active_map_id: mapId })
          .eq('id', session.id);

        if (error) {
          return { success: false, error: error.message };
        }

        setActiveMap(map);
        await broadcastActiveMap({ sessionId: session.id, mapId });
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    },
    [session, maps, setActiveMap]
  );

  /**
   * Update map settings
   */
  const updateMapSettings = useCallback(
    async (
      mapId: string,
      settings: Partial<
        Pick<
          Map,
          | 'name'
          | 'gridEnabled'
          | 'gridOffsetX'
          | 'gridOffsetY'
          | 'gridCellSize'
          | 'gridColor'
          | 'fogEnabled'
          | 'fogDefaultState'
          | 'showPlayerTokens'
          | 'effectsEnabled'
        >
      >
    ): Promise<{ success: boolean; error?: string }> => {
      try {
        const dbSettings: Record<string, unknown> = {};
        if (settings.name !== undefined) dbSettings.name = settings.name;
        if (settings.gridEnabled !== undefined) dbSettings.grid_enabled = settings.gridEnabled;
        if (settings.gridOffsetX !== undefined) dbSettings.grid_offset_x = settings.gridOffsetX;
        if (settings.gridOffsetY !== undefined) dbSettings.grid_offset_y = settings.gridOffsetY;
        if (settings.gridCellSize !== undefined) dbSettings.grid_cell_size = settings.gridCellSize;
        if (settings.gridColor !== undefined) dbSettings.grid_color = settings.gridColor;
        if (settings.fogEnabled !== undefined) dbSettings.fog_enabled = settings.fogEnabled;
        if (settings.fogDefaultState !== undefined) dbSettings.fog_default_state = settings.fogDefaultState;
        if (settings.showPlayerTokens !== undefined) dbSettings.show_player_tokens = settings.showPlayerTokens;
        if (settings.effectsEnabled !== undefined) dbSettings.effects_enabled = settings.effectsEnabled;

        const { error } = await supabase
          .from('maps')
          .update(dbSettings)
          .eq('id', mapId);

        if (error) {
          return { success: false, error: error.message };
        }

        updateMap(mapId, settings);
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    },
    [updateMap]
  );

  /**
   * Update fog data
   */
  const updateFogData = useCallback(
    async (mapId: string, fogData: FogRegion[]): Promise<{ success: boolean; error?: string }> => {
      try {
        const { error } = await supabase
          .from('maps')
          .update({ fog_data: fogData })
          .eq('id', mapId);

        if (error) {
          return { success: false, error: error.message };
        }

        updateMap(mapId, { fogData });
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    },
    [updateMap]
  );

  /**
   * Update drawing data
   */
  const updateDrawingData = useCallback(
    async (
      mapId: string,
      drawingData: DrawingRegion[]
    ): Promise<{ success: boolean; error?: string }> => {
      try {
        const { error } = await supabase
          .from('maps')
          .update({ drawing_data: drawingData })
          .eq('id', mapId);

        if (error) {
          return { success: false, error: error.message };
        }

        updateMap(mapId, { drawingData });
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    },
    [updateMap]
  );

  /**
   * Update map effect tiles
   */
  const updateEffectData = useCallback(
    async (mapId: string, effectData: MapEffectTile[]): Promise<{ success: boolean; error?: string }> => {
      try {
        const { error } = await supabase
          .from('maps')
          .update({ effect_data: effectData })
          .eq('id', mapId);

        if (error) {
          return { success: false, error: error.message };
        }

        updateMap(mapId, { effectData });
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    },
    [updateMap]
  );

  /**
   * Delete a map
   */
  const deleteMap = useCallback(
    async (mapId: string): Promise<{ success: boolean; error?: string }> => {
      const map = maps.find((m) => m.id === mapId);
      if (!map) {
        return { success: false, error: 'Map not found' };
      }

      try {
        // Delete map record (cascade will handle NPCs)
        const { error } = await supabase.from('maps').delete().eq('id', mapId);

        if (error) {
          return { success: false, error: error.message };
        }

        // Delete storage file
        const storagePath = map.imageUrl.split('/').slice(-2).join('/');
        await deleteFile(STORAGE_BUCKETS.MAPS, storagePath);

        removeMap(mapId);

        // If this was the active map, clear active or set to first available
        if (activeMap?.id === mapId) {
          const remaining = maps.filter((m) => m.id !== mapId);
          if (remaining.length > 0) {
            await setMapActive(remaining[0].id);
          } else {
            setActiveMap(null);
          }
        }

        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    },
    [maps, activeMap, removeMap, setActiveMap, setMapActive]
  );

  return {
    maps,
    activeMap,
    uploadMap,
    addMapFromGlobalAsset,
    setMapActive,
    updateMapSettings,
    updateFogData,
    updateDrawingData,
    updateEffectData,
    deleteMap,
  };
};
