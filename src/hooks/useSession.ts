import { useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { generateSessionCode } from '../lib/sessionCode';
import { useSessionStore } from '../stores/sessionStore';
import { useMapStore } from '../stores/mapStore';
import { useChatStore } from '../stores/chatStore';
import { useInitiativeStore } from '../stores/initiativeStore';
import {
  dbSessionToSession,
  dbMapToMap,
  dbCharacterToCharacter,
  dbNPCTemplateToNPCTemplate,
  dbNPCInstanceToNPCInstance,
  dbSessionPlayerToSessionPlayer,
  dbChatMessageToChatMessage,
  dbDiceRollToDiceRoll,
  dbInitiativeEntryToInitiativeEntry,
  dbInitiativeRollLogToInitiativeRollLog,
  type DbSession,
  type DbMap,
  type DbCharacter,
  type DbNPCTemplate,
  type DbNPCInstance,
  type DbSessionPlayer,
  type DbChatMessage,
  type DbDiceRoll,
  type DbInitiativeEntry,
  type DbInitiativeRollLog,
  type Session,
} from '../types';

const inFlightSessionLoads = new Map<string, Promise<void>>();
const pendingSessionReloads = new Set<string>();

export const resetSessionLoadQueueForTests = () => {
  inFlightSessionLoads.clear();
  pendingSessionReloads.clear();
};

export const runDedupedSessionLoad = (
  key: string,
  loader: () => Promise<void>,
  options?: { rerunIfRequested?: boolean }
) => {
  const existingLoad = inFlightSessionLoads.get(key);
  if (existingLoad) {
    if (options?.rerunIfRequested) {
      pendingSessionReloads.add(key);
    }
    return existingLoad;
  }

  let loadPromise: Promise<void> = Promise.resolve();
  loadPromise = (async () => {
    try {
      await loader();
    } finally {
      if (inFlightSessionLoads.get(key) === loadPromise) {
        inFlightSessionLoads.delete(key);
      }

       if (pendingSessionReloads.delete(key)) {
        void runDedupedSessionLoad(key, loader, options);
      }
    }
  })();

  inFlightSessionLoads.set(key, loadPromise);
  return loadPromise;
};

const isMissingRelationError = (error: { code?: string; message?: string } | null) =>
  error?.code === '42P01' || error?.message?.toLowerCase().includes('does not exist');

const resolveSessionId = (explicitSessionId?: string | null) =>
  explicitSessionId ?? useSessionStore.getState().session?.id ?? null;

export const useSession = () => {
  const {
    session,
    currentUser,
    setSession,
    updateSession,
    setCurrentUser,
    setPlayers,
    clearSession,
  } = useSessionStore();

  const {
    setMaps,
    setActiveMap,
    setCharacters,
    setNPCTemplates,
    setNPCInstances,
    clearMapState,
  } = useMapStore();

  const { setMessages, setDiceRolls, clearChatState } = useChatStore();
  const { setEntries, setRollLogs, clearInitiativeState } = useInitiativeStore();

  const createSession = useCallback(
    async (
      sessionName: string,
      username: string,
      options?: { activateSession?: boolean }
    ): Promise<{
      success: boolean;
      code?: string;
      error?: string;
      session?: Session;
      currentUser?: { username: string; characterId: string | null; isGm: boolean };
    }> => {
      try {
        const activateSession = options?.activateSession ?? true;
        let code = generateSessionCode();
        let attempts = 0;
        while (attempts < 5) {
          const { data: existing } = await supabase
            .from('sessions')
            .select('id')
            .eq('code', code)
            .single();

          if (!existing) break;
          code = generateSessionCode();
          attempts++;
        }

        const { data: sessionData, error: sessionError } = await supabase
          .from('sessions')
          .insert({
            code,
            name: sessionName,
            current_gm_username: username,
          })
          .select()
          .single();

        if (sessionError || !sessionData) {
          return { success: false, error: sessionError?.message || 'Failed to create session' };
        }

        const newSession = dbSessionToSession(sessionData as DbSession);
        const newCurrentUser = { username, characterId: null, isGm: true };

        const { error: playerError } = await supabase.from('session_players').insert({
          session_id: newSession.id,
          username,
          is_gm: true,
        });

        if (playerError) {
          await supabase.from('sessions').delete().eq('id', newSession.id);
          return { success: false, error: playerError.message };
        }

        if (activateSession) {
          setSession(newSession);
          setCurrentUser(newCurrentUser);
        }

        return {
          success: true,
          code,
          session: newSession,
          currentUser: newCurrentUser,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    },
    [setSession, setCurrentUser]
  );

  const joinSession = useCallback(
    async (
      code: string,
      username: string,
      options?: { hydrateSession?: boolean }
    ): Promise<{ success: boolean; error?: string }> => {
      try {
        const hydrateSession = options?.hydrateSession ?? true;
        const { data: sessionData, error: sessionError } = await supabase
          .from('sessions')
          .select('*')
          .eq('code', code.toUpperCase())
          .single();

        if (sessionError || !sessionData) {
          return { success: false, error: 'Session not found' };
        }

        const joinedSession = dbSessionToSession(sessionData as DbSession);

        const { data: existingPlayer } = await supabase
          .from('session_players')
          .select('id, is_gm, character_id')
          .eq('session_id', joinedSession.id)
          .eq('username', username)
          .single();

        if (existingPlayer) {
          await supabase
            .from('session_players')
            .update({ last_seen: new Date().toISOString() })
            .eq('id', existingPlayer.id);
        } else {
          const { error: playerError } = await supabase
            .from('session_players')
            .insert({
              session_id: joinedSession.id,
              username,
              is_gm: false,
            });

          if (playerError) {
            return { success: false, error: playerError.message };
          }
        }

        setSession(joinedSession);
        const isGm = existingPlayer?.is_gm ?? joinedSession.currentGmUsername === username;
        setCurrentUser({
          username,
          characterId: existingPlayer?.character_id ?? null,
          isGm,
        });

        if (hydrateSession) {
          await loadSessionData(joinedSession.id);
        }

        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    },
    [setSession, setCurrentUser]
  );

  const loadSessionData = useCallback(
    async (sessionId: string) => {
      await runDedupedSessionLoad(`core:${sessionId}`, async () => {
        try {
          const { data: mapsData } = await supabase
            .from('maps')
            .select('*')
            .eq('session_id', sessionId)
            .order('sort_order', { ascending: true });

          const uploadedMaps = ((mapsData as DbMap[] | null) ?? []).map(dbMapToMap);
          setMaps(uploadedMaps);

          const { data: sessionData } = await supabase
            .from('sessions')
            .select('active_map_id')
            .eq('id', sessionId)
            .single();
          const uploadedActiveMapId = sessionData?.active_map_id ?? null;
          const uploadedActiveMap = uploadedActiveMapId
            ? uploadedMaps.find((map) => map.id === uploadedActiveMapId) ?? null
            : null;
          setActiveMap(uploadedActiveMap);

          const { data: charactersData } = await supabase
            .from('characters')
            .select('*')
            .eq('session_id', sessionId);

          if (charactersData) {
            setCharacters((charactersData as DbCharacter[]).map(dbCharacterToCharacter));
          }

          const uploadedMapIds = uploadedMaps.map((map) => map.id);
          if (uploadedMapIds.length > 0) {
            const { data: instancesData } = await supabase
              .from('npc_instances')
              .select('*')
              .in('map_id', uploadedMapIds);

            if (instancesData) {
              setNPCInstances((instancesData as DbNPCInstance[]).map(dbNPCInstanceToNPCInstance));
            }
          } else {
            setNPCInstances([]);
          }

          const { data: playersData } = await supabase
            .from('session_players')
            .select('*')
            .eq('session_id', sessionId);

          if (playersData) {
            setPlayers((playersData as DbSessionPlayer[]).map(dbSessionPlayerToSessionPlayer));
          }
        } catch (error) {
          console.error('Error loading session data:', error);
        }
      });
    },
    [setMaps, setActiveMap, setCharacters, setNPCInstances, setPlayers]
  );

  const loadNpcTemplateData = useCallback(
    async (explicitSessionId?: string) => {
      const sessionId = resolveSessionId(explicitSessionId);
      if (!sessionId) {
        return;
      }

      await runDedupedSessionLoad(`npc_templates:${sessionId}`, async () => {
        try {
          const { data: templatesData } = await supabase
            .from('npc_templates')
            .select('*')
            .eq('session_id', sessionId);

          if (templatesData) {
            setNPCTemplates((templatesData as DbNPCTemplate[]).map(dbNPCTemplateToNPCTemplate));
          }
        } catch (error) {
          console.error('Error loading NPC template data:', error);
        }
      });
    },
    [setNPCTemplates]
  );

  const loadChatData = useCallback(
    async (explicitSessionId?: string) => {
      const sessionId = resolveSessionId(explicitSessionId);
      if (!sessionId) {
        return;
      }

      await runDedupedSessionLoad(`chat:${sessionId}`, async () => {
        try {
          const [messagesResult, rollsResult] = await Promise.all([
            supabase
              .from('chat_messages')
              .select('*')
              .eq('session_id', sessionId)
              .order('created_at', { ascending: false })
              .limit(100),
            supabase
              .from('dice_rolls')
              .select('*')
              .eq('session_id', sessionId)
              .order('created_at', { ascending: false })
              .limit(50),
          ]);

          if (messagesResult.data) {
            setMessages(
              (messagesResult.data as DbChatMessage[]).map(dbChatMessageToChatMessage).reverse()
            );
          }

          if (rollsResult.data) {
            setDiceRolls((rollsResult.data as DbDiceRoll[]).map(dbDiceRollToDiceRoll).reverse());
          }
        } catch (error) {
          console.error('Error loading chat data:', error);
        }
      });
    },
    [setMessages, setDiceRolls]
  );

  const loadInitiativeData = useCallback(
    async (explicitSessionId?: string) => {
      const sessionId = resolveSessionId(explicitSessionId);
      if (!sessionId) {
        return;
      }

      await runDedupedSessionLoad(`initiative:${sessionId}`, async () => {
        try {
          const [initiativeResult, initiativeLogsResult] = await Promise.all([
            supabase
              .from('initiative_entries')
              .select('*')
              .eq('session_id', sessionId)
              .order('created_at', { ascending: true }),
            supabase
              .from('initiative_roll_logs')
              .select('*')
              .eq('session_id', sessionId)
              .order('created_at', { ascending: false })
              .limit(200),
          ]);

          if (!isMissingRelationError(initiativeResult.error) && initiativeResult.data) {
            setEntries(
              (initiativeResult.data as DbInitiativeEntry[]).map(dbInitiativeEntryToInitiativeEntry)
            );
          }

          if (!isMissingRelationError(initiativeLogsResult.error) && initiativeLogsResult.data) {
            setRollLogs(
              (initiativeLogsResult.data as DbInitiativeRollLog[]).map(
                dbInitiativeRollLogToInitiativeRollLog
              )
            );
          }

          if (
            isMissingRelationError(initiativeResult.error) ||
            isMissingRelationError(initiativeLogsResult.error)
          ) {
            console.warn('Initiative tables are not available yet; skipping initiative hydration.');
          }
        } catch (error) {
          console.error('Error loading initiative data:', error);
        }
      });
    },
    [setEntries, setRollLogs]
  );

  const claimGM = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
    if (!session || !currentUser) {
      return { success: false, error: 'Not in a session' };
    }

    try {
      const { error } = await supabase
        .from('sessions')
        .update({ current_gm_username: currentUser.username })
        .eq('id', session.id);

      if (error) {
        return { success: false, error: error.message };
      }

      await supabase
        .from('session_players')
        .update({ is_gm: true })
        .eq('session_id', session.id)
        .eq('username', currentUser.username);

      updateSession({ currentGmUsername: currentUser.username });
      setCurrentUser({ ...currentUser, isGm: true });

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }, [session, currentUser, updateSession, setCurrentUser]);

  const releaseGM = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
    if (!session || !currentUser) {
      return { success: false, error: 'Not in a session' };
    }

    try {
      const { data, error } = await supabase
        .from('sessions')
        .update({ current_gm_username: null })
        .eq('id', session.id)
        .eq('current_gm_username', currentUser.username)
        .select();

      if (error) {
        return { success: false, error: error.message };
      }

      await supabase
        .from('session_players')
        .update({ is_gm: false })
        .eq('session_id', session.id)
        .eq('username', currentUser.username);

      if (data && data.length > 0) {
        updateSession({ currentGmUsername: null });
      }
      setCurrentUser({ ...currentUser, isGm: false });

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }, [session, currentUser, updateSession, setCurrentUser]);

  const leaveSession = useCallback(async () => {
    if (session && currentUser) {
      await supabase
        .from('session_players')
        .delete()
        .eq('session_id', session.id)
        .eq('username', currentUser.username);

      if (currentUser.isGm) {
        await supabase
          .from('sessions')
          .update({ current_gm_username: null })
          .eq('id', session.id);
      }

      await supabase
        .from('characters')
        .update({ is_claimed: false, claimed_by_username: null })
        .eq('session_id', session.id)
        .eq('claimed_by_username', currentUser.username);
    }

    clearSession();
    clearMapState();
    clearChatState();
    clearInitiativeState();
  }, [session, currentUser, clearSession, clearMapState, clearChatState, clearInitiativeState]);

  const updateNotepad = useCallback(
    async (content: string) => {
      if (!session) return;

      await supabase
        .from('sessions')
        .update({ notepad_content: content })
        .eq('id', session.id);

      updateSession({ notepadContent: content });
    },
    [session, updateSession]
  );

  const updateSessionSettings = useCallback(
    async (
      settings: Partial<
        Pick<
          Session,
          | 'allowPlayersRenameNpcs'
          | 'allowPlayersRenamePcs'
          | 'allowPlayersMoveNpcs'
          | 'enableInitiativePhase'
          | 'enablePlotDice'
          | 'allowPlayersDrawings'
        >
      >
    ) => {
      if (!session) return { success: false, error: 'Not in a session' };

      try {
        const dbUpdates: Record<string, unknown> = {};
        if (settings.allowPlayersRenameNpcs !== undefined) {
          dbUpdates.allow_players_rename_npcs = settings.allowPlayersRenameNpcs;
        }
        if (settings.allowPlayersRenamePcs !== undefined) {
          dbUpdates.allow_players_rename_pcs = settings.allowPlayersRenamePcs;
        }
        if (settings.allowPlayersMoveNpcs !== undefined) {
          dbUpdates.allow_players_move_npcs = settings.allowPlayersMoveNpcs;
        }

        if (settings.enableInitiativePhase !== undefined) {
          dbUpdates.enable_initiative_phase = settings.enableInitiativePhase;
        }
        if (settings.enablePlotDice !== undefined) {
          dbUpdates.enable_plot_dice = settings.enablePlotDice;
        }
        if (settings.allowPlayersDrawings !== undefined) {
          dbUpdates.allow_players_drawings = settings.allowPlayersDrawings;
        }

        const { error } = await supabase.from('sessions').update(dbUpdates).eq('id', session.id);
        if (error) return { success: false, error: error.message };

        updateSession(settings);
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    },
    [session, updateSession]
  );

  return {
    session,
    currentUser,
    createSession,
    joinSession,
    loadSessionData,
    loadNpcTemplateData,
    loadChatData,
    loadInitiativeData,
    claimGM,
    releaseGM,
    leaveSession,
    updateNotepad,
    updateSessionSettings,
  };
};
