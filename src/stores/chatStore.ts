import { create } from 'zustand';
import type { ChatMessage, DiceRoll } from '../types';

interface ChatState {
  // Messages
  messages: ChatMessage[];

  // Dice rolls
  diceRolls: DiceRoll[];

  // UI state
  unreadCount: number;
  isNewRollAnimating: boolean;

  // Actions - Messages
  setMessages: (messages: ChatMessage[]) => void;
  addMessage: (message: ChatMessage) => void;
  clearMessages: () => void;

  // Actions - Dice rolls
  setDiceRolls: (rolls: DiceRoll[]) => void;
  addDiceRoll: (roll: DiceRoll) => void;
  clearDiceRolls: () => void;

  // Actions - UI
  incrementUnread: () => void;
  resetUnread: () => void;
  setNewRollAnimating: (animating: boolean) => void;

  // Clear all
  clearChatState: () => void;
}

const MAX_MESSAGES = 500;
const MAX_DICE_ROLLS = 100;

export const useChatStore = create<ChatState>()((set) => ({
  // Initial state
  messages: [],
  diceRolls: [],
  unreadCount: 0,
  isNewRollAnimating: false,

  // Message actions
  setMessages: (messages) => set({ messages: messages.slice(-MAX_MESSAGES) }),

  addMessage: (message) =>
    set((state) => ({
      messages: [...state.messages.filter((m) => m.id !== message.id), message].slice(-MAX_MESSAGES),
    })),

  clearMessages: () => set({ messages: [] }),

  // Dice roll actions
  setDiceRolls: (rolls) => set({ diceRolls: rolls.slice(-MAX_DICE_ROLLS) }),

  addDiceRoll: (roll) =>
    set((state) => ({
      diceRolls: [...state.diceRolls.filter((existing) => existing.id !== roll.id), roll].slice(-MAX_DICE_ROLLS),
      isNewRollAnimating: true,
    })),

  clearDiceRolls: () => set({ diceRolls: [] }),

  // UI actions
  incrementUnread: () =>
    set((state) => ({ unreadCount: state.unreadCount + 1 })),

  resetUnread: () => set({ unreadCount: 0 }),

  setNewRollAnimating: (animating) => set({ isNewRollAnimating: animating }),

  clearChatState: () =>
    set({
      messages: [],
      diceRolls: [],
      unreadCount: 0,
      isNewRollAnimating: false,
    }),
}));

// Selector hooks
export const useMessages = () => useChatStore((state) => state.messages);
export const useDiceRolls = () => useChatStore((state) => state.diceRolls);
export const useUnreadCount = () => useChatStore((state) => state.unreadCount);
