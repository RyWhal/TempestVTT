import { useEffect, useRef } from 'react';
import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { useSessionStore } from '../stores/sessionStore';
import { useMapStore } from '../stores/mapStore';
import { useChatStore } from '../stores/chatStore';
import { useInitiativeStore } from '../stores/initiativeStore';
import { useSession } from './useSession';
import {
  dbSessionToSession,
  dbMapToMap,
  dbCharacterToCharacter,
  dbNPCInstanceToNPCInstance,
  dbSessionPlayerToSessionPlayer,
  dbChatMessageToChatMessage,
  dbDiceRollToDiceRoll,
  dbInitiativeEntryToInitiativeEntry,
  dbInitiativeRollLogToInitiativeRollLog,
  type DbSession,
  type DbMap,
  type DbCharacter,
  type DbNPCInstance,
  type DbSessionPlayer,
  type DbChatMessage,
  type DbDiceRoll,
  type DbInitiativeEntry,
  type DbInitiativeRollLog,
  type ChatMessage,
  type DiceRoll,
  type Map,
} from '../types';
import { clearTokenBroadcastChannel, getTokenBroadcastChannel } from '../lib/tokenBroadcast';

const isMissingRelationError = (error: { code?: string; message?: string } | null) =>
  error?.code === '42P01' || error?.message?.toLowerCase().includes('does not exist');

const initiativeRealtimeTableAvailability = new Map<
  'initiative_entries' | 'initiative_roll_logs',
  boolean
>();

export const resetInitiativeRealtimeAvailabilityForTests = () => {
  initiativeRealtimeTableAvailability.clear();
};

export const canUseInitiativeRealtimeTable = async (
  table: 'initiative_entries' | 'initiative_roll_logs'
) => {
  const cachedAvailability = initiativeRealtimeTableAvailability.get(table);
  if (cachedAvailability !== undefined) {
    return cachedAvailability;
  }

  const { error } = await supabase.from(table).select('id').limit(1);
  const isAvailable = !isMissingRelationError(error);
  initiativeRealtimeTableAvailability.set(table, isAvailable);
  return isAvailable;
};

