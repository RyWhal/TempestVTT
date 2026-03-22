import React, { useState } from 'react';
import { Dices, Eye, EyeOff, Lock, Star, AlertTriangle, Circle } from 'lucide-react';
import { useChat } from '../../hooks/useChat';
import { useCharacters } from '../../hooks/useCharacters';
import { useSessionStore } from '../../stores/sessionStore';
import { Button } from '../shared/Button';
import { buildDiceExpression, getPlotDieFaceName } from '../../lib/dice';
import type { RollVisibility, PlotDieFace } from '../../types';

const DICE_TYPES = [4, 6, 8, 10, 12, 20] as const;

export const DicePanel: React.FC = () => {
  const { diceRolls, rollDice } = useChat();
  const { myCharacter } = useCharacters();
  const session = useSessionStore((state) => state.session);
  const plotDiceEnabled = Boolean(session?.enablePlotDice);

  const [dice, setDice] = useState<Record<number, number>>({});
  const [modifier, setModifier] = useState(0);
  const [plotDiceCount, setPlotDiceCount] = useState(0);
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
    setPlotDiceCount(0);
  };

  const handleRoll = async () => {
    const expression = buildDiceExpression(dice, modifier);
    const effectivePlotDiceCount = plotDiceEnabled ? plotDiceCount : 0;
    if (expression === '0' && effectivePlotDiceCount === 0) return;

    setIsRolling(true);
    await rollDice(
      expression || '0',
      visibility,
      effectivePlotDiceCount,
      myCharacter?.name
    );
    setIsRolling(false);
  };

  const totalDice = Object.values(dice).reduce((a, b) => a + b, 0);

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
            {totalDice === 0 && modifier === 0 && (!plotDiceEnabled || plotDiceCount === 0) && (
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

        {/* Plot dice (Tempest system) */}
        {plotDiceEnabled && (
        <div className="flex items-center gap-2 mb-3">
          <label className="text-sm text-slate-400">Plot Dice:</label>
          <button
            onClick={() => setPlotDiceCount((c) => Math.max(0, c - 1))}
            className="w-8 h-8 bg-slate-800 hover:bg-slate-700 rounded text-slate-200"
          >
            -
          </button>
          <span className="w-8 text-center text-slate-200">{plotDiceCount}</span>
          <button
            onClick={() => setPlotDiceCount((c) => Math.min(5, c + 1))}
            className="w-8 h-8 bg-slate-800 hover:bg-slate-700 rounded text-slate-200"
          >
            +
          </button>
          <span className="text-xs text-slate-500">(Tempest RPG)</span>
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
            disabled={isRolling || (totalDice === 0 && modifier === 0 && (!plotDiceEnabled || plotDiceCount === 0))}
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
        <h3 className="text-sm font-medium text-slate-400 mb-3">Roll History</h3>

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
  roll: {
    username: string;
    characterName: string | null;
    rollExpression: string;
    rollResults: {
      dice: { type: string; count: number; results: number[] }[];
      modifier: number;
      total: number;
    };
    visibility: RollVisibility;
    plotDiceResults: { face: PlotDieFace }[] | null;
    createdAt: string;
  };
  isNew: boolean;
}

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
      <div className="text-sm text-slate-300 mb-1">
        <span className="text-slate-400">{roll.rollExpression}:</span>{' '}
        {roll.rollResults.dice.map((d, i) => (
          <span key={i}>
            {i > 0 && ' + '}
            <span className="text-slate-100">[{d.results.join(', ')}]</span>
          </span>
        ))}
        {roll.rollResults.modifier !== 0 && (
          <span>
            {roll.rollResults.modifier > 0 ? ' + ' : ' - '}
            {Math.abs(roll.rollResults.modifier)}
          </span>
        )}
      </div>

      <div className="text-xl font-bold text-slate-100">
        = {roll.rollResults.total}
      </div>

      {/* Plot dice results */}
      {roll.plotDiceResults && roll.plotDiceResults.length > 0 && (
        <div className="mt-2 pt-2 border-t border-slate-700">
          <span className="text-sm text-slate-400">Plot Dice: </span>
          <div className="flex gap-2 mt-1">
            {roll.plotDiceResults.map((pd, i) => (
              <PlotDieDisplay key={i} face={pd.face} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const PlotDieDisplay: React.FC<{ face: PlotDieFace }> = ({ face }) => {
  const config = {
    opportunity: {
      icon: <Star className="w-4 h-4" />,
      bg: 'bg-green-900/50',
      border: 'border-green-600',
      text: 'text-green-400',
    },
    complication: {
      icon: <AlertTriangle className="w-4 h-4" />,
      bg: 'bg-red-900/50',
      border: 'border-red-600',
      text: 'text-red-400',
    },
    blank: {
      icon: <Circle className="w-4 h-4" />,
      bg: 'bg-slate-700/50',
      border: 'border-slate-600',
      text: 'text-slate-400',
    },
  };

  const { icon, bg, border, text } = config[face];

  return (
    <div
      className={`flex items-center gap-1 px-2 py-1 rounded border ${bg} ${border} ${text}`}
      title={getPlotDieFaceName(face)}
    >
      {icon}
      <span className="text-xs capitalize">{face}</span>
    </div>
  );
};
