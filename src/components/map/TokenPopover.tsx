import React, { useState } from 'react';
import {
  X,
  Zap,
  Eye,
  EyeOff,
  Trash2,
  Plus,
  Tag,
} from 'lucide-react';
import { useMapStore } from '../../stores/mapStore';
import { useIsGM, useSessionStore } from '../../stores/sessionStore';
import { useCharacters } from '../../hooks/useCharacters';
import { useNPCs } from '../../hooks/useNPCs';
import type { TokenSize } from '../../types';

import { parseNPCHp, formatNPCHp } from '../../lib/npcHp';

const SIZE_OPTIONS: TokenSize[] = ['tiny', 'small', 'medium', 'large', 'huge', 'gargantuan'];

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
  const session = useSessionStore((state) => state.session);
  const enableInitiativePhase = Boolean(session?.enableInitiativePhase);

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

  // Local state for phase & status tags
  const [phase, setPhase] = useState<'fast' | 'slow'>('fast');
  const [customTagInput, setCustomTagInput] = useState('');
  const [statusTags, setStatusTags] = useState<string[]>([]);
  const [showConditionsMenu, setShowConditionsMenu] = useState(false);

  if (!selectedTokenId || !selectedTokenType) {
    return null;
  }

  let tokenName = '';
  let tokenSize: TokenSize = 'medium';
  let isVisible = true;
  let posX = 0;
  let posY = 0;
  let rawNotes = '';

  if (selectedTokenType === 'character') {
    const char = characters.find((c) => c.id === selectedTokenId);
    if (!char) return null;
    tokenName = char.name;
    tokenSize = char.size;
    posX = char.positionX;
    posY = char.positionY;
    rawNotes = char.notes || '';
  } else {
    const npc = npcInstances.find((n) => n.id === selectedTokenId);
    if (!npc) return null;
    tokenName = npc.displayName || 'NPC';
    tokenSize = npc.size || 'medium';
    isVisible = npc.isVisible;
    posX = npc.positionX;
    posY = npc.positionY;
    rawNotes = npc.notes || '';
  }

  const hpState = parseNPCHp(rawNotes, 30);

  // Position popover centered above token on map
  const screenX = viewportX + posX * viewportScale;
  const screenY = viewportY + posY * viewportScale;

  const handleAdjustHp = async (delta: number) => {
    const nextHp = Math.max(0, hpState.hp + delta);
    const updatedNotes = formatNPCHp(nextHp, hpState.maxHp, hpState.notes);
    if (selectedTokenType === 'character') {
      await updateCharacterDetails(selectedTokenId, { notes: updatedNotes });
    } else {
      await updateNPCInstanceDetails(selectedTokenId, { notes: updatedNotes });
    }
  };

  const handleRename = async (newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    if (selectedTokenType === 'character') {
      await updateCharacterDetails(selectedTokenId, { name: trimmed });
    } else {
      await updateNPCInstanceDetails(selectedTokenId, { displayName: trimmed });
    }
  };

  const handleChangeSize = async (newSize: TokenSize) => {
    if (selectedTokenType === 'character') {
      await updateCharacterDetails(selectedTokenId, { size: newSize });
    } else {
      await updateNPCInstanceDetails(selectedTokenId, { size: newSize });
    }
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

  const handleAddCustomTag = () => {
    const trimmed = customTagInput.trim();
    if (!trimmed || statusTags.includes(trimmed)) return;
    setStatusTags((prev) => [...prev, trimmed]);
    setCustomTagInput('');
  };

  const handleRemoveTag = (tag: string) => {
    setStatusTags((prev) => prev.filter((t) => t !== tag));
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
      {/* 1. Header: Name (Editable) & Size (Editable) */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2.5 gap-2">
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <input
            type="text"
            defaultValue={tokenName}
            onBlur={(e) => handleRename(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleRename(e.currentTarget.value);
                e.currentTarget.blur();
              }
            }}
            className="w-full truncate rounded bg-transparent px-1 font-bold text-xs text-slate-100 focus:bg-slate-900 focus:outline-none border border-transparent focus:border-slate-700"
          />
        </div>

        <select
          value={tokenSize}
          onChange={(e) => handleChangeSize(e.target.value as TokenSize)}
          className="rounded border border-slate-700 bg-slate-900 px-1.5 py-0.5 font-mono text-[10px] uppercase text-slate-200 focus:outline-none"
        >
          {SIZE_OPTIONS.map((sz) => (
            <option key={sz} value={sz}>
              {sz}
            </option>
          ))}
        </select>

        <button
          onClick={clearSelection}
          className="rounded-md p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* 2. Hit Points Tracking (GM Only) */}
      {isGM && (
        <div className="mt-2.5 rounded-xl border border-slate-800/80 bg-slate-900/60 p-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1 font-medium text-rose-400">
              ❤️ Hit Points
            </span>
            <span className="font-mono font-bold text-slate-200">
              {hpState.hp} / {hpState.maxHp}
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
      )}

      {/* 3. Fast / Slow Phase Toggle (If Stormlight Initiative Phase turned on) */}
      {enableInitiativePhase && (
        <div className="mt-2.5 flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900 p-1">
          <button
            onClick={() => setPhase('fast')}
            className={`flex-1 flex items-center justify-center gap-1 rounded-lg py-1 text-xs font-semibold transition-all ${
              phase === 'fast'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Zap className="h-3 w-3" /> FAST Phase
          </button>
          <button
            onClick={() => setPhase('slow')}
            className={`flex-1 flex items-center justify-center gap-1 rounded-lg py-1 text-xs font-semibold transition-all ${
              phase === 'slow'
                ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            SLOW Phase
          </button>
        </div>
      )}

      {/* 4. Status Conditions & Color Rings (Editable Custom Tags) */}
      <div className="mt-2.5 border-t border-slate-800 pt-2">
        <button
          onClick={() => setShowConditionsMenu((prev) => !prev)}
          className="flex w-full items-center justify-between rounded-xl border border-slate-800 bg-slate-900/60 px-2.5 py-1.5 text-xs text-slate-300 hover:bg-slate-800/80"
        >
          <span className="flex items-center gap-1.5 font-medium">
            <Tag className="h-3.5 w-3.5 text-amber-400" />
            Status Conditions & Ring
          </span>
          <span className="text-[10px] font-semibold text-blue-400">
            {showConditionsMenu ? 'Hide' : 'Manage'}
          </span>
        </button>

        {showConditionsMenu && (
          <div className="mt-2 space-y-2 rounded-xl border border-slate-800 bg-slate-950 p-2.5">
            {/* Color Rings */}
            <div className="flex items-center justify-between px-1">
              <span className="text-[10px] font-semibold text-slate-400 uppercase">Ring Color</span>
              <div className="flex items-center gap-1.5">
                {STATUS_RING_OPTIONS.map((opt) => (
                  <button
                    key={opt.label}
                    onClick={() => void handleSetStatusColor(opt.color)}
                    title={opt.label}
                    className="h-4 w-4 rounded-full border border-slate-700 hover:scale-110 transition-transform"
                    style={{ backgroundColor: opt.color || '#334155' }}
                  />
                ))}
              </div>
            </div>

            {/* Custom Status Tags */}
            <div className="pt-2 border-t border-slate-800">
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  value={customTagInput}
                  onChange={(e) => setCustomTagInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddCustomTag()}
                  placeholder="Add custom status (e.g. Stunned)..."
                  className="flex-1 rounded-lg border border-slate-800 bg-slate-900 px-2 py-1 text-xs text-slate-200 placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                />
                <button
                  onClick={handleAddCustomTag}
                  className="rounded-lg bg-blue-600 px-2 py-1 text-xs font-semibold text-white hover:bg-blue-500"
                >
                  <Plus className="h-3 w-3" />
                </button>
              </div>

              {statusTags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {statusTags.map((tag) => (
                    <span
                      key={tag}
                      onClick={() => handleRemoveTag(tag)}
                      className="inline-flex items-center gap-1 rounded-full bg-slate-800 px-2 py-0.5 text-[10px] text-slate-200 cursor-pointer hover:bg-rose-950 hover:text-rose-300"
                      title="Click to remove"
                    >
                      {tag} ×
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 5. Visibility (GM Only) & Delete */}
      {isGM && (
        <div className="mt-2.5 flex items-center justify-between border-t border-slate-800 pt-2.5">
          <button
            onClick={handleToggleVisibility}
            className={`flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium transition-all ${
              isVisible
                ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30'
                : 'bg-amber-500/10 text-amber-300 border border-amber-500/30'
            }`}
          >
            {isVisible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
            {isVisible ? 'Visible to Players' : 'Hidden from Players'}
          </button>

          <button
            onClick={handleDelete}
            title="Delete Token"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-950 hover:text-rose-300 transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};
