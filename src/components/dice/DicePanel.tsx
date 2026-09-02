import React, { useMemo, useState } from 'react';
import { Dices } from 'lucide-react';
import { useChat } from '../../hooks/useChat';
import { useCharacters } from '../../hooks/useCharacters';
import { useSessionStore } from '../../stores/sessionStore';
import { buildDiceExpression, getPlotDieFaceName, normalizePlotDieResult } from '../../lib/dice';
import { useToast } from '../shared/Toast';
import type { DiceRoll, RollAttempt, RollMode, RollVisibility } from '../../types';

const DICE_TYPES = [4, 6, 8, 10, 12, 20] as const;
const ROLL_MODE_OPTIONS: Array<{ value: RollMode; label: string }> = [
  { value: 'normal', label: 'Normal' },
  { value: 'advantage', label: 'Advantage' },
  { value: 'disadvantage', label: 'Disadvantage' },
];

const DiceIcon: React.FC<{ sides: number; className?: string }> = ({ sides, className = 'h-5 w-5' }) => {
  switch (sides) {
    case 4:
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className}>
          <polygon points="12 2 2 20 22 20" />
          <line x1="12" y1="2" x2="12" y2="20" opacity="0.35" />
          <text x="12" y="16.5" textAnchor="middle" fill="currentColor" stroke="none" fontSize="8" fontWeight="bold">4</text>
        </svg>
      );
    case 6:
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className}>
          <rect x="3.5" y="3.5" width="17" height="17" rx="3" />
          <text x="12" y="15.5" textAnchor="middle" fill="currentColor" stroke="none" fontSize="9.5" fontWeight="bold">6</text>
        </svg>
      );
    case 8:
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className}>
          <polygon points="12 2 21.5 12 12 22 2.5 12" />
          <line x1="2.5" y1="12" x2="21.5" y2="12" opacity="0.35" />
          <text x="12" y="15.5" textAnchor="middle" fill="currentColor" stroke="none" fontSize="9" fontWeight="bold">8</text>
        </svg>
      );
    case 10:
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className}>
          <polygon points="12 2 21 8 16.5 21 7.5 21 3 8" />
          <text x="12" y="14.8" textAnchor="middle" fill="currentColor" stroke="none" fontSize="8" fontWeight="bold">10</text>
        </svg>
      );
    case 12:
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className}>
          <polygon points="12 2 21.5 8.9 17.9 20 6.1 20 2.5 8.9" />
          <text x="12" y="14.8" textAnchor="middle" fill="currentColor" stroke="none" fontSize="8" fontWeight="bold">12</text>
        </svg>
      );
    case 20:
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className}>
          <polygon points="12 2 21.5 7.5 21.5 16.5 12 22 2.5 16.5 2.5 7.5" />
          <polygon points="12 2 17 8 7 8" opacity="0.35" />
          <text x="12" y="15.5" textAnchor="middle" fill="currentColor" stroke="none" fontSize="8" fontWeight="bold">20</text>
        </svg>
      );
    default:
      return null;
  }
};

