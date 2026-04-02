import { useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useSessionStore } from '../stores/sessionStore';
import { useMapStore } from '../stores/mapStore';
import { useInitiativeStore } from '../stores/initiativeStore';
import type { InitiativePhase, InitiativeVisibility } from '../types';

interface RollSource {
  sourceType: 'player' | 'npc';
  sourceId: string | null;
  sourceName: string;
}

const PLAYER_REROLL_BLOCK_MESSAGE =
  'You are already in the initiative order. Ask the GM to remove you before rolling again.';

export const useInitiative = () => {
  const session = useSessionStore((state) => state.session);
  const currentUser = useSessionStore((state) => state.currentUser);
  const players = useSessionStore((state) => state.players);
  const characters = useMapStore((state) => state.characters);
  const activeMap = useMapStore((state) => state.activeMap);
  const npcInstances = useMapStore((state) => state.npcInstances);
  const entries = useInitiativeStore((state) => state.entries);
  const rollLogs = useInitiativeStore((state) => state.rollLogs);
  const setEntries = useInitiativeStore((state) => state.setEntries);

  const visibleEntries = useMemo(() => {
    if (currentUser?.isGm) return entries;
    return entries.filter((entry) => entry.visibility === 'public');
  }, [entries, currentUser?.isGm]);

  const visibleLogs = useMemo(() => {
    if (currentUser?.isGm) return rollLogs;
    return rollLogs.filter((log) => log.visibility === 'public');
  }, [rollLogs, currentUser?.isGm]);

  const currentCharacter = useMemo(
    () => characters.find((character) => character.claimedByUsername === currentUser?.username) ?? null,
    [characters, currentUser?.username]
  );

  const hasCurrentPlayerEntry = useMemo(() => {
    if (!currentUser) return false;

    return entries.some((entry) => {
      if (entry.sourceType !== 'player') {
        return false;
      }

      if (currentCharacter?.id && entry.sourceId === currentCharacter.id) {
        return true;
      }

      return entry.sourceId === null && entry.sourceName === currentUser.username;
    });
  }, [entries, currentUser, currentCharacter?.id]);

  const findExistingEntryId = useCallback(
    async (source: RollSource) => {
      if (!session) return null;

      if (source.sourceId) {
        const { data: existing } = await supabase
          .from('initiative_entries')
          .select('id')
          .eq('session_id', session.id)
          .eq('source_type', source.sourceType)
          .eq('source_id', source.sourceId)
          .maybeSingle();

        return existing?.id ?? null;
      }

      const { data: existing } = await supabase
        .from('initiative_entries')
        .select('id')
        .eq('session_id', session.id)
        .eq('source_type', source.sourceType)
        .is('source_id', null)
        .eq('source_name', source.sourceName)
        .maybeSingle();

      return existing?.id ?? null;
    },
    [session]
  );

  const upsertRollForSource = useCallback(
    async (
      source: RollSource,
      phase: InitiativePhase,
      visibility: InitiativeVisibility,
      modifier: number,
      rollValue: number
    ) => {
      if (!session || !currentUser) return { success: false as const, error: 'No session' };

      const total = rollValue + modifier;

      let existingEntryId = await findExistingEntryId(source);

      if (existingEntryId) {
        const { error } = await supabase
          .from('initiative_entries')
          .update({
            source_name: source.sourceName,
            rolled_by_username: currentUser.username,
            modifier,
            roll_value: rollValue,
            total,
            phase,
            visibility,
            is_manual_override: false,
          })
          .eq('id', existingEntryId);

        if (error) return { success: false as const, error: error.message };
      } else {
        const { data, error } = await supabase
          .from('initiative_entries')
          .insert({
            session_id: session.id,
            source_type: source.sourceType,
            source_id: source.sourceId,
            source_name: source.sourceName,
            rolled_by_username: currentUser.username,
            modifier,
            roll_value: rollValue,
            total,
            phase,
            visibility,
          })
          .select('id')
          .single();

        if (error) return { success: false as const, error: error.message };
        existingEntryId = data?.id ?? null;
      }

      const { error: logError } = await supabase.from('initiative_roll_logs').insert({
        session_id: session.id,
        source_type: source.sourceType,
        source_id: source.sourceId,
        source_name: source.sourceName,
        rolled_by_username: currentUser.username,
        phase,
        visibility,
        modifier,
        roll_value: rollValue,
        total,
        entry_id: existingEntryId,
      });

      if (logError) return { success: false as const, error: logError.message };
      return { success: true as const, rollValue, total };
    },
    [session, currentUser]
  );

  const setMyModifier = useCallback(
    async (modifier: number) => {
      if (!session || !currentUser) return { success: false, error: 'No session' };

      const player = players.find((p) => p.username === currentUser.username);
      if (!player) return { success: false, error: 'Player not found' };

      const { error } = await supabase
        .from('session_players')
        .update({ initiative_modifier: modifier })
        .eq('id', player.id);

      if (error) return { success: false, error: error.message };
      return { success: true };
    },
    [session, currentUser, players]
  );

  const addPlayerInitiative = useCallback(
    async (phase: InitiativePhase, visibility: InitiativeVisibility) => {
      if (!session || !currentUser) return { success: false, error: 'No session' };

      const player = players.find((p) => p.username === currentUser.username);
      const modifier = player?.initiativeModifier ?? 0;
      const source = {
        sourceType: 'player' as const,
        sourceId: currentCharacter?.id || null,
        sourceName: currentCharacter?.name || currentUser.username,
      };
      const existingEntryId = await findExistingEntryId(source);

      if (existingEntryId) {
        return { success: false, error: PLAYER_REROLL_BLOCK_MESSAGE };
      }

      const rollValue = Math.floor(Math.random() * 20) + 1;

      return upsertRollForSource(
        source,
        phase,
        visibility,
        modifier,
        rollValue
      );
    },
    [session, currentUser, players, currentCharacter, findExistingEntryId, upsertRollForSource]
  );

  const addNpcInitiative = useCallback(
    async (
      npcIds: string[],
      phase: InitiativePhase,
      visibility: InitiativeVisibility,
      modifier: number
    ) => {
      if (!session || !currentUser?.isGm) return { success: false, error: 'GM only' };

      const npcs = npcIds
        .map((id) => npcInstances.find((npc) => npc.id === id))
        .filter((npc): npc is NonNullable<typeof npc> => Boolean(npc));

      if (npcs.length === 0) return { success: false, error: 'No NPCs selected' };

      for (const npc of npcs) {
        const rollValue = Math.floor(Math.random() * 20) + 1;
        const result = await upsertRollForSource(
          {
            sourceType: 'npc',
            sourceId: npc.id,
            sourceName: npc.displayName || 'NPC',
          },
          phase,
          visibility,
          modifier,
          rollValue
        );

        if (!result.success) return result;
      }

      return { success: true };
    },
    [session, currentUser, npcInstances, upsertRollForSource]
  );

  const updateEntry = useCallback(
    async (
      id: string,
      updates: Partial<{ total: number; phase: InitiativePhase; visibility: InitiativeVisibility }>
    ) => {
      if (!currentUser?.isGm) return { success: false, error: 'GM only' };
      const dbUpdates: Record<string, unknown> = { is_manual_override: true };
      if (updates.total !== undefined) dbUpdates.total = updates.total;
      if (updates.phase !== undefined) dbUpdates.phase = updates.phase;
      if (updates.visibility !== undefined) dbUpdates.visibility = updates.visibility;

      const { error } = await supabase.from('initiative_entries').update(dbUpdates).eq('id', id);
      if (error) return { success: false, error: error.message };
      return { success: true };
    },
    [currentUser?.isGm]
  );

  const clearTracker = useCallback(async () => {
    if (!session || !currentUser?.isGm) return { success: false, error: 'GM only' };
    const { error } = await supabase.from('initiative_entries').delete().eq('session_id', session.id);
    if (error) return { success: false, error: error.message };

    // Keep UI in sync even if realtime delivery lags or is unavailable.
    setEntries([]);
    return { success: true };
  }, [session, currentUser?.isGm, setEntries]);

  const deleteEntry = useCallback(
    async (id: string) => {
      if (!currentUser?.isGm) return { success: false, error: 'GM only' };
      const { error } = await supabase.from('initiative_entries').delete().eq('id', id);
      if (error) return { success: false, error: error.message };
      return { success: true };
    },
    [currentUser?.isGm]
  );

  const currentMapNpcs = useMemo(() => {
    if (!activeMap) return [];
    return npcInstances.filter((npc) => npc.mapId === activeMap.id);
  }, [npcInstances, activeMap]);

  return {
    entries: visibleEntries,
    allEntries: entries,
    rollLogs: visibleLogs,
    currentMapNpcs,
    hasCurrentPlayerEntry,
    setMyModifier,
    addPlayerInitiative,
    addNpcInitiative,
    updateEntry,
    deleteEntry,
    clearTracker,
  };
};
