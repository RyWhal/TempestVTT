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
  dbHandoutToHandout,
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
  type DbHandout,
  type DbSessionPlayer,
  type DbChatMessage,
  type DbDiceRoll,
  type DbInitiativeEntry,
  type DbInitiativeRollLog,
  type Session,
} from '../types';


const isMissingRelationError = (error: { code?: string; message?: string } | null) =>
  error?.code === '42P01' || error?.message?.toLowerCase().includes('does not exist');

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
    setHandouts,
    clearMapState,
  } = useMapStore();

  const { setMessages, setDiceRolls, clearChatState } = useChatStore();
  const { setEntries, setRollLogs, clearInitiativeState } = useInitiativeStore();

  const createSession = useCallback(
    async (
      sessionName: string,
      username: string
    ): Promise<{ success: boolean; code?: string; error?: string }> => {
      try {
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

        const { error: playerError } = await supabase.from('session_players').insert({
          session_id: newSession.id,
          username,
          is_gm: true,
        });

        if (playerError) {
          await supabase.from('sessions').delete().eq('id', newSession.id);
          return { success: false, error: playerError.message };
        }

        setSession(newSession);
        setCurrentUser({ username, characterId: null, isGm: true });

        return { success: true, code };
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
      username: string
    ): Promise<{ success: boolean; error?: string }> => {
      try {
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

        await loadSessionData(joinedSession.id);

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
      try {
        const { data: mapsData } = await supabase
          .from('maps')
          .select('*')
          .eq('session_id', sessionId)
          .order('sort_order', { ascending: true });

        if (mapsData) {
          const maps = (mapsData as DbMap[]).map(dbMapToMap);
          setMaps(maps);

          const { data: sessionData } = await supabase
            .from('sessions')
            .select('active_map_id')
            .eq('id', sessionId)
            .single();

          if (sessionData?.active_map_id) {
            const activeMap = maps.find((m) => m.id === sessionData.active_map_id);
            if (activeMap) setActiveMap(activeMap);
          }
        }

        const { data: charactersData } = await supabase
          .from('characters')
          .select('*')
          .eq('session_id', sessionId);

        if (charactersData) {
          setCharacters((charactersData as DbCharacter[]).map(dbCharacterToCharacter));
        }

        const { data: templatesData } = await supabase
          .from('npc_templates')
          .select('*')
          .eq('session_id', sessionId);

        if (templatesData) {
          setNPCTemplates((templatesData as DbNPCTemplate[]).map(dbNPCTemplateToNPCTemplate));
        }

        const { data: handoutData, error: handoutError } = await supabase
          .from('handouts')
          .select('*')
          .eq('session_id', sessionId)
          .order('sort_order', { ascending: true });

        if (!handoutError) {
          setHandouts(
            (handoutData as DbHandout[] | null | undefined)?.map(dbHandoutToHandout) || []
          );
        }

        const { data: instancesData } = await supabase
          .from('npc_instances')
          .select('*')
          .in(
            'map_id',
            mapsData?.map((m: DbMap) => m.id) || []
          );

        if (instancesData) {
          setNPCInstances((instancesData as DbNPCInstance[]).map(dbNPCInstanceToNPCInstance));
        }

        const { data: playersData } = await supabase
          .from('session_players')
          .select('*')
          .eq('session_id', sessionId);

        if (playersData) {
          setPlayers((playersData as DbSessionPlayer[]).map(dbSessionPlayerToSessionPlayer));
        }

        const { data: messagesData } = await supabase
          .from('chat_messages')
          .select('*')
          .eq('session_id', sessionId)
          .order('created_at', { ascending: false })
          .limit(100);

        if (messagesData) {
          setMessages((messagesData as DbChatMessage[]).map(dbChatMessageToChatMessage).reverse());
        }

        const { data: rollsData } = await supabase
          .from('dice_rolls')
          .select('*')
          .eq('session_id', sessionId)
          .order('created_at', { ascending: false })
          .limit(50);

        if (rollsData) {
          setDiceRolls((rollsData as DbDiceRoll[]).map(dbDiceRollToDiceRoll).reverse());
        }

        const { data: initiativeData, error: initiativeError } = await supabase
          .from('initiative_entries')
          .select('*')
          .eq('session_id', sessionId)
          .order('created_at', { ascending: true });

        if (!initiativeError && initiativeData) {
          setEntries((initiativeData as DbInitiativeEntry[]).map(dbInitiativeEntryToInitiativeEntry));
        }

        const { data: initiativeLogsData, error: initiativeLogsError } = await supabase
          .from('initiative_roll_logs')
          .select('*')
          .eq('session_id', sessionId)
          .order('created_at', { ascending: false })
          .limit(200);

        if (!initiativeLogsError && initiativeLogsData) {
          setRollLogs((initiativeLogsData as DbInitiativeRollLog[]).map(dbInitiativeRollLogToInitiativeRollLog));
        }

        if (isMissingRelationError(initiativeError) || isMissingRelationError(initiativeLogsError)) {
          console.warn('Initiative tables are not available yet; skipping initiative hydration.');
        }
        if (isMissingRelationError(handoutError)) {
          console.warn('Handout tables are not available yet; skipping handout hydration.');
        }
      } catch (error) {
        console.error('Error loading session data:', error);
      }
    },
    [
      setMaps,
      setActiveMap,
      setCharacters,
      setNPCTemplates,
      setNPCInstances,
      setHandouts,
      setPlayers,
      setMessages,
      setDiceRolls,
      setEntries,
      setRollLogs,
    ]
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
    async (settings: Partial<Pick<Session, 'allowPlayersRenameNpcs' | 'allowPlayersMoveNpcs' | 'enableInitiativePhase' | 'enablePlotDice' | 'allowPlayersDrawings'>>) => {
      if (!session) return { success: false, error: 'Not in a session' };

      try {
        const dbUpdates: Record<string, unknown> = {};
        if (settings.allowPlayersRenameNpcs !== undefined) {
          dbUpdates.allow_players_rename_npcs = settings.allowPlayersRenameNpcs;
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
    claimGM,
    releaseGM,
    leaveSession,
    updateNotepad,
    updateSessionSettings,
  };
};
