import React from 'react';
import { useSessionStore } from '../../stores/sessionStore';
import { useMapStore } from '../../stores/mapStore';
import { useSession } from '../../hooks/useSession';
import { useMap } from '../../hooks/useMap';
import { useSoundEffects, type SoundEffectAction } from '../../hooks/useSoundEffects';
import { useToast } from '../shared/Toast';
import { SessionExport } from './SessionExport';

export const GMSettings: React.FC = () => {
  const { showToast } = useToast();
  const session = useSessionStore((state) => state.session);
  const activeMap = useMapStore((state) => state.activeMap);
  const drawingData = useMapStore((state) => state.drawingData);
  const { updateSessionSettings } = useSession();
  const { updateDrawingData } = useMap();
  const { config: soundConfig, setEnabled, setVolume, uploadSound, setSoundUrl, playSound } = useSoundEffects();

  if (!session) return null;

  const handleToggle = async (
    field:
      | 'allowPlayersRenameNpcs'
      | 'allowPlayersMoveNpcs'
      | 'enableInitiativePhase'
      | 'enablePlotDice'
      | 'allowPlayersDrawings',
    value: boolean
  ) => {
    const result = await updateSessionSettings({ [field]: value });
    if (!result.success) {
      showToast(result.error || 'Failed to update setting', 'error');
    }
  };

  const handleClearDrawings = async () => {
    if (!activeMap) return;
    const confirmed = confirm('Clear all drawings on this map? This cannot be undone.');
    if (!confirmed) return;

    const result = await updateDrawingData(activeMap.id, []);
    if (result.success) {
      showToast('All drawings cleared', 'success');
    } else {
      showToast(result.error || 'Failed to clear drawings', 'error');
    }
  };

  const handleSoundUpload = async (action: SoundEffectAction, file: File | null) => {
    if (!file) return;
    const result = await uploadSound(action, file);
    if (!result.success) {
      showToast(result.error, 'error');
      return;
    }
    showToast('Sound uploaded', 'success');
  };

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4">
      <div className="bg-slate-800/50 rounded-lg p-3 space-y-3">
        <h3 className="text-slate-100 font-semibold">Game Settings</h3>

        <label className="flex items-center justify-between gap-3 text-sm text-slate-300">
          <span>Enable player NPC renaming</span>
          <input
            type="checkbox"
            checked={session.allowPlayersRenameNpcs}
            onChange={(e) => handleToggle('allowPlayersRenameNpcs', e.target.checked)}
          />
        </label>

        <label className="flex items-center justify-between gap-3 text-sm text-slate-300">
          <span>Enable player NPC movement</span>
          <input
            type="checkbox"
            checked={session.allowPlayersMoveNpcs}
            onChange={(e) => handleToggle('allowPlayersMoveNpcs', e.target.checked)}
          />
        </label>

        <label className="flex items-center justify-between gap-3 text-sm text-slate-300">
          <span>Enable initiative phases (fast/slow)</span>
          <input
            type="checkbox"
            checked={session.enableInitiativePhase}
            onChange={(e) => handleToggle('enableInitiativePhase', e.target.checked)}
          />
        </label>

        <label className="flex items-center justify-between gap-3 text-sm text-slate-300">
          <span>Enable plot dice</span>
          <input
            type="checkbox"
            checked={session.enablePlotDice}
            onChange={(e) => handleToggle('enablePlotDice', e.target.checked)}
          />
        </label>

        <label className="flex items-center justify-between gap-3 text-sm text-slate-300">
          <span>Enable player drawings</span>
          <input
            type="checkbox"
            checked={session.allowPlayersDrawings}
            onChange={(e) => handleToggle('allowPlayersDrawings', e.target.checked)}
          />
        </label>
      </div>

      <div className="bg-slate-800/50 rounded-lg p-3 space-y-3">
        <h3 className="text-slate-100 font-semibold">Map Drawings</h3>
        <p className="text-xs text-slate-400">
          Clear all drawings across this map, including player annotations.
        </p>
        <div className="flex items-center justify-between text-sm text-slate-300">
          <span>Drawings on map: {drawingData.length}</span>
          <button
            onClick={handleClearDrawings}
            className="px-3 py-1.5 rounded bg-red-500/20 text-red-300 hover:bg-red-500/30 transition-colors"
            disabled={!activeMap || drawingData.length === 0}
          >
            Clear all
          </button>
        </div>
      </div>

      <div className="bg-slate-800/50 rounded-lg p-3">
        <h3 className="text-slate-100 font-semibold mb-3">Session Export / Import</h3>
        <SessionExport />
      </div>

      <div className="bg-slate-800/50 rounded-lg p-3 space-y-3">
        <h3 className="text-slate-100 font-semibold">Sound Effects</h3>
        <p className="text-xs text-slate-400">
          Upload optional sounds for local playback when you click tokens or roll dice.
        </p>

        <label className="flex items-center justify-between gap-3 text-sm text-slate-300">
          <span>Enable sound effects</span>
          <input
            type="checkbox"
            checked={soundConfig.enabled}
            onChange={(e) => setEnabled(e.target.checked)}
          />
        </label>

        <div className="space-y-1">
          <label className="text-sm text-slate-300 block">Volume</label>
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(soundConfig.volume * 100)}
            onChange={(e) => setVolume(Number(e.target.value) / 100)}
            className="w-full"
          />
        </div>

        {[
          { action: 'tokenSelect', label: 'Token Click' },
          { action: 'tokenPickup', label: 'Token Pickup' },
          { action: 'tokenDrop', label: 'Token Drop' },
          { action: 'diceRoll', label: 'Dice Roll' },
          { action: 'chatMessageReceive', label: 'Incoming Chat Message' },
        ].map((entry) => (
          <div key={entry.action} className="rounded border border-slate-700 p-2 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-300">{entry.label}</span>
              <button
                onClick={() => void playSound(entry.action as SoundEffectAction)}
                className="px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 text-xs text-slate-100"
                type="button"
              >
                Preview
              </button>
            </div>
            <input
              type="file"
              accept="audio/*"
              onChange={(e) => {
                void handleSoundUpload(entry.action as SoundEffectAction, e.target.files?.[0] ?? null);
                e.currentTarget.value = '';
              }}
              className="block w-full text-xs text-slate-300"
            />
            {soundConfig.sounds[entry.action as SoundEffectAction] && (
              <button
                type="button"
                onClick={() => setSoundUrl(entry.action as SoundEffectAction, null)}
                className="px-2 py-1 rounded bg-red-500/20 text-red-300 hover:bg-red-500/30 text-xs"
              >
                Remove sound
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