export const useRealtime = () => {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const initiativeChannelRef = useRef<RealtimeChannel | null>(null);
  const shouldResyncRef = useRef(false);
  const mapsRef = useRef<Map[]>([]);
  const currentUserRef = useRef<{
    username: string;
    characterId: string | null;
    isGm: boolean;
  } | null>(null);
  const { loadSessionData } = useSession();
  const {
    session,
    currentUser,
    updateSession,
    addPlayer,
    removePlayer,
    updatePlayer,
    setConnectionStatus,
  } =
    useSessionStore();
  const {
    maps,
    setCharacters,
    setNPCInstances,
    updateMap,
    addMap,
    removeMap,
    setActiveMap,
    updateCharacter,
    addCharacter,
    removeCharacter,
    moveCharacter,
    updateNPCInstance,
    addNPCInstance,
    removeNPCInstance,
    moveNPCInstance,
    setTokenLock,
    clearTokenLock,
  } = useMapStore();
  const { addMessage, addDiceRoll } = useChatStore();
  const { upsertEntry, removeEntry, addRollLog } = useInitiativeStore();

  useEffect(() => {
    mapsRef.current = maps;
  }, [maps]);

  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  useEffect(() => {
    if (!session?.id) {
      setConnectionStatus('disconnected');
      return;
    }

    setConnectionStatus('connecting');

    const sessionId = session.id;
    shouldResyncRef.current = false;
    let cancelled = false;

    const channel = supabase.channel(`session:${sessionId}`, {
      config: {
        broadcast: { self: false },
        presence: { key: currentUser?.username || 'anonymous' },
      },
    });

    channel.on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'sessions',
        filter: `id=eq.${sessionId}`,
      },
      (payload) => {
        const updated = dbSessionToSession(payload.new as DbSession);
        updateSession(updated);

        if (updated.activeMapId !== session.activeMapId) {
          const activeMap = mapsRef.current.find((m) => m.id === updated.activeMapId);
          setActiveMap(activeMap || null);
        }
      }
    );

    channel
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'maps',
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          addMap(dbMapToMap(payload.new as DbMap));
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'maps',
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          const updated = dbMapToMap(payload.new as DbMap);
          updateMap(updated.id, updated);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'maps',
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          removeMap((payload.old as { id: string }).id);
        }
      );


    channel
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'characters',
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          addCharacter(dbCharacterToCharacter(payload.new as DbCharacter));
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'characters',
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          const updated = dbCharacterToCharacter(payload.new as DbCharacter);
          updateCharacter(updated.id, updated);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'characters',
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          removeCharacter((payload.old as { id: string }).id);
        }
      );


    channel
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'npc_instances',
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          const instance = payload.new as DbNPCInstance;
          if (mapsRef.current.some((m) => m.id === instance.map_id)) {
            addNPCInstance(dbNPCInstanceToNPCInstance(instance));
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'npc_instances',
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          const updated = dbNPCInstanceToNPCInstance(payload.new as DbNPCInstance);
          updateNPCInstance(updated.id, updated);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'npc_instances',
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          removeNPCInstance((payload.old as { id: string }).id);
        }
      );

    channel
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'session_players',
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          addPlayer(dbSessionPlayerToSessionPlayer(payload.new as DbSessionPlayer));
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'session_players',
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          const updatedPlayer = dbSessionPlayerToSessionPlayer(payload.new as DbSessionPlayer);
          updatePlayer(updatedPlayer.id, updatedPlayer);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'session_players',
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          removePlayer((payload.old as { id: string }).id);
        }
      );

    channel.on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages',
        filter: `session_id=eq.${sessionId}`,
      },
      (payload) => {
        addMessage(dbChatMessageToChatMessage(payload.new as DbChatMessage));
      }
    );

    channel.on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'dice_rolls',
        filter: `session_id=eq.${sessionId}`,
      },
      (payload) => {
        const roll = dbDiceRollToDiceRoll(payload.new as DbDiceRoll);
        const activeUser = currentUserRef.current;
        if (roll.visibility === 'public') {
          addDiceRoll(roll);
        } else if (roll.visibility === 'gm_only' && activeUser?.isGm) {
          addDiceRoll(roll);
        } else if (roll.visibility === 'self' && roll.username === activeUser?.username) {
          addDiceRoll(roll);
        }
      }
    );

    const resyncSessionState = async () => {
      await loadSessionData(sessionId);
    };

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        setConnectionStatus('connected');
        if (shouldResyncRef.current) {
          shouldResyncRef.current = false;
          void resyncSessionState();
        }
      } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
        setConnectionStatus('reconnecting');
        shouldResyncRef.current = true;
      }
    });

    channelRef.current = channel;
    const tokenChannel = getTokenBroadcastChannel(sessionId);
    const buildTokenKey = (type: 'character' | 'npc', id: string) => `${type}:${id}`;

    tokenChannel.on('broadcast', { event: 'token_move' }, ({ payload }) => {
      const movePayload = payload as {
        sessionId: string;
        tokenId: string;
        tokenType: 'character' | 'npc';
        mapId?: string;
        x: number;
        y: number;
      };

      if (movePayload.sessionId !== sessionId) return;

      if (movePayload.tokenType === 'character') {
        moveCharacter(movePayload.tokenId, movePayload.x, movePayload.y, movePayload.mapId);
      } else {
        moveNPCInstance(movePayload.tokenId, movePayload.x, movePayload.y, movePayload.mapId);
      }
    });

    tokenChannel.on('broadcast', { event: 'token_lock' }, ({ payload }) => {
      const lockPayload = payload as {
        sessionId: string;
        tokenId: string;
        tokenType: 'character' | 'npc';
        username: string;
      };

      if (lockPayload.sessionId !== sessionId) return;
      setTokenLock(buildTokenKey(lockPayload.tokenType, lockPayload.tokenId), lockPayload.username);
    });

    tokenChannel.on('broadcast', { event: 'token_unlock' }, ({ payload }) => {
      const lockPayload = payload as {
        sessionId: string;
        tokenId: string;
        tokenType: 'character' | 'npc';
        username: string;
      };

      if (lockPayload.sessionId !== sessionId) return;
      clearTokenLock(buildTokenKey(lockPayload.tokenType, lockPayload.tokenId));
    });

    tokenChannel.on('broadcast', { event: 'chat_message' }, ({ payload }) => {
      const chatPayload = payload as {
        sessionId: string;
        message: {
          id: string;
          sessionId: string;
          username: string;
          message: string;
          isGmAnnouncement: boolean;
          createdAt: string;
        };
      };

      if (chatPayload.sessionId !== sessionId) return;
      addMessage(chatPayload.message as ChatMessage);
    });

    tokenChannel.on('broadcast', { event: 'dice_roll' }, ({ payload }) => {
      const rollPayload = payload as {
        sessionId: string;
        roll: {
          id: string;
          sessionId: string;
          username: string;
          characterName: string | null;
          rollExpression: string;
          rollResults: unknown;
          visibility: 'public' | 'gm_only' | 'self';
          plotDiceResults: unknown;
          createdAt: string;
        };
      };

      if (rollPayload.sessionId !== sessionId) return;
      const roll = rollPayload.roll as DiceRoll;
      const activeUser = currentUserRef.current;
      if (roll.visibility === 'public') {
        addDiceRoll(roll);
      } else if (roll.visibility === 'gm_only' && activeUser?.isGm) {
        addDiceRoll(roll);
      } else if (roll.visibility === 'self' && roll.username === activeUser?.username) {
        addDiceRoll(roll);
      }
    });

    tokenChannel.on('broadcast', { event: 'active_map' }, ({ payload }) => {
      const mapPayload = payload as {
        sessionId: string;
        mapId: string;
      };

      if (mapPayload.sessionId !== sessionId) return;
      const nextMap = mapsRef.current.find((map) => map.id === mapPayload.mapId);
      if (nextMap) {
        setActiveMap(nextMap);
      }
    });

    const connectInitiativeChannel = async () => {
      const hasInitiativeEntriesTable = await canUseInitiativeRealtimeTable('initiative_entries');
      if (!hasInitiativeEntriesTable || cancelled) {
        return;
      }

      const initiativeChannel = supabase.channel(`initiative:${sessionId}`);

      initiativeChannel
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'initiative_entries',
            filter: `session_id=eq.${sessionId}`,
          },
          (payload) => {
            upsertEntry(dbInitiativeEntryToInitiativeEntry(payload.new as DbInitiativeEntry));
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'initiative_entries',
            filter: `session_id=eq.${sessionId}`,
          },
          (payload) => {
            upsertEntry(dbInitiativeEntryToInitiativeEntry(payload.new as DbInitiativeEntry));
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'DELETE',
            schema: 'public',
            table: 'initiative_entries',
            filter: `session_id=eq.${sessionId}`,
          },
          (payload) => {
            removeEntry((payload.old as { id: string }).id);
          }
        );

      const hasInitiativeLogsTable = await canUseInitiativeRealtimeTable('initiative_roll_logs');
      if (hasInitiativeLogsTable) {
        initiativeChannel.on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'initiative_roll_logs',
            filter: `session_id=eq.${sessionId}`,
          },
          (payload) => {
            addRollLog(dbInitiativeRollLogToInitiativeRollLog(payload.new as DbInitiativeRollLog));
          }
        );
      }

      initiativeChannel.subscribe();
      initiativeChannelRef.current = initiativeChannel;
    };

    void connectInitiativeChannel();

    return () => {
      cancelled = true;
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      if (initiativeChannelRef.current) {
        supabase.removeChannel(initiativeChannelRef.current);
        initiativeChannelRef.current = null;
      }
      clearTokenBroadcastChannel();
    };
  }, [
    session?.id,
    currentUser?.username,
    updateSession,
    addPlayer,
    removePlayer,
    updatePlayer,
    setCharacters,
    setNPCInstances,
    updateMap,
    addMap,
    removeMap,
    setActiveMap,
    updateCharacter,
    addCharacter,
    removeCharacter,
    moveCharacter,
    updateNPCInstance,
    addNPCInstance,
    removeNPCInstance,
    moveNPCInstance,
    setTokenLock,
    clearTokenLock,
    addMessage,
    addDiceRoll,
    upsertEntry,
    removeEntry,
    addRollLog,
    setConnectionStatus,
    loadSessionData,
  ]);

  return {
    isConnected: useSessionStore((state) => state.connectionStatus === 'connected'),
  };
};
