import { useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useSessionStore } from '../stores/sessionStore';
import { useChatStore } from '../stores/chatStore';
import { dbChatMessageToChatMessage, dbDiceRollToDiceRoll, type DbChatMessage, type DbDiceRoll } from '../types';
import { parseAndRoll, rollPlotDice } from '../lib/dice';
import { broadcastChatMessage, broadcastDiceRoll } from '../lib/tokenBroadcast';
import type { RollVisibility, PlotDieResult, RollResults } from '../types';

export const useChat = () => {
  const session = useSessionStore((state) => state.session);
  const currentUser = useSessionStore((state) => state.currentUser);
  const { messages, diceRolls, addMessage, addDiceRoll, resetUnread } = useChatStore();

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
          await broadcastChatMessage({ sessionId: session.id, message: chatMessage });
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
      visibility: RollVisibility = 'public',
      plotDiceCount = 0,
      characterName?: string
    ): Promise<{ success: boolean; results?: RollResults; error?: string }> => {
      if (!session || !currentUser) {
        return { success: false, error: 'Not in a session' };
      }

      try {
        // Parse and roll the dice
        const results = parseAndRoll(expression);

        // Roll plot dice if any
        let plotDiceResults: PlotDieResult[] | null = null;
        if (plotDiceCount > 0) {
          plotDiceResults = rollPlotDice(plotDiceCount).map((face) => ({ face }));
        }

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
          await broadcastDiceRoll({ sessionId: session.id, roll });
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
      return rollDice(expression, 'public', 0);
    },
    [rollDice]
  );

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
    quickRoll,
    markAsRead,
  };
};
