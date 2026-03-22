import React, { useState, useRef } from 'react';
import { Plus, User, Trash2, Upload, X } from 'lucide-react';
import { useCharacters } from '../../hooks/useCharacters';
import { Button } from '../shared/Button';
import { Input } from '../shared/Input';
import { useToast } from '../shared/Toast';
import { validateTokenUpload } from '../../lib/validation';
import { useMapStore } from '../../stores/mapStore';

const STATUS_RING_COLORS = [
  { label: 'None', value: null },
  { label: 'Red', value: '#ef4444' },
  { label: 'Orange', value: '#f59e0b' },
  { label: 'Yellow', value: '#eab308' },
  { label: 'Green', value: '#22c55e' },
  { label: 'Blue', value: '#3b82f6' },
  { label: 'Purple', value: '#8b5cf6' },
  { label: 'Pink', value: '#ec4899' },
] as const;

export const CharacterManager: React.FC = () => {
  const { showToast } = useToast();
  const {
    characters,
    createCharacter,
    updateCharacterToken,
    updateCharacterDetails,
    deleteCharacter,
    releaseCharacter,
  } = useCharacters();
  const activeMap = useMapStore((state) => state.activeMap);
  const viewportScale = useMapStore((state) => state.viewportScale);
  const stageWidth = useMapStore((state) => state.stageWidth);
  const stageHeight = useMapStore((state) => state.stageHeight);
  const selectToken = useMapStore((state) => state.selectToken);
  const setViewportPosition = useMapStore((state) => state.setViewportPosition);

  const focusToken = (x: number, y: number) => {
    setViewportPosition(stageWidth / 2 - x * viewportScale, stageHeight / 2 - y * viewportScale);
  };

  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newTokenFile, setNewTokenFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validation = validateTokenUpload(file);
    if (!validation.valid) {
      showToast(validation.error || 'Invalid file', 'error');
      return;
    }

    setNewTokenFile(file);
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;

    setIsSubmitting(true);
    const result = await createCharacter(newName, newTokenFile || undefined);
    setIsSubmitting(false);

    if (result.success) {
      showToast('Character created', 'success');
      setIsCreating(false);
      setNewName('');
      setNewTokenFile(null);
    } else {
      showToast(result.error || 'Failed to create character', 'error');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this character?')) return;

    const result = await deleteCharacter(id);
    if (result.success) {
      showToast('Character deleted', 'success');
    } else {
      showToast(result.error || 'Failed to delete character', 'error');
    }
  };

  const handleRelease = async (id: string) => {
    const result = await releaseCharacter(id);
    if (result.success) {
      showToast('Character released', 'success');
    } else {
      showToast(result.error || 'Failed to release character', 'error');
    }
  };

  const handleTokenUpload = async (id: string, file: File) => {
    const validation = validateTokenUpload(file);
    if (!validation.valid) {
      showToast(validation.error || 'Invalid file', 'error');
      return;
    }

    const result = await updateCharacterToken(id, file);
    if (result.success) {
      showToast('Token updated', 'success');
    } else {
      showToast(result.error || 'Failed to update token', 'error');
    }
  };

  return (
    <div className="h-full overflow-y-auto p-4">
      {/* Create button */}
      {!isCreating && (
        <Button
          variant="primary"
          className="w-full mb-4"
          onClick={() => setIsCreating(true)}
        >
          <Plus className="w-4 h-4 mr-2" />
          Create Character
        </Button>
      )}

      {/* Create form */}
      {isCreating && (
        <div className="mb-4 p-4 bg-slate-800 rounded-lg border border-slate-600">
          <h4 className="font-medium text-slate-200 mb-3">New Character</h4>
          <div className="space-y-3">
            <Input
              placeholder="Character name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              autoFocus
            />

            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                onChange={handleFileChange}
                className="hidden"
              />
              <Button
                variant="secondary"
                className="w-full"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="w-4 h-4 mr-2" />
                {newTokenFile ? newTokenFile.name : 'Upload Token (optional)'}
              </Button>
            </div>

            <div className="flex gap-2">
              <Button
                variant="ghost"
                onClick={() => {
                  setIsCreating(false);
                  setNewName('');
                  setNewTokenFile(null);
                }}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleCreate}
                disabled={!newName.trim() || isSubmitting}
                isLoading={isSubmitting}
                className="flex-1"
              >
                Create
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Character list */}
      {characters.length === 0 ? (
        <div className="text-center py-8">
          <User className="w-12 h-12 text-slate-500 mx-auto mb-3" />
          <p className="text-slate-400">No characters yet</p>
          <p className="text-sm text-slate-500">
            Create characters for players to claim
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {characters.map((char) => (
            <div
              key={char.id}
              className="bg-slate-800/50 rounded-lg border border-slate-700 p-3 cursor-pointer hover:border-tempest-500"
              onClick={() => {
                if (!activeMap) return;
                selectToken(char.id, 'character');
                focusToken(char.positionX, char.positionY);
              }}
            >
              <div className="flex items-center gap-3">
                {/* Token */}
                <div className="relative group">
                  <div className="w-10 h-10 rounded-full bg-slate-700 overflow-hidden">
                    {char.tokenUrl ? (
                      <img
                        src={char.tokenUrl}
                        alt={char.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-400 font-bold">
                        {char.name.charAt(0)}
                      </div>
                    )}
                  </div>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleTokenUpload(char.id, file);
                    }}
                    className="hidden"
                    id={`token-${char.id}`}
                  />
                  <label
                    htmlFor={`token-${char.id}`}
                    className="absolute inset-0 bg-slate-900/80 opacity-0 group-hover:opacity-100 flex items-center justify-center rounded-full cursor-pointer transition-opacity"
                  >
                    <Upload className="w-4 h-4 text-slate-200" />
                  </label>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-slate-200 truncate">
                    {char.name}
                  </h4>
                  <p className="text-xs text-slate-400">
                    {char.isClaimed
                      ? `Claimed by ${char.claimedByUsername}`
                      : 'Unclaimed'}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1">
                  <select
                    value={char.statusRingColor || 'none'}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => {
                      const value = e.target.value;
                      const selected = STATUS_RING_COLORS.find((color) =>
                        (color.value ?? 'none') === value
                      );
                      void updateCharacterDetails(char.id, {
                        statusRingColor: selected?.value ?? null,
                      });
                    }}
                    className="bg-slate-900 border border-slate-600 rounded px-1 py-0.5 text-xs text-slate-300 max-w-[84px]"
                    title="Status ring color"
                  >
                    {STATUS_RING_COLORS.map((color) => (
                      <option key={color.label} value={color.value ?? 'none'}>
                        {color.label}
                      </option>
                    ))}
                  </select>
                  {char.isClaimed && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRelease(char.id)}
                      title="Release character"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(char.id)}
                    title="Delete character"
                  >
                    <Trash2 className="w-4 h-4 text-red-400" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
