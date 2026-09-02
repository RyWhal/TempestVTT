import React, { useState } from 'react';
import { Trash2, Zap, Clock, Eye, EyeOff, Plus } from 'lucide-react';
import { useInitiative } from '../../hooks/useInitiative';
import { useCharacters } from '../../hooks/useCharacters';
import { useSessionStore } from '../../stores/sessionStore';
import { useToast } from '../shared/Toast';
import type { InitiativeEntry, InitiativePhase, InitiativeVisibility } from '../../types';
import { Button } from '../shared/Button';

interface InitiativePanelProps {
  gmView?: boolean;
}

export const InitiativePanel: React.FC<InitiativePanelProps> = () => {
  const { showToast } = useToast();
  const currentUser = useSessionStore((state) => state.currentUser);
  const session = useSessionStore((state) => state.session);
  const isGM = currentUser?.isGm ?? false;
  const phaseEnabled = Boolean(session?.enableInitiativePhase);

  const {
    entries,
    groupedEntries,
    currentMapNpcs,
    setPhaseForParticipant,
    updateEntry,
    deleteEntry,
    clearTracker,
  } = useInitiative();

  const { myCharacter } = useCharacters();

  const [selectedNpcIds, setSelectedNpcIds] = useState<string[]>([]);
  const [defaultNpcPhase, setDefaultNpcPhase] = useState<InitiativePhase>('fast');
  const [defaultNpcVisibility, setDefaultNpcVisibility] = useState<InitiativeVisibility>('public');

  // Player toggle phase handler
  const handlePlayerTogglePhase = async (nextPhase: InitiativePhase) => {
    if (!myCharacter && !currentUser) return;
    const sourceName = myCharacter?.name || currentUser?.username || 'Player';
    const result = await setPhaseForParticipant(
      {
        sourceType: 'player',
        sourceId: myCharacter?.id || null,
        sourceName,
      },
      nextPhase,
      'public'
    );

    if (result.success) {
      showToast(`Switched to ${nextPhase.toUpperCase()} phase (${nextPhase === 'fast' ? '2 actions' : '3 actions'})`, 'success');
    } else {
      showToast(result.error || 'Failed to update phase', 'error');
    }
  };

  // GM Add NPCs handler
  const handleAddNpcsToInitiative = async () => {
    if (selectedNpcIds.length === 0) return;

    for (const npcId of selectedNpcIds) {
      const npc = currentMapNpcs.find((n) => n.id === npcId);
      if (npc) {
        await setPhaseForParticipant(
          {
            sourceType: 'npc',
            sourceId: npc.id,
            sourceName: npc.displayName || 'NPC',
          },
          defaultNpcPhase,
          defaultNpcVisibility
        );
      }
    }
    setSelectedNpcIds([]);
    showToast('Added NPCs to initiative', 'success');
  };

  const handleClear = async () => {
    if (!confirm('Clear the full initiative tracker for all participants?')) return;
    const result = await clearTracker();
    if (result.success) showToast('Initiative tracker cleared', 'success');
    else showToast(result.error || 'Failed to clear tracker', 'error');
  };

  const handleToggleEntryVisibility = async (entry: InitiativeEntry) => {
    const nextVis: InitiativeVisibility = entry.visibility === 'public' ? 'gm_only' : 'public';
    const result = await updateEntry(entry.id, { visibility: nextVis });
    if (!result.success) {
      showToast(result.error || 'Failed to update visibility', 'error');
    }
  };

  const handleToggleEntryPhase = async (entry: InitiativeEntry) => {
    const nextPhase: InitiativePhase = entry.phase === 'fast' ? 'slow' : 'fast';
    const result = await updateEntry(entry.id, { phase: nextPhase });
    if (!result.success) {
      showToast(result.error || 'Failed to update phase', 'error');
    }
  };

  // If Stormlight / Cosmere RPG Initiative Phase System is ENABLED
  if (phaseEnabled) {
    return (
      <div className="h-full overflow-y-auto p-3.5 space-y-4 text-slate-100 bg-slate-950/80 backdrop-blur-2xl">
        {/* Player Fast/Slow Selection Card */}
        {myCharacter && (
          <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-3 shadow-lg space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300">Your Action Phase</span>
              <span className="font-semibold text-xs text-amber-400">{myCharacter.name}</span>
            </div>
            <p className="text-[11px] text-slate-400">
              Choose your speed for this round. Fast turns go first with 2 actions; Slow turns wait for 3 actions.
            </p>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                onClick={() => handlePlayerTogglePhase('fast')}
                className={`flex flex-col items-center justify-center rounded-xl p-2 border transition-all ${
                  entries.some((e) => e.sourceId === myCharacter.id && e.phase === 'fast')
                    ? 'border-amber-500/80 bg-amber-500/20 text-amber-300 font-bold shadow-md shadow-amber-500/10'
                    : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center gap-1 text-xs">
                  <Zap className="h-3.5 w-3.5" /> FAST Turn
                </div>
                <span className="text-[10px] opacity-80 mt-0.5">2 Actions</span>
              </button>

              <button
                onClick={() => handlePlayerTogglePhase('slow')}
                className={`flex flex-col items-center justify-center rounded-xl p-2 border transition-all ${
                  entries.some((e) => e.sourceId === myCharacter.id && e.phase === 'slow')
                    ? 'border-blue-500/80 bg-blue-600/20 text-blue-300 font-bold shadow-md shadow-blue-500/10'
                    : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center gap-1 text-xs">
                  <Clock className="h-3.5 w-3.5" /> SLOW Turn
                </div>
                <span className="text-[10px] opacity-80 mt-0.5">3 Actions</span>
              </button>
            </div>
          </div>
        )}

        {/* GM NPC Adder Control */}
        {isGM && (
          <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-3 shadow-lg space-y-2.5">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                GM: Add Map NPCs
              </h3>
              <button
                onClick={handleClear}
                className="text-[11px] text-rose-400 hover:text-rose-300 underline"
              >
                Clear all
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <label className="text-[11px] text-slate-400 block">
                Default Phase
                <select
                  value={defaultNpcPhase}
                  onChange={(e) => setDefaultNpcPhase(e.target.value as InitiativePhase)}
                  className="w-full mt-1 rounded-xl border border-slate-800 bg-slate-900 px-2 py-1 text-slate-200 focus:outline-none"
                >
                  <option value="fast">Fast (2 Actions)</option>
                  <option value="slow">Slow (3 Actions)</option>
                </select>
              </label>

              <label className="text-[11px] text-slate-400 block">
                Player Visibility
                <select
                  value={defaultNpcVisibility}
                  onChange={(e) => setDefaultNpcVisibility(e.target.value as InitiativeVisibility)}
                  className="w-full mt-1 rounded-xl border border-slate-800 bg-slate-900 px-2 py-1 text-slate-200 focus:outline-none"
                >
                  <option value="public">Public</option>
                  <option value="gm_only">GM Only</option>
                </select>
              </label>
            </div>

            <div className="max-h-28 overflow-y-auto space-y-1 border border-slate-800 rounded-xl p-2 bg-slate-900/40">
              {currentMapNpcs.length === 0 ? (
                <p className="text-[11px] text-slate-500 text-center py-1">No NPCs on active map</p>
              ) : (
                currentMapNpcs.map((npc) => (
                  <label key={npc.id} className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedNpcIds.includes(npc.id)}
                      onChange={(e) =>
                        setSelectedNpcIds((prev) =>
                          e.target.checked ? [...prev, npc.id] : prev.filter((id) => id !== npc.id)
                        )
                      }
                      className="rounded accent-amber-500"
                    />
                    <span className="truncate">{npc.displayName || 'NPC'}</span>
                  </label>
                ))
              )}
            </div>

            <Button
              onClick={handleAddNpcsToInitiative}
              disabled={selectedNpcIds.length === 0}
              size="sm"
              className="w-full"
            >
              <Plus className="h-3.5 w-3.5 mr-1" /> Add Selected to Initiative
            </Button>
          </div>
        )}

        {/* 4-PHASE TURN ORDER DISPLAY */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
            <span>Cosmere Round Initiative</span>
            <span className="text-[10px] text-slate-500 lowercase">4-phase turn order</span>
          </h3>

          {/* Phase 1: Fast PCs */}
          <PhaseSection
            title="1. Fast Player Characters (PCs)"
            subtitle="2 Actions · First to act"
            icon={<Zap className="h-3.5 w-3.5 text-amber-400" />}
            badgeColor="bg-amber-500/10 border-amber-500/30 text-amber-300"
            entries={groupedEntries.fastPcs}
            isGM={isGM}
            onTogglePhase={handleToggleEntryPhase}
            onToggleVisibility={handleToggleEntryVisibility}
            onDelete={deleteEntry}
          />

          {/* Phase 2: Fast Enemies / NPCs */}
          <PhaseSection
            title="2. Fast Enemies & NPCs"
            subtitle="2 Actions · Acts after Fast PCs"
            icon={<Zap className="h-3.5 w-3.5 text-rose-400" />}
            badgeColor="bg-rose-500/10 border-rose-500/30 text-rose-300"
            entries={groupedEntries.fastNpcs}
            isGM={isGM}
            onTogglePhase={handleToggleEntryPhase}
            onToggleVisibility={handleToggleEntryVisibility}
            onDelete={deleteEntry}
          />

          {/* Phase 3: Slow PCs */}
          <PhaseSection
            title="3. Slow Player Characters (PCs)"
            subtitle="3 Actions · Extra power after Fast phase"
            icon={<Clock className="h-3.5 w-3.5 text-blue-400" />}
            badgeColor="bg-blue-500/10 border-blue-500/30 text-blue-300"
            entries={groupedEntries.slowPcs}
            isGM={isGM}
            onTogglePhase={handleToggleEntryPhase}
            onToggleVisibility={handleToggleEntryVisibility}
            onDelete={deleteEntry}
          />

          {/* Phase 4: Slow Enemies / NPCs */}
          <PhaseSection
            title="4. Slow Enemies & NPCs"
            subtitle="3 Actions · Last to act in round"
            icon={<Clock className="h-3.5 w-3.5 text-purple-400" />}
            badgeColor="bg-purple-500/10 border-purple-500/30 text-purple-300"
            entries={groupedEntries.slowNpcs}
            isGM={isGM}
            onTogglePhase={handleToggleEntryPhase}
            onToggleVisibility={handleToggleEntryVisibility}
            onDelete={deleteEntry}
          />
        </div>
      </div>
    );
  }

  // Fallback Classic d20 Roll Initiative View (When phaseEnabled === false)
  return (
    <div className="h-full overflow-y-auto p-4 space-y-4 text-slate-100 bg-slate-900/95">
      <div className="bg-slate-950/80 rounded-2xl border border-slate-800 p-3 space-y-2">
        <h3 className="font-semibold text-xs text-slate-200">Classic d20 Initiative</h3>
        <p className="text-[11px] text-slate-400">
          Enable Stormlight Initiative in Session Settings to use 4-phase Fast/Slow side initiative.
        </p>
      </div>

      <div className="bg-slate-950/80 rounded-2xl border border-slate-800 p-3 space-y-2">
        <h3 className="font-semibold text-xs text-slate-300 uppercase tracking-wider">
          Initiative List
        </h3>
        {entries.length === 0 ? (
          <p className="text-xs text-slate-500 py-2">No initiative entries yet.</p>
        ) : (
          <div className="space-y-1.5">
            {entries.map((entry) => (
              <div key={entry.id} className="rounded-xl border border-slate-800 bg-slate-900/60 p-2.5 flex items-center justify-between text-xs">
                <div>
                  <span className="font-bold text-slate-200">{entry.sourceName}</span>
                  <p className="text-[10px] text-slate-500">{entry.visibility}</p>
                </div>
                {isGM && (
                  <button
                    onClick={() => deleteEntry(entry.id)}
                    className="p-1 text-slate-400 hover:text-rose-400"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

interface PhaseSectionProps {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  badgeColor: string;
  entries: InitiativeEntry[];
  isGM: boolean;
  onTogglePhase: (entry: InitiativeEntry) => void;
  onToggleVisibility: (entry: InitiativeEntry) => void;
  onDelete: (id: string) => void;
}

const PhaseSection: React.FC<PhaseSectionProps> = ({
  title,
  subtitle,
  icon,
  badgeColor,
  entries,
  isGM,
  onTogglePhase,
  onToggleVisibility,
  onDelete,
}) => {
  return (
    <div className="rounded-2xl border border-slate-800/80 bg-slate-950/90 p-3 shadow-md space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {icon}
          <h4 className="text-xs font-bold text-slate-200">{title}</h4>
        </div>
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${badgeColor}`}>
          {entries.length}
        </span>
      </div>
      <p className="text-[10px] text-slate-500">{subtitle}</p>

      {entries.length === 0 ? (
        <div className="py-2 text-center text-[11px] text-slate-600 italic">No participants</div>
      ) : (
        <div className="space-y-1.5 pt-1">
          {entries.map((entry) => (
            <div
              key={entry.id}
              className="flex items-center justify-between rounded-xl border border-slate-800/90 bg-slate-900/80 p-2 text-xs transition-colors"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-semibold text-slate-200 truncate">{entry.sourceName}</span>
                {entry.visibility === 'gm_only' && (
                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20">
                    GM Only
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1.5">
                {/* Fast / Slow phase switch button */}
                <button
                  onClick={() => onTogglePhase(entry)}
                  className="px-2 py-0.5 rounded-lg text-[10px] font-bold border border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white"
                  title="Switch Fast/Slow phase"
                >
                  {entry.phase.toUpperCase()}
                </button>

                {/* GM Visibility toggle button */}
                {isGM && (
                  <button
                    onClick={() => onToggleVisibility(entry)}
                    className="p-1 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                    title={entry.visibility === 'public' ? 'Make GM Only' : 'Make Public to Players'}
                  >
                    {entry.visibility === 'public' ? (
                      <Eye className="h-3.5 w-3.5 text-emerald-400" />
                    ) : (
                      <EyeOff className="h-3.5 w-3.5 text-amber-400" />
                    )}
                  </button>
                )}

                {/* GM Delete entry button */}
                {isGM && (
                  <button
                    onClick={() => onDelete(entry.id)}
                    className="p-1 rounded-lg text-slate-400 hover:bg-rose-950 hover:text-rose-300"
                    title="Remove from initiative"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
