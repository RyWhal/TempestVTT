import React, { useState } from 'react';
import {
  X,
  Zap,
  Swords,
  RotateCw,
  ArrowUp,
  Sparkles,
  Eye,
  EyeOff,
  Trash2,
  Plus,
  Minus,
} from 'lucide-react';
import { useMapStore } from '../../stores/mapStore';
import { useIsGM } from '../../stores/sessionStore';
import { useCharacters } from '../../hooks/useCharacters';
import { useNPCs } from '../../hooks/useNPCs';
import type { TokenSize } from '../../types';

const STATUS_RING_OPTIONS = [
  { label: 'None', color: null },
  { label: 'Red (Hostile)', color: '#ef4444' },
  { label: 'Green (Ally)', color: '#22c55e' },
  { label: 'Blue (Invested)', color: '#3b82f6' },
  { label: 'Amber (Focus)', color: '#f59e0b' },
  { label: 'Purple (Radiant)', color: '#8b5cf6' },
];

export const TokenPopover: React.FC = () => {
  const isGM = useIsGM();
  const selectedTokenId = useMapStore((state) => state.selectedTokenId);
  const selectedTokenType = useMapStore((state) => state.selectedTokenType);
  const clearSelection = useMapStore((state) => state.clearSelection);

  const characters = useMapStore((state) => state.characters);
  const npcInstances = useMapStore((state) => state.npcInstances);

  const viewportScale = useMapStore((state) => state.viewportScale);
  const viewportX = useMapStore((state) => state.viewportX);
  const viewportY = useMapStore((state) => state.viewportY);

  const { updateCharacterDetails, deleteCharacter } = useCharacters();
  const { updateNPCInstanceDetails, removeNPCFromMap } = useNPCs();

  // Component state for hp, rotation & elevation preview
  const [hpValue, setHpValue] = useState<number>(36);
  const [maxHp] = useState<number>(36);
  const [rotation, setRotation] = useState<number>(0);
  const [elevation, setElevation] = useState<number>(0);
  const [showConditionsMenu, setShowConditionsMenu] = useState(false);

  if (!selectedTokenId || !selectedTokenType) {
    return null;
  }

  let tokenName = '';
  let tokenSize: TokenSize = 'medium';
  let isVisible = true;
  let posX = 0;
  let posY = 0;

  if (selectedTokenType === 'character') {
    const char = characters.find((c) => c.id === selectedTokenId);
    if (!char) return null;
    tokenName = char.name;
    tokenSize = char.size;
    posX = char.positionX;
    posY = char.positionY;
  } else {
    const npc = npcInstances.find((n) => n.id === selectedTokenId);
    if (!npc) return null;
    tokenName = npc.displayName || 'NPC';
    tokenSize = npc.size || 'medium';
    isVisible = npc.isVisible;
    posX = npc.positionX;
    posY = npc.positionY;
  }

  // Calculate screen position centered above the token
  const screenX = viewportX + posX * viewportScale;
  const screenY = viewportY + posY * viewportScale;

  const handleAdjustHp = (delta: number) => {
    setHpValue((prev) => Math.max(0, prev + delta));
  };

  const handleRotate = () => {
    setRotation((prev) => (prev + 45) % 360);
  };

  const handleAdjustElevation = (delta: number) => {
    setElevation((prev) => Math.max(0, prev + delta));
  };

  const handleToggleVisibility = async () => {
    if (selectedTokenType === 'npc') {
      await updateNPCInstanceDetails(selectedTokenId, { isVisible: !isVisible });
    }
  };

  const handleSetStatusColor = async (color: string | null) => {
    if (selectedTokenType === 'character') {
      await updateCharacterDetails(selectedTokenId, { statusRingColor: color });
    } else {
      await updateNPCInstanceDetails(selectedTokenId, { statusRingColor: color });
    }
  };

  const handleDelete = async () => {
    if (selectedTokenType === 'character') {
      await deleteCharacter(selectedTokenId);
    } else {
      await removeNPCFromMap(selectedTokenId);
    }
    clearSelection();
  };

  return (
    <div
      className="absolute z-40 w-72 rounded-2xl border border-slate-700/80 bg-slate-950/95 p-3.5 shadow-2xl backdrop-blur-xl text-slate-100 transition-all pointer-events-auto"
      style={{
        left: `${screenX}px`,
        top: `${screenY - 20}px`,
        transform: 'translate(-50%, -100%)',
      }}
    >
      {/* Popover Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-amber-500 shadow-sm" />
          <h3 className="text-xs font-bold text-slate-100 truncate max-w-[140px]">
            {tokenName}
          </h3>
          <span className="rounded border border-slate-700 bg-slate-800/80 px-1.5 py-0.5 font-mono text-[10px] uppercase text-slate-300">
            {tokenSize}
          </span>
        </div>
        <button
          onClick={clearSelection}
          className="rounded-md p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Hit Points Quick Adjuster */}
      <div className="mt-2.5 rounded-xl border border-slate-800/80 bg-slate-900/60 p-2.5">
        <div className="flex items-center justify-between text-xs">
          <span className="flex items-center gap-1 font-medium text-rose-400">
            ❤️ Hit Points
          </span>
          <span className="font-mono font-bold text-slate-200">
            {hpValue} / {maxHp}
          </span>
        </div>
        <div className="mt-2 grid grid-cols-6 gap-1">
          {[-10, -5, -1, 1, 5, 10].map((delta) => (
            <button
              key={delta}
              onClick={() => handleAdjustHp(delta)}
              className={`rounded-lg py-1 font-mono text-[10px] font-semibold transition-all ${
                delta < 0
                  ? 'bg-rose-950/80 text-rose-300 hover:bg-rose-900 border border-rose-800/50'
                  : 'bg-emerald-950/80 text-emerald-300 hover:bg-emerald-900 border border-emerald-800/50'
              }`}
            >
              {delta > 0 ? `+${delta}` : delta}
            </button>
          ))}
        </div>
      </div>

      {/* Phase & Initiative Action Toggles */}
      <div className="mt-2.5 grid grid-cols-2 gap-1.5">
        <button className="flex items-center justify-center gap-1 rounded-xl border border-amber-500/40 bg-amber-500/10 py-1.5 text-xs font-semibold text-amber-300 hover:bg-amber-500/20">
          <Zap className="h-3.5 w-3.5" /> FAST Phase
        </button>
        <button className="flex items-center justify-center gap-1 rounded-xl border border-blue-500/40 bg-blue-500/10 py-1.5 text-xs font-semibold text-blue-300 hover:bg-blue-500/20">
          <Swords className="h-3.5 w-3.5" /> Initiative
        </button>
      </div>

      {/* Rotation & Elevation Adjusters */}
      <div className="mt-2.5 grid grid-cols-2 gap-1.5">
        <button
          onClick={handleRotate}
          className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
        >
          <RotateCw className="h-3.5 w-3.5 text-slate-400" />
          <span>Rotate ({rotation}°)</span>
        </button>

        <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900 px-2 py-1 text-xs text-slate-300">
          <span className="flex items-center gap-1">
            <ArrowUp className="h-3 w-3 text-slate-400" />
            {elevation}ft
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => handleAdjustElevation(-5)}
              className="rounded bg-slate-800 px-1 py-0.5 hover:bg-slate-700"
            >
              <Minus className="h-3 w-3" />
            </button>
            <button
              onClick={() => handleAdjustElevation(5)}
              className="rounded bg-slate-800 px-1 py-0.5 hover:bg-slate-700"
            >
              <Plus className="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>

      {/* Conditions Section */}
      <div className="mt-2.5 border-t border-slate-800 pt-2">
        <button
          onClick={() => setShowConditionsMenu((prev) => !prev)}
          className="flex w-full items-center justify-between rounded-xl border border-slate-800 bg-slate-900/60 px-2.5 py-1.5 text-xs text-slate-300 hover:bg-slate-800/80"
        >
          <span className="flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-amber-400" />
            Conditions & Ring
          </span>
          <span className="text-[10px] font-semibold text-blue-400">Manage</span>
        </button>

        {showConditionsMenu && (
          <div className="mt-2 flex flex-wrap gap-1 rounded-xl border border-slate-800 bg-slate-950 p-2">
            {STATUS_RING_OPTIONS.map((opt) => (
              <button
                key={opt.label}
                onClick={() => void handleSetStatusColor(opt.color)}
                className="flex items-center gap-1 rounded-md border border-slate-800 bg-slate-900 px-2 py-1 text-[10px] text-slate-300 hover:bg-slate-800"
              >
                {opt.color && (
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: opt.color }}
                  />
                )}
                {opt.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Footer Controls: Visibility, Delete */}
      <div className="mt-3 flex items-center justify-between border-t border-slate-800 pt-2.5 text-xs">
        {selectedTokenType === 'npc' && isGM ? (
          <button
            onClick={() => void handleToggleVisibility()}
            className="flex items-center gap-1 text-slate-400 hover:text-slate-200"
          >
            {isVisible ? (
              <>
                <Eye className="h-3.5 w-3.5 text-emerald-400" /> Visible
              </>
            ) : (
              <>
                <EyeOff className="h-3.5 w-3.5 text-slate-500" /> Hidden
              </>
            )}
          </button>
        ) : (
          <span className="text-[11px] text-slate-500">Token Controls</span>
        )}

        <div className="flex items-center gap-2">
          <button
            onClick={handleDelete}
            title="Delete Token"
            className="rounded p-1 text-rose-400 hover:bg-rose-950/60 hover:text-rose-300"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
