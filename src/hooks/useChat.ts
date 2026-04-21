import { useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useSessionStore } from '../stores/sessionStore';
import { useChatStore } from '../stores/chatStore';
import { dbChatMessageToChatMessage, dbDiceRollToDiceRoll, type DbChatMessage, type DbDiceRoll } from '../types';
import { createRollResults } from '../lib/dice';
import {
  broadcastChatMessage,
  broadcastDiceRoll,
  broadcastDiceRollHistoryCleared,
} from '../lib/tokenBroadcast';
import type { RollMode, RollVisibility, PlotDieResult, RollResults } from '../types';

interface RollDiceOptions {
  visibility?: RollVisibility;
  plotDieEnabled?: boolean;
  characterName?: string;
  mode?: RollMode;
}

const swallowBroadcastError = (label: string) => (error: unknown) => {
  console.warn(`${label} broadcast failed`, error);
};

const detachBroadcast = (label: string, operation: Promise<unknown> | unknown) => {
  void Promise.resolve(operation).catch(swallowBroadcastError(label));
};

export const useChat = () => {
  const session = useSessionStore((state) => state.session);
  const currentUser = useSessionStore((state) => state.currentUser);
  const {
    messages,
    diceRolls,
    addMessage,
    addDiceRoll,
    clearDiceRolls,
    resetUnread,
  } = useChatStore();

  /**
   * Send a chat message
   */
  const sendMessage = useCallback(
    async (
      message: string,
      isGmAnnouncement = false
    ): Promise<{ success: boolean; error?: string }> => {
      if (!session || !currentUser) {
        return { success: false, error: 'Not in a session' };
      }

      if (!message.trim()) {
        return { success: false, error: 'Message cannot be empty' };
      }

      try {
        const { data, error } = await supabase
          .from('chat_messages')
          .insert({
            session_id: session.id,
            username: currentUser.username,
            message: message.trim(),
            is_gm_announcement: isGmAnnouncement && currentUser.isGm,
          })
          .select('*')
          .single();

        if (error) {
          return { success: false, error: error.message };
        }

        if (data) {
          const chatMessage = dbChatMessageToChatMessage(data as DbChatMessage);
          addMessage(chatMessage);
          detachBroadcast('chat', broadcastChatMessage({ sessionId: session.id, message: chatMessage }));
        }

        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    },
    [session, currentUser, addMessage]
  );

  /**
   * Roll dice
   */
  const rollDice = useCallback(
    async (
      expression: string,
      options: RollDiceOptions = {}
    ): Promise<{ success: boolean; results?: RollResults; error?: string }> => {
      if (!session || !currentUser) {
        return { success: false, error: 'Not in a session' };
      }

      try {
        const {
          visibility = 'public',
          plotDieEnabled = false,
          characterName,
          mode = 'normal',
        } = options;

        const results = createRollResults(expression, {
          mode,
          plotDieEnabled,
        });
        const plotDiceResults: PlotDieResult[] | null = results.plotDie ? [results.plotDie] : null;

        // Save to database
        const { data, error } = await supabase
          .from('dice_rolls')
          .insert({
            session_id: session.id,
            username: currentUser.username,
            character_name: characterName || null,
            roll_expression: expression,
            roll_results: results,
            visibility,
            plot_dice_results: plotDiceResults,
          })
          .select('*')
          .single();

        if (error) {
          return { success: false, error: error.message };
        }

        if (data) {
          const roll = dbDiceRollToDiceRoll(data as DbDiceRoll);
          if (roll.visibility === 'public') {
            addDiceRoll(roll);
          } else if (roll.visibility === 'gm_only' && currentUser.isGm) {
            addDiceRoll(roll);
          } else if (roll.visibility === 'self' && roll.username === currentUser.username) {
            addDiceRoll(roll);
          }
          detachBroadcast('dice', broadcastDiceRoll({ sessionId: session.id, roll }));
        }

        return { success: true, results };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    },
    [session, currentUser, addDiceRoll]
  );

  /**
   * Quick roll with default visibility
   */
  const quickRoll = useCallback(
    async (expression: string) => {
      return rollDice(expression, { visibility: 'public' });
    },
    [rollDice]
  );

  const clearDiceHistory = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
    if (!session || !currentUser?.isGm) {
      return { success: false, error: 'GM only' };
    }

    try {
      const { error } = await supabase.from('dice_rolls').delete().eq('session_id', session.id);
      if (error) {
        return { success: false, error: error.message };
      }

      clearDiceRolls();
      detachBroadcast('dice-history', broadcastDiceRollHistoryCleared({ sessionId: session.id }));
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }, [session, currentUser, clearDiceRolls]);

  /**
   * Mark messages as read
   */
  const markAsRead = useCallback(() => {
    resetUnread();
  }, [resetUnread]);

  return {
    messages,
    diceRolls,
    sendMessage,
    rollDice,
    clearDiceHistory,
    quickRoll,
    markAsRead,
  };
};
