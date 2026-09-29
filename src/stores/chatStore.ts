import { create } from 'zustand';
import type { ChatMessage, DiceRoll } from '../types';

interface ChatState {
  // Messages
  messages: ChatMessage[];

  // Dice rolls
  diceRolls: DiceRoll[];
  rollAnimationQueue: DiceRoll[];
  revealedRollId: string | null;
  revealRollResults: (id: string) => void;
  recentRollIds: string[];
  finishRollAnimation: (id: string) => void;
  clearRollAnimations: () => void;

  // UI state
  unreadCount: number;
  isNewRollAnimating: boolean;

  // Actions - Messages
  setMessages: (messages: ChatMessage[]) => void;
  addMessage: (message: ChatMessage) => void;
  clearMessages: () => void;

  // Actions - Dice rolls
  setDiceRolls: (rolls: DiceRoll[]) => void;
  addDiceRoll: (roll: DiceRoll, animate?: boolean) => void;
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
const MAX_ANIMATION_QUEUE = 8;
const MAX_RECENT_ROLL_IDS = 1000;
const rememberRolls = (previous: string[], ids: string[]) =>
  Array.from(new Set([...previous, ...ids])).slice(-MAX_RECENT_ROLL_IDS);

export const useChatStore = create<ChatState>()((set) => ({
  // Initial state
  messages: [],
  diceRolls: [],
  rollAnimationQueue: [],
  revealedRollId: null,
  recentRollIds: [],
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
  // Hydrating history must not enqueue animations, even when its realtime echo arrives later.
  setDiceRolls: (rolls) => set((state) => ({
    diceRolls: rolls.slice(-MAX_DICE_ROLLS),
    recentRollIds: rememberRolls(state.recentRollIds, rolls.map(roll => roll.id)),
  })),

  // Remote deliveries update history only. They must not consume the local
  // animation ID: a realtime echo can arrive before the insert response.
  addDiceRoll: (roll, animate = true) =>
    set((state) => {
      const alreadySeen = state.recentRollIds.includes(roll.id);
      let queue = state.rollAnimationQueue;
      if (animate && !alreadySeen) {
        // Preserve the current animation during bursts; history retains skipped pending rolls.
        queue = queue.length >= MAX_ANIMATION_QUEUE
          ? [queue[0], ...queue.slice(-(MAX_ANIMATION_QUEUE - 2)), roll]
          : [...queue, roll];
      }
      return {
        diceRolls: [...state.diceRolls.filter((existing) => existing.id !== roll.id), roll].slice(-MAX_DICE_ROLLS),
        recentRollIds: animate ? rememberRolls(state.recentRollIds, [roll.id]) : state.recentRollIds,
        rollAnimationQueue: queue,
        isNewRollAnimating: queue.length > 0,
      };
    }),

  revealRollResults: (id) => set((state) =>
    state.rollAnimationQueue[0]?.id === id ? { revealedRollId: id } : state),

  finishRollAnimation: (id) => set((state) => {
    if (state.rollAnimationQueue[0]?.id !== id) return state;
    const queue = state.rollAnimationQueue.slice(1);
    return { rollAnimationQueue: queue, revealedRollId: null, isNewRollAnimating: queue.length > 0 };
  }),

  clearRollAnimations: () => set({ rollAnimationQueue: [], revealedRollId: null, isNewRollAnimating: false }),

  clearDiceRolls: () => set({ diceRolls: [], rollAnimationQueue: [], revealedRollId: null, isNewRollAnimating: false }),

  // UI actions
  incrementUnread: () =>
    set((state) => ({ unreadCount: state.unreadCount + 1 })),

  resetUnread: () => set({ unreadCount: 0 }),

  setNewRollAnimating: (animating) => set({ isNewRollAnimating: animating }),

  clearChatState: () =>
    set({
      messages: [],
      diceRolls: [],
      rollAnimationQueue: [],
      revealedRollId: null,
      recentRollIds: [],
      unreadCount: 0,
      isNewRollAnimating: false,
    }),
}));

// Selector hooks
export const useMessages = () => useChatStore((state) => state.messages);
export const useDiceRolls = () => useChatStore((state) => state.diceRolls);
export const useUnreadCount = () => useChatStore((state) => state.unreadCount);
