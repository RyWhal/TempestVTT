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

  return (
    <div className="h-full flex flex-col bg-slate-900/95 text-slate-100">
      {/* Slimmed-down dice controls header */}
      <div className="p-3 border-b border-slate-800 space-y-2">
        {/* Dice Type Row */}
        <div className="grid grid-cols-6 gap-1.5">
          {DICE_TYPES.map((sides) => (
            <button
              key={sides}
              onClick={() => addDie(sides)}
              className={`relative py-1.5 px-1 rounded-xl text-center border transition-all ${
                (dice[sides] || 0) > 0
                  ? 'bg-blue-600/20 border-blue-500/40 text-blue-200'
                  : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:bg-slate-800'
              }`}
            >
              <div className="text-xs font-bold font-mono">d{sides}</div>
              {dice[sides] > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 font-mono text-[9px] font-bold text-white shadow-sm">
                  {dice[sides]}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Selected Dice Formula & Clear Bar */}
        <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950 px-2.5 py-1 text-xs">
          <div className="flex flex-wrap items-center gap-1 min-h-[1.25rem]">
            {DICE_TYPES.map(
              (sides) =>
                dice[sides] > 0 && (
                  <button
                    key={sides}
                    onClick={() => removeDie(sides)}
                    className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[11px] text-blue-300 hover:bg-rose-950 hover:text-rose-300"
                  >
                    {dice[sides]}d{sides} ×
                  </button>
                )
            )}
            {modifier !== 0 && (
              <span className="font-mono text-xs font-semibold text-slate-300">
                {modifier > 0 ? `+${modifier}` : modifier}
              </span>
            )}
            {plotDiceFeatureEnabled && plotDieEnabled && (
              <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-medium text-amber-300 border border-amber-500/30">
                Plot Die
              </span>
            )}
            {totalDice === 0 && modifier === 0 && !plotDieEnabled && (
              <span className="text-[11px] text-slate-500">Tap dice above to build roll</span>
            )}
          </div>
          {(totalDice > 0 || modifier !== 0 || plotDieEnabled) && (
            <button
              onClick={clearDice}
              className="text-[11px] text-slate-400 hover:text-slate-200"
            >
              Clear
            </button>
          )}
        </div>

        {/* Modifiers & Roll Options Row */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          {/* Left: Modifier & Mode */}
          <div className="flex items-center gap-1.5">
            <div className="flex items-center rounded-xl border border-slate-800 bg-slate-950 p-0.5">
              <button
                onClick={() => setModifier((m) => m - 1)}
                className="w-5 h-5 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-bold"
              >
                -
              </button>
              <input
                type="number"
                aria-label="Modifier"
                value={modifier}
                onChange={(e) => setModifier(parseInt(e.target.value, 10) || 0)}
                className="w-8 bg-transparent text-center font-mono font-bold text-xs text-slate-200 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <button
                onClick={() => setModifier((m) => m + 1)}
                className="w-5 h-5 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-bold"
              >
                +
              </button>
            </div>

            <select
              value={rollMode}
              onChange={(e) => setRollMode(e.target.value as RollMode)}
              className="flex-1 rounded-xl border border-slate-800 bg-slate-950 px-2 py-1 text-xs text-slate-200 focus:outline-none"
            >
              {ROLL_MODE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* Right: Visibility & Roll Button */}
          <div className="flex items-center gap-1.5">
            <select
              value={visibility}
              onChange={(e) => setVisibility(e.target.value as RollVisibility)}
              className="flex-1 rounded-xl border border-slate-800 bg-slate-950 px-2 py-1 text-xs text-slate-200 focus:outline-none"
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

        {diceRolls.length === 0 ? (
          <div className="p-4 text-center text-xs text-slate-500">No dice rolls yet</div>
        ) : (
          <div className="space-y-2">
            {diceRolls.map((roll) => (
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

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-2.5 text-xs space-y-1.5">
      <div className="flex items-center justify-between text-slate-400">
        <span className="font-semibold text-slate-200">
          {roll.characterName || roll.username}
        </span>
        <span className="font-mono text-[10px] text-slate-500">{roll.rollExpression}</span>
      </div>

      <div className="space-y-1">
        {attempts.map((att, idx) => {
          const isKept = attempts.length === 1 || keptAttemptIndex === idx;
          const flatRolls = att.dice.flatMap((d) => d.results);
          const plotResult = att.plotDie ? normalizePlotDieResult(att.plotDie) : null;

          return (
            <div
              key={idx}
              className={`rounded-lg border p-2 text-xs transition-colors ${
                isKept
                  ? mode === 'advantage'
                    ? 'border-green-500/40 bg-green-500/10 text-green-200'
                    : mode === 'disadvantage'
                    ? 'border-red-500/40 bg-red-500/10 text-red-200'
                    : 'border-slate-700 bg-slate-900/40 text-slate-200'
                  : 'border-slate-800/80 bg-slate-900/40 text-slate-400 opacity-60'
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
