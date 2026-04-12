/* @vitest-environment jsdom */

import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DicePanel } from './DicePanel';

const {
  rollDiceMock,
  clearDiceHistoryMock,
  mockSessionState,
  mockDiceRolls,
} = vi.hoisted(() => ({
  rollDiceMock: vi.fn().mockResolvedValue({ success: true }),
  clearDiceHistoryMock: vi.fn().mockResolvedValue({ success: true }),
  mockSessionState: {
    session: {
      id: 'session_001',
      code: 'ABCD12',
      name: 'Shared Table',
      enablePlotDice: true,
    },
    currentUser: {
      username: 'Kaladin',
      characterId: 'char_1',
      isGm: false,
    },
  },
  mockDiceRolls: [
    {
      id: 'roll_001',
      username: 'Kaladin',
      characterName: 'Sir Henry',
      rollExpression: '1d20+2',
      rollResults: {
        dice: [{ type: 'd20', count: 1, results: [18] }],
        modifier: 2,
        total: 20,
        mode: 'normal',
        attempts: [
          {
            dice: [{ type: 'd20', count: 1, results: [18] }],
            modifier: 2,
            subtotal: 20,
            total: 20,
            plotDie: null,
          },
        ],
        keptAttemptIndex: 0,
      },
      visibility: 'public',
      plotDiceResults: null,
      createdAt: '2026-04-08T12:00:00.000Z',
    },
  ],
}));

vi.mock('../../hooks/useChat', () => ({
  useChat: () => ({
    diceRolls: mockDiceRolls,
    rollDice: rollDiceMock,
    clearDiceHistory: clearDiceHistoryMock,
  }),
}));

vi.mock('../../hooks/useCharacters', () => ({
  useCharacters: () => ({
    myCharacter: {
      id: 'char_1',
      name: 'Sir Henry',
    },
  }),
}));

vi.mock('../../stores/sessionStore', () => ({
  useSessionStore: (selector: (state: typeof mockSessionState) => unknown) =>
    selector(mockSessionState),
}));

vi.mock('../shared/Toast', () => ({
  useToast: () => ({
    showToast: vi.fn(),
  }),
}));