export const DicePanel: React.FC = () => {
  const { showToast } = useToast();
  const { diceRolls, rollDice, clearDiceHistory } = useChat();
  const { myCharacter } = useCharacters();
  const session = useSessionStore((state) => state.session);
  const currentUser = useSessionStore((state) => state.currentUser);
  const plotDiceFeatureEnabled = Boolean(session?.enablePlotDice);
  const isGM = currentUser?.isGm ?? false;

  const [dice, setDice] = useState<Record<number, number>>({});
  const [modifier, setModifier] = useState(0);
  const [plotDieEnabled, setPlotDieEnabled] = useState(false);
  const [rollMode, setRollMode] = useState<RollMode>('normal');
  const [visibility, setVisibility] = useState<RollVisibility>('public');
  const [isRolling, setIsRolling] = useState(false);

  const addDie = (sides: number) => {
    setDice((prev) => ({
      ...prev,
      [sides]: Math.min((prev[sides] || 0) + 1, 20),
    }));
  };

  const removeDie = (sides: number) => {
    setDice((prev) => ({
      ...prev,
      [sides]: Math.max((prev[sides] || 0) - 1, 0),
    }));
  };

  const clearDice = () => {
    setDice({});
    setModifier(0);
    setPlotDieEnabled(false);
    setRollMode('normal');
  };

  const handleRoll = async () => {
    const expression = buildDiceExpression(dice, modifier);
    if (!canRoll || expression === '0') return;

    setIsRolling(true);
    const result = await rollDice(expression || '0', {
      visibility,
      plotDieEnabled: plotDiceFeatureEnabled && plotDieEnabled,
      characterName: myCharacter?.name,
      mode: rollMode,
    });
    setIsRolling(false);

    if (!result.success) {
      showToast(result.error || 'Failed to roll dice', 'error');
    }
  };

  const totalDice = Object.values(dice).reduce((a, b) => a + b, 0);
  const hasSelectedD20 = useMemo(() => (dice[20] || 0) > 0, [dice]);
  const hasInvalidPlotDieSelection = plotDiceFeatureEnabled && plotDieEnabled && !hasSelectedD20;
  const canRoll = !isRolling && totalDice > 0 && !hasInvalidPlotDieSelection;

  const handleClearHistory = async () => {
    if (!isGM) return;
    if (!confirm('Clear all shared dice roll history for this session?')) return;

    const result = await clearDiceHistory();
    if (result.success) {
      showToast('Dice roll history cleared', 'success');
    } else {
      showToast(result.error || 'Failed to clear dice history', 'error');
    }
  };

  // Sort newest rolls first (at top)
  const sortedRolls = useMemo(() => [...diceRolls].reverse(), [diceRolls]);

  return (
    <div className="h-full flex flex-col bg-slate-950/80 backdrop-blur-2xl text-slate-100">
      {/* Iconographic dice controls header */}
      <div className="p-3 border-b border-slate-800/80 space-y-2.5">
        {/* Dice Shape Selector Row */}
        <div className="grid grid-cols-6 gap-1.5">
          {DICE_TYPES.map((sides) => {
            const count = dice[sides] || 0;
            const isActive = count > 0;
            return (
              <button
                key={sides}
                onClick={() => addDie(sides)}
                title={`Add d${sides}`}
                className={`relative flex flex-col items-center justify-center py-2 px-1 rounded-2xl border transition-all ${
                  isActive
                    ? 'border-blue-500/80 bg-blue-600/25 text-blue-300 shadow-md shadow-blue-500/10'
                    : 'border-slate-800/80 bg-slate-900/60 text-slate-400 hover:bg-slate-800/80 hover:text-slate-200'
                }`}
              >
                <DiceIcon sides={sides} className="h-6 w-6 mb-0.5" />
                <span className="text-[10px] font-mono font-bold leading-none">d{sides}</span>
                {isActive && (
                  <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 font-mono text-[9px] font-extrabold text-white shadow-md">
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Selected Dice Pills & Clear Button */}
        {totalDice > 0 && (
          <div className="flex items-center justify-between text-xs pt-1.5 border-t border-slate-800/60">
            <div className="flex flex-wrap items-center gap-1">
              {Object.entries(dice).map(
                ([sidesStr, count]) =>
                  count > 0 && (
                    <span
                      key={sidesStr}
                      onClick={() => removeDie(parseInt(sidesStr, 10))}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900/90 px-2 py-0.5 font-mono text-[11px] text-blue-300 border border-slate-700/80 cursor-pointer hover:bg-slate-800"
                    >
                      <DiceIcon sides={parseInt(sidesStr, 10)} className="h-3.5 w-3.5 text-blue-400" />
                      <span>{count}d{sidesStr}</span>
                      <span className="text-slate-500 hover:text-rose-400">×</span>
                    </span>
                  )
              )}
            </div>
            <button
              onClick={clearDice}
              className="text-[11px] text-slate-400 hover:text-slate-200 underline ml-2"
            >
              Clear
            </button>
          </div>
        )}

        {/* Modifier, Mode, Visibility & Roll Action Bar */}
        <div className="grid grid-cols-12 gap-1.5 items-center text-xs">
          <div className="col-span-3 flex items-center justify-between rounded-xl border border-slate-800/80 bg-slate-900/80 px-2 py-1">
            <button
              onClick={() => setModifier((prev) => prev - 1)}
              className="text-slate-400 hover:text-slate-200 font-bold px-1"
            >
              -
            </button>
            <span className="font-mono text-xs font-semibold text-slate-200">
              {modifier >= 0 ? `+${modifier}` : modifier}
            </span>
            <button
              onClick={() => setModifier((prev) => prev + 1)}
              className="text-slate-400 hover:text-slate-200 font-bold px-1"
            >
              +
            </button>
          </div>

          <select
            value={rollMode}
            onChange={(e) => setRollMode(e.target.value as RollMode)}
            className="col-span-4 rounded-xl border border-slate-800/80 bg-slate-900/80 px-2 py-1 text-xs text-slate-200 focus:outline-none"
          >
            {ROLL_MODE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          <div className="col-span-5 flex items-center gap-1">
            <select
              value={visibility}
              onChange={(e) => setVisibility(e.target.value as RollVisibility)}
              className="flex-1 rounded-xl border border-slate-800/80 bg-slate-900/80 px-1.5 py-1 text-[11px] text-slate-300 focus:outline-none"
            >
              <option value="public">Public</option>
              <option value="gm_only">GM Only</option>
              <option value="self">Self Only</option>
            </select>

            <button
              onClick={handleRoll}
              disabled={!canRoll}
              className="flex items-center gap-1 rounded-xl bg-blue-600 px-3 py-1 text-xs font-bold text-white shadow-md shadow-blue-500/20 hover:bg-blue-500 disabled:opacity-40"
            >
              <Dices className="h-3.5 w-3.5" /> Roll!
            </button>
          </div>
        </div>

        {/* Plot Die Checkbox if enabled */}
        {plotDiceFeatureEnabled && (
          <div className="flex items-center justify-between text-xs px-1">
            <label className="flex items-center gap-1.5 text-[11px] text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={plotDieEnabled}
                onChange={(e) => setPlotDieEnabled(e.target.checked)}
                className="rounded accent-blue-600"
              />
              Use plot die
            </label>
            {hasInvalidPlotDieSelection && (
              <span className="text-[10px] text-amber-300">Plot die requires a d20</span>
            )}
          </div>
        )}
      </div>

      {/* Expanded Roll history */}
      <div className="flex-1 overflow-y-auto p-3">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Roll History
          </h3>
          {isGM && (
            <button
              type="button"
              onClick={handleClearHistory}
              className="rounded px-2 py-1 text-xs text-red-300 hover:bg-red-500/10"
            >
              Clear history
            </button>
          )}
        </div>

        {sortedRolls.length === 0 ? (
          <div className="p-4 text-center text-xs text-slate-500 italic">No dice rolls yet</div>
        ) : (
          <div className="space-y-2">
            {sortedRolls.map((roll) => (
              <DiceRollItem key={roll.id} roll={roll} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

interface DiceRollItemProps {
  roll: DiceRoll;
}

const DiceRollItem: React.FC<DiceRollItemProps> = ({ roll }) => {
  const attempts = useMemo(() => {
    const rawAttempts = (roll.rollResults as { attempts?: RollAttempt[] })?.attempts;
    if (Array.isArray(rawAttempts) && rawAttempts.length > 0) {
      return rawAttempts;
    }

    const rawRolls = (roll.rollResults as { rolls?: number[] })?.rolls;
    if (Array.isArray(rawRolls)) {
      return [
        {
          dice: [{ type: 'custom', count: rawRolls.length, results: rawRolls }],
          modifier: (roll.rollResults as { modifier?: number })?.modifier ?? 0,
          subtotal: (roll.rollResults as { total?: number })?.total ?? 0,
          total: (roll.rollResults as { total?: number })?.total ?? 0,
          plotDie: null,
        },
      ];
    }

    return [];
  }, [roll.rollResults]);

  const mode = (roll.rollResults as { mode?: RollMode })?.mode || 'normal';
  const keptAttemptIndex =
    (roll.rollResults as { keptAttemptIndex?: number })?.keptAttemptIndex ??
    (attempts.length > 1 ? 0 : 0);

  const formattedTime = useMemo(() => {
    if (!roll.createdAt) return '';
    try {
      const d = new Date(roll.createdAt);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  }, [roll.createdAt]);

  return (
    <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-2.5 text-xs space-y-1.5 shadow-sm">
      <div className="flex items-center justify-between text-slate-400">
        <span className="font-semibold text-slate-200">
          {roll.characterName || roll.username}
        </span>
        <span className="font-mono text-[10px] text-slate-500 flex items-center gap-1.5">
          {formattedTime && <span>{formattedTime}</span>}
          {formattedTime && <span>•</span>}
          <span>{roll.rollExpression}</span>
        </span>
      </div>

      <div className="space-y-1">
        {attempts.map((att, idx) => {
          const isKept = attempts.length === 1 || keptAttemptIndex === idx;
          const flatRolls = att.dice.flatMap((d) => d.results);
          const plotResult = att.plotDie ? normalizePlotDieResult(att.plotDie) : null;

          return (
            <div
              key={idx}
              className={`rounded-xl border p-2 text-xs transition-colors ${
                isKept
                  ? mode === 'advantage'
                    ? 'border-green-500/40 bg-green-500/10 text-green-200'
                    : mode === 'disadvantage'
                    ? 'border-red-500/40 bg-red-500/10 text-red-200'
                    : 'border-slate-800 bg-slate-950/60 text-slate-200'
                  : 'border-slate-800/80 bg-slate-950/40 text-slate-400 opacity-60'
              }`}
            >
              <div className="flex items-center justify-between">
                <span>Result</span>
                {isKept && mode !== 'normal' && (
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] uppercase font-bold ${
                      mode === 'advantage'
                        ? 'bg-green-500/20 text-green-200'
                        : 'bg-red-500/20 text-red-200'
                    }`}
                  >
                    {mode}
                  </span>
                )}
              </div>
              <div className="mt-1 font-mono text-[11px] text-slate-300">
                [{flatRolls.join(', ')}]
                {att.modifier !== 0 && (att.modifier > 0 ? ` + ${att.modifier}` : ` ${att.modifier}`)}
              </div>
              {plotResult && (
                <div className="mt-1 text-[10px] font-semibold text-amber-300">
                  Plot Die: {getPlotDieFaceName(plotResult.face)}
                </div>
              )}
              <div className="mt-1 text-right font-mono font-bold text-sm text-slate-100">
                = {att.total}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
