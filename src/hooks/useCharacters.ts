import { useCallback } from 'react';
import { supabase, uploadFile, deleteFile, STORAGE_BUCKETS } from '../lib/supabase';
import { useSessionStore } from '../stores/sessionStore';
import { useMapStore } from '../stores/mapStore';
import { dbCharacterToCharacter, type DbCharacter, type Character, type InventoryItem } from '../types';
import { nanoid } from 'nanoid';
import { broadcastTokenMove } from '../lib/tokenBroadcast';

export const useCharacters = () => {
  const session = useSessionStore((state) => state.session);
  const currentUser = useSessionStore((state) => state.currentUser);
  const activeMap = useMapStore((state) => state.activeMap);
  const { characters, addCharacter, updateCharacter, removeCharacter, moveCharacter } = useMapStore();

  /**
   * Create a new character
   */
  const createCharacter = useCallback(
    async (
      name: string,
      tokenFile?: File
    ): Promise<{ success: boolean; character?: Character; error?: string }> => {
      if (!session) {
        return { success: false, error: 'Not in a session' };
      }

      try {
        let tokenUrl: string | null = null;

        // Upload token if provided
        if (tokenFile) {
          const fileId = nanoid();
          const extension = tokenFile.name.split('.').pop() || 'png';
          const storagePath = `characters/${session.id}/${fileId}.${extension}`;

          const uploadResult = await uploadFile(STORAGE_BUCKETS.TOKENS, storagePath, tokenFile);
          if ('error' in uploadResult) {
            return { success: false, error: uploadResult.error };
          }
          tokenUrl = uploadResult.url;
        }

        // Create character record
        const { data, error } = await supabase
          .from('characters')
          .insert({
            session_id: session.id,
            name,
            token_url: tokenUrl,
            size: 'medium',
          })
          .select()
          .single();

        if (error || !data) {
          return { success: false, error: error?.message || 'Failed to create character' };
        }

        const newCharacter = dbCharacterToCharacter(data as DbCharacter);
        addCharacter(newCharacter);

        return { success: true, character: newCharacter };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    },
    [session, addCharacter]
  );

  /**
   * Update character details
   */
  const updateCharacterDetails = useCallback(
    async (
      characterId: string,
      updates: Partial<Pick<Character, 'name' | 'notes' | 'size' | 'statusRingColor'>>
    ): Promise<{ success: boolean; error?: string }> => {
      try {
        const dbUpdates: Record<string, unknown> = {};
        if (updates.name !== undefined) dbUpdates.name = updates.name;
        if (updates.notes !== undefined) dbUpdates.notes = updates.notes;
        if (updates.size !== undefined) dbUpdates.size = updates.size;
        if (updates.statusRingColor !== undefined) {
          dbUpdates.status_ring_color = updates.statusRingColor;
        }

        const { error } = await supabase
          .from('characters')
          .update(dbUpdates)
          .eq('id', characterId);

        if (error) {
          return { success: false, error: error.message };
        }

        updateCharacter(characterId, updates);
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    },
    [updateCharacter]
  );

  /**
   * Update character token
   */
  const updateCharacterToken = useCallback(
    async (
      characterId: string,
      tokenFile: File
    ): Promise<{ success: boolean; error?: string }> => {
      if (!session) {
        return { success: false, error: 'Not in a session' };
      }

      try {
        const fileId = nanoid();
        const extension = tokenFile.name.split('.').pop() || 'png';
        const storagePath = `characters/${session.id}/${fileId}.${extension}`;

        const uploadResult = await uploadFile(STORAGE_BUCKETS.TOKENS, storagePath, tokenFile);
        if ('error' in uploadResult) {
          return { success: false, error: uploadResult.error };
        }

        const { error } = await supabase
          .from('characters')
          .update({ token_url: uploadResult.url })
          .eq('id', characterId);

        if (error) {
          return { success: false, error: error.message };
        }

        updateCharacter(characterId, { tokenUrl: uploadResult.url });
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    },
    [session, updateCharacter]
  );

  /**
   * Claim a character
   */
  const claimCharacter = useCallback(
    async (characterId: string): Promise<{ success: boolean; error?: string }> => {
      if (!currentUser) {
        return { success: false, error: 'Not logged in' };
      }

      try {
        const { error } = await supabase
          .from('characters')
          .update({
            is_claimed: true,
            claimed_by_username: currentUser.username,
          })
          .eq('id', characterId);

        if (error) {
          return { success: false, error: error.message };
        }

        updateCharacter(characterId, {
          isClaimed: true,
          claimedByUsername: currentUser.username,
        });

        // Update session player record
        const sessionStore = useSessionStore.getState();
        if (sessionStore.session) {
          await supabase
            .from('session_players')
            .update({ character_id: characterId })
            .eq('session_id', sessionStore.session.id)
            .eq('username', currentUser.username);
        }

        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    },
    [currentUser, updateCharacter]
  );

  /**
   * Release a character
   */
  const releaseCharacter = useCallback(
    async (characterId: string): Promise<{ success: boolean; error?: string }> => {
      try {
        const { error } = await supabase
          .from('characters')
          .update({
            is_claimed: false,
            claimed_by_username: null,
          })
          .eq('id', characterId);

        if (error) {
          return { success: false, error: error.message };
        }

        updateCharacter(characterId, {
          isClaimed: false,
          claimedByUsername: null,
        });

        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    },
    [updateCharacter]
  );

  /**
   * Move character position
   */
  const moveCharacterPosition = useCallback(
    async (
      characterId: string,
      x: number,
      y: number
    ): Promise<{ success: boolean; error?: string }> => {
      if (!session) {
        return { success: false, error: 'Not in a session' };
      }

      // Optimistic update
      moveCharacter(characterId, x, y, activeMap?.id);

      try {
        const { error } = await supabase
          .from('characters')
          .update({ position_x: x, position_y: y })
          .eq('id', characterId);

        if (error) {
          // Revert on error
          const original = characters.find((c) => c.id === characterId);
          if (original) {
            moveCharacter(characterId, original.positionX, original.positionY, activeMap?.id);
          }
          return { success: false, error: error.message };
        }

        await broadcastTokenMove({
          sessionId: session.id,
          tokenId: characterId,
          tokenType: 'character',
          mapId: activeMap?.id,
          x,
          y,
        });

        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    },
    [session, characters, moveCharacter, activeMap?.id]
  );

  /**
   * Update character inventory
   */
  const updateInventory = useCallback(
    async (
      characterId: string,
      inventory: InventoryItem[]
    ): Promise<{ success: boolean; error?: string }> => {
      try {
        const { error } = await supabase
          .from('characters')
          .update({ inventory })
          .eq('id', characterId);

        if (error) {
          return { success: false, error: error.message };
        }

        updateCharacter(characterId, { inventory });
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    },
    [updateCharacter]
  );

  /**
   * Delete a character
   */
  const deleteCharacter = useCallback(
    async (characterId: string): Promise<{ success: boolean; error?: string }> => {
      const character = characters.find((c) => c.id === characterId);
      if (!character) {
        return { success: false, error: 'Character not found' };
      }

      try {
        const { error } = await supabase.from('characters').delete().eq('id', characterId);

        if (error) {
          return { success: false, error: error.message };
        }

        // Delete token if exists
        if (character.tokenUrl) {
          const storagePath = character.tokenUrl.split('/').slice(-3).join('/');
          await deleteFile(STORAGE_BUCKETS.TOKENS, storagePath);
        }

        removeCharacter(characterId);
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    },
    [characters, removeCharacter]
  );

  // Get character for current user
  const myCharacter = characters.find(
    (c) => c.claimedByUsername === currentUser?.username
  );

  return {
    characters,
    myCharacter,
    createCharacter,
    updateCharacterDetails,
    updateCharacterToken,
    claimCharacter,
    releaseCharacter,
    moveCharacterPosition,
    updateInventory,
    deleteCharacter,
  };
};
