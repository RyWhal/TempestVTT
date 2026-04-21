import { useCallback } from 'react';
import { supabase, uploadFile, deleteFile, STORAGE_BUCKETS } from '../lib/supabase';
import { useSessionStore } from '../stores/sessionStore';
import { useMapStore } from '../stores/mapStore';
import { useInitiativeStore } from '../stores/initiativeStore';
import {
  dbNPCTemplateToNPCTemplate,
  dbNPCInstanceToNPCInstance,
  type DbNPCTemplate,
  type DbNPCInstance,
  type NPCTemplate,
  type NPCInstance,
  type TokenSize,
} from '../types';
import { nanoid } from 'nanoid';
import { broadcastTokenMove } from '../lib/tokenBroadcast';

export const useNPCs = () => {
  const session = useSessionStore((state) => state.session);
  const activeMap = useMapStore((state) => state.activeMap);
  const {
    npcTemplates,
    npcInstances,
    addNPCTemplate,
    updateNPCTemplate,
    removeNPCTemplate,
    addNPCInstance,
    updateNPCInstance,
    removeNPCInstance,
    moveNPCInstance,
  } = useMapStore();
  const renameInitiativeSource = useInitiativeStore((state) => state.renameSource);

  /**
   * Create an NPC template
   */
  const createNPCTemplate = useCallback(
    async (
      name: string,
      defaultSize: TokenSize,
      tokenFile?: File,
      notes?: string,
      existingTokenUrl?: string // For using global asset URLs
    ): Promise<{ success: boolean; template?: NPCTemplate; error?: string }> => {
      if (!session) {
        return { success: false, error: 'Not in a session' };
      }

      try {
        let tokenUrl: string | null = existingTokenUrl || null;

        // Upload token if provided (only if no existing URL given)
        if (tokenFile && !existingTokenUrl) {
          const fileId = nanoid();
          const extension = tokenFile.name.split('.').pop() || 'png';
          const storagePath = `npcs/${session.id}/${fileId}.${extension}`;

          const uploadResult = await uploadFile(STORAGE_BUCKETS.TOKENS, storagePath, tokenFile);
          if ('error' in uploadResult) {
            return { success: false, error: uploadResult.error };
          }
          tokenUrl = uploadResult.url;
        }

        // Create template record
        const { data, error } = await supabase
          .from('npc_templates')
          .insert({
            session_id: session.id,
            name,
            default_size: defaultSize,
            token_url: tokenUrl,
            notes: notes || '',
          })
          .select()
          .single();

        if (error || !data) {
          return { success: false, error: error?.message || 'Failed to create NPC template' };
        }

        const newTemplate = dbNPCTemplateToNPCTemplate(data as DbNPCTemplate);
        addNPCTemplate(newTemplate);

        return { success: true, template: newTemplate };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    },
    [session, addNPCTemplate]
  );

  /**
   * Update an NPC template
   */
  const updateNPCTemplateDetails = useCallback(
    async (
      templateId: string,
      updates: Partial<Pick<NPCTemplate, 'name' | 'defaultSize' | 'notes'>>
    ): Promise<{ success: boolean; error?: string }> => {
      try {
        const dbUpdates: Record<string, unknown> = {};
        if (updates.name !== undefined) dbUpdates.name = updates.name;
        if (updates.defaultSize !== undefined) dbUpdates.default_size = updates.defaultSize;
        if (updates.notes !== undefined) dbUpdates.notes = updates.notes;

        const { error } = await supabase
          .from('npc_templates')
          .update(dbUpdates)
          .eq('id', templateId);

        if (error) {
          return { success: false, error: error.message };
        }

        updateNPCTemplate(templateId, updates);
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    },
    [updateNPCTemplate]
  );

  /**
   * Delete an NPC template
   */
  const deleteNPCTemplate = useCallback(
    async (templateId: string): Promise<{ success: boolean; error?: string }> => {
      const template = npcTemplates.find((t) => t.id === templateId);
      if (!template) {
        return { success: false, error: 'Template not found' };
      }

      try {
        const { error } = await supabase
          .from('npc_templates')
          .delete()
          .eq('id', templateId);

        if (error) {
          return { success: false, error: error.message };
        }

        // Delete token if exists
        if (template.tokenUrl) {
          const storagePath = template.tokenUrl.split('/').slice(-3).join('/');
          await deleteFile(STORAGE_BUCKETS.TOKENS, storagePath);
        }

        removeNPCTemplate(templateId);
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    },
    [npcTemplates, removeNPCTemplate]
  );

  /**
   * Add NPC instance to current map from template
   */
  const addNPCToMap = useCallback(
    async (
      templateId: string,
      position?: { x: number; y: number },
      customName?: string
    ): Promise<{ success: boolean; instance?: NPCInstance; error?: string }> => {
      if (!session) {
        return { success: false, error: 'Not in a session' };
      }

      if (!activeMap) {
        return { success: false, error: 'No active map' };
      }

      const template = npcTemplates.find((t) => t.id === templateId);
      if (!template) {
        return { success: false, error: 'Template not found' };
      }

      try {
        // Count existing instances of this template to auto-name
        const existingCount = npcInstances.filter(
          (i) => i.templateId === templateId && i.mapId === activeMap.id
        ).length;

        const displayName = customName || `${template.name}-${existingCount + 1}`;

        const { data, error } = await supabase
          .from('npc_instances')
          .insert({
            session_id: session.id,
            map_id: activeMap.id,
            template_id: templateId,
            display_name: displayName,
            token_url: template.tokenUrl,
            size: template.defaultSize,
            position_x: position?.x ?? activeMap.width / 2,
            position_y: position?.y ?? activeMap.height / 2,
            is_visible: false,
          })
          .select()
          .single();

        if (error || !data) {
          return { success: false, error: error?.message || 'Failed to add NPC' };
        }

        const newInstance = dbNPCInstanceToNPCInstance(data as DbNPCInstance);
        addNPCInstance(newInstance);

        return { success: true, instance: newInstance };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    },
    [session, activeMap, npcTemplates, npcInstances, addNPCInstance]
  );

  /**
   * Update NPC instance
   */
  const updateNPCInstanceDetails = useCallback(
    async (
      instanceId: string,
      updates: Partial<Pick<NPCInstance, 'displayName' | 'size' | 'isVisible' | 'notes' | 'statusRingColor'>>
    ): Promise<{ success: boolean; error?: string }> => {
      try {
        const dbUpdates: Record<string, unknown> = {};
        if (updates.displayName !== undefined) dbUpdates.display_name = updates.displayName;
        if (updates.size !== undefined) dbUpdates.size = updates.size;
        if (updates.isVisible !== undefined) dbUpdates.is_visible = updates.isVisible;
        if (updates.notes !== undefined) dbUpdates.notes = updates.notes;
        if (updates.statusRingColor !== undefined) dbUpdates.status_ring_color = updates.statusRingColor;

        const { error } = await supabase
          .from('npc_instances')
          .update(dbUpdates)
          .eq('id', instanceId);

        if (error) {
          return { success: false, error: error.message };
        }

        let initiativeErrorMessage: string | null = null;
        if (updates.displayName !== undefined) {
          const nextDisplayName = updates.displayName ?? 'NPC';
          const [entriesResult, logsResult] = await Promise.all([
            supabase
              .from('initiative_entries')
              .update({ source_name: nextDisplayName })
              .eq('source_type', 'npc')
              .eq('source_id', instanceId),
            supabase
              .from('initiative_roll_logs')
              .update({ source_name: nextDisplayName })
              .eq('source_type', 'npc')
              .eq('source_id', instanceId),
          ]);

          if (entriesResult.error || logsResult.error) {
            initiativeErrorMessage =
              entriesResult.error?.message || logsResult.error?.message || null;
          } else {
            renameInitiativeSource('npc', instanceId, nextDisplayName);
          }
        }

        updateNPCInstance(instanceId, updates);

        if (initiativeErrorMessage) {
          return { success: false, error: initiativeErrorMessage };
        }

        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    },
    [renameInitiativeSource, updateNPCInstance]
  );

  /**
   * Toggle NPC visibility
   */
  const toggleNPCVisibility = useCallback(
    async (instanceId: string): Promise<{ success: boolean; error?: string }> => {
      const instance = npcInstances.find((i) => i.id === instanceId);
      if (!instance) {
        return { success: false, error: 'NPC not found' };
      }

      return updateNPCInstanceDetails(instanceId, { isVisible: !instance.isVisible });
    },
    [npcInstances, updateNPCInstanceDetails]
  );

  /**
   * Move NPC position
   */
  const moveNPCPosition = useCallback(
    async (
      instanceId: string,
      x: number,
      y: number
    ): Promise<{ success: boolean; error?: string }> => {
      if (!session) {
        return { success: false, error: 'Not in a session' };
      }

      // Optimistic update
      const instance = npcInstances.find((i) => i.id === instanceId);
      moveNPCInstance(instanceId, x, y, instance?.mapId);

      try {
        const { error } = await supabase
          .from('npc_instances')
          .update({ position_x: x, position_y: y })
          .eq('id', instanceId);

        if (error) {
          // Revert on error
          const original = npcInstances.find((i) => i.id === instanceId);
          if (original) {
            moveNPCInstance(instanceId, original.positionX, original.positionY, original.mapId);
          }
          return { success: false, error: error.message };
        }

        await broadcastTokenMove({
          sessionId: session.id,
          tokenId: instanceId,
          tokenType: 'npc',
          mapId: instance?.mapId,
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
    [session, npcInstances, moveNPCInstance]
  );

  /**
   * Remove NPC from map
   */
  const removeNPCFromMap = useCallback(
    async (instanceId: string): Promise<{ success: boolean; error?: string }> => {
      try {
        const { error } = await supabase
          .from('npc_instances')
          .delete()
          .eq('id', instanceId);

        if (error) {
          return { success: false, error: error.message };
        }

        removeNPCInstance(instanceId);
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    },
    [removeNPCInstance]
  );

  // Get NPCs on current map
  const currentMapNPCs = activeMap
    ? npcInstances.filter((i) => i.mapId === activeMap.id)
    : [];

  return {
    npcTemplates,
    npcInstances,
    currentMapNPCs,
    createNPCTemplate,
    updateNPCTemplateDetails,
    deleteNPCTemplate,
    addNPCToMap,
    updateNPCInstanceDetails,
    toggleNPCVisibility,
    moveNPCPosition,
    removeNPCFromMap,
  };
};
