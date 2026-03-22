import React, { useMemo, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { useInitiative } from '../../hooks/useInitiative';
import { useNPCs } from '../../hooks/useNPCs';
import { useSessionStore } from '../../stores/sessionStore';
import { useToast } from '../shared/Toast';
import type { InitiativePhase, InitiativeVisibility } from '../../types';
import { Button } from '../shared/Button';

interface InitiativePanelProps {
  gmView?: boolean;
}

export const InitiativePanel: React.FC<InitiativePanelProps> = ({ gmView = false }) => {
  const { showToast } = useToast();
  const players = useSessionStore((state) => state.players);
  const currentUser = useSessionStore((state) => state.currentUser);
  const session = useSessionStore((state) => state.session);
  const isGM = currentUser?.isGm ?? false;
  const {
    entries,
    rollLogs,
    currentMapNpcs,
    setMyModifier,
    addPlayerInitiative,
    addNpcInitiative,
    updateEntry,
    deleteEntry,
    clearTracker,
  } = useInitiative();
  const { updateNPCInstanceDetails } = useNPCs();

  const myModifier = useMemo(() => {
    if (!currentUser) return 0;
    return players.find((p) => p.username === currentUser.username)?.initiativeModifier ?? 0;
  }, [players, currentUser]);

  const [modifierInput, setModifierInput] = useState(myModifier.toString());
  const [phase, setPhase] = useState<InitiativePhase>('fast');
  const [visibility, setVisibility] = useState<InitiativeVisibility>('public');
  const [npcModifier, setNpcModifier] = useState('0');
  const [selectedNpcIds, setSelectedNpcIds] = useState<string[]>([]);
  const phaseEnabled = Boolean(session?.enableInitiativePhase);

  const handleSaveModifier = async () => {
    const parsed = parseInt(modifierInput, 10);
    const result = await setMyModifier(Number.isNaN(parsed) ? 0 : parsed);
    if (result.success) showToast('Initiative modifier saved', 'success');
    else showToast(result.error || 'Failed to save modifier', 'error');
  };

  const handleRollSelf = async () => {
    const result = await addPlayerInitiative(phaseEnabled ? phase : 'fast', visibility);
    if (result.success) showToast('Initiative rolled', 'success');
    else showToast(result.error || 'Failed to roll initiative', 'error');
  };

  const handleRollNpcs = async () => {
    const parsed = parseInt(npcModifier, 10);
    const result = await addNpcInitiative(
      selectedNpcIds,
      phaseEnabled ? phase : 'fast',
      visibility,
      Number.isNaN(parsed) ? 0 : parsed
    );
    if (result.success) showToast('NPC initiative rolled', 'success');
    else showToast(result.error || 'Failed to roll NPC initiative', 'error');
  };

  const handleClear = async () => {
    if (!confirm('Clear the full initiative tracker?')) return;
    const result = await clearTracker();
    if (result.success) showToast('Initiative tracker cleared', 'success');
    else showToast(result.error || 'Failed to clear tracker', 'error');
  };

  const handleRenameNpc = async (npcId: string, displayName: string) => {
    const trimmed = displayName.trim();
    if (!trimmed) return;
    const result = await updateNPCInstanceDetails(npcId, { displayName: trimmed });
    if (!result.success) {
      showToast(result.error || 'Failed to rename NPC', 'error');
    }
  };

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4">
      {!gmView && (
        <div className="bg-slate-800/50 rounded-lg p-3 space-y-3">
          <h3 className="font-semibold text-slate-100">Your Initiative</h3>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-sm text-slate-300">
              Modifier
              <input
                type="number"
                value={modifierInput}
                onChange={(e) => setModifierInput(e.target.value)}
                className="w-full mt-1 px-2 py-1 rounded bg-slate-900 border border-slate-700 text-slate-100"
              />
            </label>
            <div className="flex items-end">
              <Button onClick={handleSaveModifier} className="w-full" variant="secondary">
                Save
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {phaseEnabled && (
              <label className="text-sm text-slate-300">
                Phase
                <select
                  value={phase}
                  onChange={(e) => setPhase(e.target.value as InitiativePhase)}
                  className="w-full mt-1 px-2 py-1 rounded bg-slate-900 border border-slate-700 text-slate-100"
                >
                  <option value="fast">Fast</option>
                  <option value="slow">Slow</option>
                </select>
              </label>
            )}

            <label className="text-sm text-slate-300">
              Visibility
              <select
                value={visibility}
                onChange={(e) => setVisibility(e.target.value as InitiativeVisibility)}
                className="w-full mt-1 px-2 py-1 rounded bg-slate-900 border border-slate-700 text-slate-100"
              >
                <option value="public">Public</option>
                <option value="gm_only">GM only</option>
              </select>
            </label>
          </div>

          <Button onClick={handleRollSelf} className="w-full">
            Roll Initiative (d20 {myModifier >= 0 ? '+' : ''}{myModifier})
          </Button>
        </div>
      )}

      {isGM && (
        <div className="bg-slate-800/50 rounded-lg p-3 space-y-3">
          <h3 className="font-semibold text-slate-100">GM: Roll NPC Initiative</h3>
          <div className={`grid gap-2 ${phaseEnabled ? 'grid-cols-3' : 'grid-cols-2'}`}>
            <label className="text-sm text-slate-300">
              Modifier
              <input
                type="number"
                value={npcModifier}
                onChange={(e) => setNpcModifier(e.target.value)}
                className="w-full mt-1 px-2 py-1 rounded bg-slate-900 border border-slate-700 text-slate-100"
              />
            </label>
            {phaseEnabled && (
              <label className="text-sm text-slate-300">
                Phase
                <select
                  value={phase}
                  onChange={(e) => setPhase(e.target.value as InitiativePhase)}
                  className="w-full mt-1 px-2 py-1 rounded bg-slate-900 border border-slate-700 text-slate-100"
                >
                  <option value="fast">Fast</option>
                  <option value="slow">Slow</option>
                </select>
              </label>
            )}
            <label className="text-sm text-slate-300">
              Visibility
              <select
                value={visibility}
                onChange={(e) => setVisibility(e.target.value as InitiativeVisibility)}
                className="w-full mt-1 px-2 py-1 rounded bg-slate-900 border border-slate-700 text-slate-100"
              >
                <option value="public">Public</option>
                <option value="gm_only">GM only</option>
              </select>
            </label>
          </div>

          <div className="max-h-28 overflow-y-auto space-y-1 border border-slate-700 rounded p-2">
            {currentMapNpcs.length === 0 ? (
              <p className="text-xs text-slate-500">No NPCs on current map</p>
            ) : (
              currentMapNpcs.map((npc) => (
                <label key={npc.id} className="flex items-center gap-2 text-sm text-slate-300">
                  <input
                    type="checkbox"
                    checked={selectedNpcIds.includes(npc.id)}
                    onChange={(e) =>
                      setSelectedNpcIds((prev) =>
                        e.target.checked ? [...prev, npc.id] : prev.filter((id) => id !== npc.id)
                      )
                    }
                  />
                  {npc.displayName || 'NPC'}
                </label>
              ))
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button onClick={handleRollNpcs} variant="secondary">
              Roll selected NPCs
            </Button>
            <Button onClick={handleClear} variant="ghost">
              Clear tracker
            </Button>
          </div>
        </div>
      )}

      <div className="bg-slate-800/50 rounded-lg p-3 space-y-2">
        <h3 className="font-semibold text-slate-100">
          {isGM ? 'Initiative Tracker (GM)' : 'Initiative Order'}
        </h3>
        {entries.length === 0 ? (
          <p className="text-sm text-slate-500">No initiative entries yet.</p>
        ) : (
          <div className="space-y-2">
            {entries.map((entry) => (
              <div key={entry.id} className="rounded border border-slate-700 p-2 bg-slate-900/40">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm text-slate-100 font-medium">{entry.sourceName}</p>
                    <p className="text-xs text-slate-400">
                      {phaseEnabled ? `${entry.phase.toUpperCase()} · ` : ''}
                      {entry.visibility === 'public' ? 'Public' : 'GM only'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-slate-100 font-semibold">{entry.total ?? '-'}</p>
                    <p className="text-xs text-slate-500">
                      d20: {entry.rollValue ?? '-'} ({entry.modifier >= 0 ? '+' : ''}
                      {entry.modifier})
                    </p>
                  </div>
                </div>

                {isGM && (
                  <div className="mt-2 flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      {entry.sourceType === 'npc' && entry.sourceId && (
                        <input
                          type="text"
                          defaultValue={entry.sourceName}
                          className="w-32 px-2 py-1 rounded bg-slate-900 border border-slate-700 text-slate-100 text-sm"
                          onBlur={(e) => handleRenameNpc(entry.sourceId as string, e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.currentTarget.blur();
                            }
                          }}
                        />
                      )}
                      <input
                        type="number"
                        defaultValue={entry.total ?? 0}
                        className="w-20 px-2 py-1 rounded bg-slate-900 border border-slate-700 text-slate-100 text-sm"
                        onBlur={async (e) => {
                          const total = parseInt(e.target.value, 10);
                          if (!Number.isNaN(total)) {
                            await updateEntry(entry.id, { total });
                          }
                        }}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      {phaseEnabled && (
                        <select
                          defaultValue={entry.phase}
                          className="px-2 py-1 rounded bg-slate-900 border border-slate-700 text-slate-100 text-sm"
                          onChange={async (e) => {
                            await updateEntry(entry.id, { phase: e.target.value as InitiativePhase });
                          }}
                        >
                          <option value="fast">Fast</option>
                          <option value="slow">Slow</option>
                        </select>
                      )}
                      <select
                        defaultValue={entry.visibility}
                        className="px-2 py-1 rounded bg-slate-900 border border-slate-700 text-slate-100 text-sm"
                        onChange={async (e) => {
                          await updateEntry(entry.id, {
                            visibility: e.target.value as InitiativeVisibility,
                          });
                        }}
                      >
                        <option value="public">Public</option>
                        <option value="gm_only">GM only</option>
                      </select>
                      <button
                        className="ml-auto p-1 text-slate-400 hover:text-red-400"
                        onClick={async () => {
                          await deleteEntry(entry.id);
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {isGM && gmView && (
        <div className="bg-slate-800/50 rounded-lg p-3 space-y-2">
          <h3 className="font-semibold text-slate-100">Initiative Roll Log</h3>
          {rollLogs.length === 0 ? (
            <p className="text-sm text-slate-500">No initiative rolls recorded yet.</p>
          ) : (
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {rollLogs.map((log) => (
                <div key={log.id} className="text-xs text-slate-300 border-b border-slate-700/60 pb-1">
                  <span className="text-slate-100">{log.sourceName}</span> rolled {log.rollValue}{' '}
                  ({log.modifier >= 0 ? '+' : ''}{log.modifier}) ={' '}
                  <span className="text-slate-100">{log.total}</span>{' '}
                  <span className="text-slate-500">{phaseEnabled ? `[${log.phase}] ` : ''}by {log.rolledByUsername}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
