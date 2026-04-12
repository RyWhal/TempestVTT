import React, { useMemo, useState } from 'react';
import { Dices, Eye, EyeOff, Lock, Star, AlertTriangle, Circle } from 'lucide-react';
import { useChat } from '../../hooks/useChat';
import { useCharacters } from '../../hooks/useCharacters';
import { useSessionStore } from '../../stores/sessionStore';
import { Button } from '../shared/Button';
import { buildDiceExpression, getPlotDieFaceName, normalizePlotDieResult } from '../../lib/dice';
import { useToast } from '../shared/Toast';
import type { DiceRoll, PlotDieFace, PlotDieResult, RollAttempt, RollMode, RollVisibility } from '../../types';

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
    <div className="h-full flex flex-col">
      {/* Dice selector */}
      <div className="p-4 border-b border-slate-700">
        <div className="mb-3">
          <label className="text-sm text-slate-400 mb-2 block">Standard Dice</label>
          <div className="grid grid-cols-6 gap-2">
            {DICE_TYPES.map((sides) => (
              <button
                key={sides}
                onClick={() => addDie(sides)}
                className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-center transition-colors"
              >
                <div className="text-sm font-medium text-slate-200">d{sides}</div>
                {dice[sides] > 0 && (
                  <div className="text-xs text-slate-400">x{dice[sides]}</div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Current roll display */}
        <div className="bg-slate-800 rounded-lg p-3 mb-3">
          <div className="flex flex-wrap gap-2 min-h-[2rem]">
            {DICE_TYPES.map(
              (sides) =>
                dice[sides] > 0 && (
                  <button
                    key={sides}
                    onClick={() => removeDie(sides)}
                    className="px-2 py-1 bg-slate-700 hover:bg-red-900/50 rounded text-sm text-slate-200 transition-colors"
                  >
                    {dice[sides]}d{sides} ×
                  </button>
                )
            )}
            {modifier !== 0 && (
              <span className="px-2 py-1 text-sm text-slate-300">
                {modifier > 0 ? `+${modifier}` : modifier}
              </span>
            )}
            {plotDiceFeatureEnabled && plotDieEnabled && (
              <span className="px-2 py-1 rounded bg-amber-500/10 text-sm text-amber-300">
                Plot Die
              </span>
            )}
            {totalDice === 0 && modifier === 0 && !plotDieEnabled && (
              <span className="text-slate-500 text-sm">
                Click dice above to add
              </span>
            )}
          </div>
        </div>

        {/* Modifier */}
        <div className="flex items-center gap-2 mb-3">
          <label className="text-sm text-slate-400">Modifier:</label>
          <button
            onClick={() => setModifier((m) => m - 1)}
            className="w-8 h-8 bg-slate-800 hover:bg-slate-700 rounded text-slate-200"
          >
            -
          </button>
          <input
            type="number"
            value={modifier}
            onChange={(e) => setModifier(parseInt(e.target.value) || 0)}
            className="w-16 px-2 py-1 bg-slate-800 border border-slate-600 rounded text-center text-slate-200"
          />
          <button
            onClick={() => setModifier((m) => m + 1)}
            className="w-8 h-8 bg-slate-800 hover:bg-slate-700 rounded text-slate-200"
          >
            +
          </button>
        </div>

        {/* Roll mode */}
        <div className="flex items-center gap-2 mb-3">
          <label className="text-sm text-slate-400">Mode:</label>
          <select
            value={rollMode}
            onChange={(e) => setRollMode(e.target.value as RollMode)}
            className="flex-1 px-2 py-1 bg-slate-800 border border-slate-600 rounded text-slate-200"
          >
            {ROLL_MODE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {/* Plot die (Stormlight system) */}
        {plotDiceFeatureEnabled && (
          <div className="mb-3 rounded-lg border border-slate-700 bg-slate-900/40 p-3">
            <label className="flex items-center gap-2 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={plotDieEnabled}
                onChange={(e) => setPlotDieEnabled(e.target.checked)}
                aria-label="Use plot die"
              />
              Use plot die
            </label>
            <p className="mt-1 text-xs text-slate-500">
              Adds a single Stormlight plot die to the roll when a d20 is present.
            </p>
            {hasInvalidPlotDieSelection && (
              <p className="mt-2 text-xs text-amber-300">
                Plot die requires a d20 in the selected roll.
              </p>
            )}
          </div>
        )}

        {/* Visibility */}
        <div className="flex items-center gap-2 mb-4">
          <label className="text-sm text-slate-400">Visibility:</label>
          <select
            value={visibility}
            onChange={(e) => setVisibility(e.target.value as RollVisibility)}
            className="flex-1 px-2 py-1 bg-slate-800 border border-slate-600 rounded text-slate-200"
          >
            <option value="public">Public</option>
            <option value="gm_only">GM Only</option>
            <option value="self">Self Only</option>
          </select>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Button variant="ghost" onClick={clearDice} className="flex-1">
            Clear
          </Button>
          <Button
            variant="primary"
            onClick={handleRoll}
            disabled={!canRoll}
            isLoading={isRolling}
            className="flex-1"
          >
            <Dices className="w-4 h-4 mr-2" />
            Roll!
          </Button>
        </div>
      </div>

      {/* Roll history */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="text-sm font-medium text-slate-400">Roll History</h3>
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
          <p className="text-slate-500 text-sm text-center py-4">
            No rolls yet
          </p>
        ) : (
          <div className="space-y-3">
            {[...diceRolls].reverse().map((roll, idx) => (
              <DiceRollEntry
                key={roll.id}
                roll={roll}
                isNew={idx === 0}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

interface DiceRollEntryProps {
  roll: DiceRoll;
  isNew: boolean;
}

const getSelectedAttemptPresentation = (rollMode: RollMode, isSelected: boolean) => {
  if (!isSelected || rollMode === 'normal') {
    return {
      attemptClassName: 'border-slate-700 bg-slate-900/40',
      badgeLabel: null,
      badgeClassName: '',
    };
  }

  if (rollMode === 'advantage') {
    return {
      attemptClassName: 'border-green-500/40 bg-green-500/10',
      badgeLabel: 'Advantage',
      badgeClassName: 'rounded bg-green-500/20 px-2 py-0.5 text-green-200',
    };
  }

  return {
    attemptClassName: 'border-red-500/40 bg-red-500/10',
    badgeLabel: 'Disadvantage',
    badgeClassName: 'rounded bg-red-500/20 px-2 py-0.5 text-red-200',
  };
};

const DiceRollEntry: React.FC<DiceRollEntryProps> = ({ roll, isNew }) => {
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);

    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return date.toLocaleDateString();
  };

  const visibilityIcon = {
    public: <Eye className="w-3 h-3" />,
    gm_only: <Lock className="w-3 h-3" />,
    self: <EyeOff className="w-3 h-3" />,
  };

  const rollMode = roll.rollResults.mode ?? 'normal';
  const legacyPlotDie = roll.plotDiceResults?.[0] ?? roll.rollResults.plotDie ?? null;
  const attempts: RollAttempt[] =
    roll.rollResults.attempts && roll.rollResults.attempts.length > 0
      ? roll.rollResults.attempts
      : [
          {
            dice: roll.rollResults.dice,
            modifier: roll.rollResults.modifier,
            subtotal:
              roll.rollResults.total -
              (legacyPlotDie ? normalizePlotDieResult(legacyPlotDie as PlotDieResult).bonus : 0),
            total: roll.rollResults.total,
            plotDie: legacyPlotDie as PlotDieResult | null,
          },
        ];
  const keptAttemptIndex = roll.rollResults.keptAttemptIndex ?? 0;

  return (
    <div
      className={`
        bg-slate-800/50 rounded-lg p-3 border border-slate-700
        ${isNew ? 'animate-roll-appear' : ''}
      `}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="font-medium text-slate-200">{roll.username}</span>
          {roll.characterName && (
            <span className="text-slate-400 text-sm">
              ({roll.characterName})
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-slate-500">
          {visibilityIcon[roll.visibility]}
          <span className="text-xs">{formatTime(roll.createdAt)}</span>
        </div>
      </div>

      {/* Roll results */}
      <div className="mb-2 flex items-center justify-between text-xs uppercase tracking-wide text-slate-500">
        <span>{rollMode}</span>
        <span>{roll.rollExpression}</span>
      </div>

      <div className="space-y-2">
        {attempts.map((attempt, index) => {
          const plotDie = attempt.plotDie
            ? normalizePlotDieResult(attempt.plotDie as PlotDieResult)
            : null;
          const selectedAttemptPresentation = getSelectedAttemptPresentation(
            rollMode,
            index === keptAttemptIndex
          );

          return (
            <div
              key={`${roll.id}-attempt-${index}`}
              className={`rounded border px-2 py-2 text-sm ${selectedAttemptPresentation.attemptClassName}`}
            >
              <div className="mb-1 flex items-center justify-between text-xs text-slate-400">
                <span>{attempts.length > 1 ? `Attempt ${index + 1}` : 'Result'}</span>
                {selectedAttemptPresentation.badgeLabel && (
                  <span className={selectedAttemptPresentation.badgeClassName}>
                    {selectedAttemptPresentation.badgeLabel}
                  </span>
                )}
              </div>
              <div className="text-slate-300">
                {attempt.dice.map((die, dieIndex) => (
                  <span key={dieIndex}>
                    {dieIndex > 0 && ' + '}
                    <span className="text-slate-100">[{die.results.join(', ')}]</span>
                  </span>
                ))}
                {attempt.modifier !== 0 && (
                  <span>
                    {attempt.modifier > 0 ? ' + ' : ' - '}
                    {Math.abs(attempt.modifier)}
                  </span>
                )}
              </div>
              {plotDie && (
                <div className="mt-2 flex items-center gap-2">
                  <PlotDieDisplay face={plotDie.face} />
                  {plotDie.bonus > 0 && (
                    <span className="text-xs text-amber-300">Bonus +{plotDie.bonus}</span>
                  )}
                </div>
              )}
              <div className="mt-2 text-lg font-semibold text-slate-100">
                = {attempt.total}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const PlotDieDisplay: React.FC<{ face: PlotDieFace }> = ({ face }) => {
  const plotDie = normalizePlotDieResult({ face });
  const config =
    plotDie.kind === 'opportunity'
      ? {
          icon: <Star className="w-4 h-4" />,
          bg: 'bg-green-900/50',
          border: 'border-green-600',
          text: 'text-green-400',
        }
      : plotDie.kind === 'complication'
        ? {
            icon: <AlertTriangle className="w-4 h-4" />,
            bg: 'bg-red-900/50',
            border: 'border-red-600',
            text: 'text-red-400',
          }
        : {
            icon: <Circle className="w-4 h-4" />,
            bg: 'bg-slate-700/50',
            border: 'border-slate-600',
            text: 'text-slate-400',
          };

  const { icon, bg, border, text } = config;

  return (
    <div
      className={`flex items-center gap-1 px-2 py-1 rounded border ${bg} ${border} ${text}`}
      title={getPlotDieFaceName(face)}
    >
      {icon}
      <span className="text-xs">{getPlotDieFaceName(face)}</span>
    </div>
  );
};