describe('DicePanel', () => {
  beforeEach(() => {
    rollDiceMock.mockClear();
    clearDiceHistoryMock.mockClear();
    mockSessionState.currentUser.isGm = false;
    mockDiceRolls.splice(
      0,
      mockDiceRolls.length,
      {
        id: 'roll_001',
        username: 'Kaladin',
        characterName: 'Sir Henry',
        rollExpression: '1d20+2',
        rollResults: {
          dice: [{ type: 'd20', count: 1, results: [18] }],
          modifier: 2,
          total: 20,
          mode: 'normal',
          attempts: [
            {
              dice: [{ type: 'd20', count: 1, results: [18] }],
              modifier: 2,
              subtotal: 20,
              total: 20,
              plotDie: null,
            },
          ],
          keptAttemptIndex: 0,
        },
        visibility: 'public',
        plotDiceResults: null,
        createdAt: '2026-04-08T12:00:00.000Z',
      }
    );
    vi.stubGlobal('confirm', vi.fn(() => true));
  });

  it('keeps rolling disabled for modifier-only selections', () => {
    render(<DicePanel />);

    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '2' } });

    expect(screen.getByRole('button', { name: /roll!/i }).hasAttribute('disabled')).toBe(true);
  });

  it('blocks plot-die rolls that do not include a d20', () => {
    render(<DicePanel />);

    fireEvent.click(screen.getByRole('button', { name: /d6/i }));
    fireEvent.click(screen.getByRole('checkbox', { name: /use plot die/i }));

    expect(screen.getByText(/plot die requires a d20/i)).not.toBeNull();
    expect(screen.getByRole('button', { name: /roll!/i }).hasAttribute('disabled')).toBe(true);
  });

  it('lets the GM clear shared roll history', () => {
    mockSessionState.currentUser.isGm = true;

    render(<DicePanel />);

    fireEvent.click(screen.getByRole('button', { name: /clear history/i }));

    expect(clearDiceHistoryMock).toHaveBeenCalledTimes(1);
  });

  it('does not show a kept-style badge for normal rolls', () => {
    render(<DicePanel />);

    expect(screen.queryByText(/kept/i)).toBeNull();
    expect(screen.queryByText(/^advantage$/i, { selector: 'span.rounded' })).toBeNull();
    expect(screen.queryByText(/^disadvantage$/i, { selector: 'span.rounded' })).toBeNull();

    const resultCard = screen.getByText(/^Result$/i).parentElement?.parentElement;
    expect(resultCard?.className.includes('border-slate-700')).toBe(true);
    expect(resultCard?.className.includes('bg-slate-900/40')).toBe(true);
    expect(resultCard?.className.includes('border-tempest-500/40')).toBe(false);
    expect(resultCard?.className.includes('bg-tempest-500/10')).toBe(false);
  });

  it('marks the selected attempt with an advantage badge and green highlight', () => {
    mockDiceRolls.splice(
      0,
      mockDiceRolls.length,
      {
        id: 'roll_advantage',
        username: 'Kaladin',
        characterName: 'Sir Henry',
        rollExpression: '1d20+2',
        rollResults: {
          dice: [{ type: 'd20', count: 1, results: [12] }],
          modifier: 2,
          total: 17,
          mode: 'advantage',
          attempts: [
            {
              dice: [{ type: 'd20', count: 1, results: [8] }],
              modifier: 2,
              subtotal: 10,
              total: 10,
              plotDie: null,
            },
            {
              dice: [{ type: 'd20', count: 1, results: [15] }],
              modifier: 2,
              subtotal: 17,
              total: 17,
              plotDie: null,
            },
          ],
          keptAttemptIndex: 1,
        },
        visibility: 'public',
        plotDiceResults: null,
        createdAt: '2026-04-08T12:00:00.000Z',
      }
    );

    render(<DicePanel />);

    const badge = screen.getByText(/^advantage$/i, { selector: 'span.rounded' });
    expect(badge.className.includes('bg-green-500/20')).toBe(true);
    expect(badge.className.includes('text-green-200')).toBe(true);

    const highlightedAttempt = badge.parentElement?.parentElement;
    expect(highlightedAttempt?.className.includes('border-green-500/40')).toBe(true);
    expect(highlightedAttempt?.className.includes('bg-green-500/10')).toBe(true);
  });

  it('marks the selected attempt with a disadvantage badge and red highlight', () => {
    mockDiceRolls.splice(
      0,
      mockDiceRolls.length,
      {
        id: 'roll_disadvantage',
        username: 'Kaladin',
        characterName: 'Sir Henry',
        rollExpression: '1d20+2',
        rollResults: {
          dice: [{ type: 'd20', count: 1, results: [6] }],
          modifier: 2,
          total: 8,
          mode: 'disadvantage',
          attempts: [
            {
              dice: [{ type: 'd20', count: 1, results: [4] }],
              modifier: 2,
              subtotal: 6,
              total: 6,
              plotDie: null,
            },
            {
              dice: [{ type: 'd20', count: 1, results: [8] }],
              modifier: 2,
              subtotal: 10,
              total: 10,
              plotDie: null,
            },
          ],
          keptAttemptIndex: 0,
        },
        visibility: 'public',
        plotDiceResults: null,
        createdAt: '2026-04-08T12:00:00.000Z',
      }
    );

    render(<DicePanel />);

    const badge = screen.getByText(/^disadvantage$/i, { selector: 'span.rounded' });
    expect(badge.className.includes('bg-red-500/20')).toBe(true);
    expect(badge.className.includes('text-red-200')).toBe(true);

    const highlightedAttempt = badge.parentElement?.parentElement;
    expect(highlightedAttempt?.className.includes('border-red-500/40')).toBe(true);
    expect(highlightedAttempt?.className.includes('bg-red-500/10')).toBe(true);
  });
});
