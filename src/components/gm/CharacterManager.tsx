import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, Plus, User, Trash2, Upload, X } from 'lucide-react';
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
  const [openStatusMenuFor, setOpenStatusMenuFor] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const statusMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!openStatusMenuFor) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!statusMenuRef.current?.contains(event.target as Node)) {
        setOpenStatusMenuFor(null);
      }
    };

    window.addEventListener('mousedown', handlePointerDown);
    return () => window.removeEventListener('mousedown', handlePointerDown);
  }, [openStatusMenuFor]);

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

  const handleRenameCharacter = async (id: string, name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;

    const character = characters.find((entry) => entry.id === id);
    if (!character || trimmed === character.name) return;

    const result = await updateCharacterDetails(id, { name: trimmed });
    if (!result.success) {
      showToast(result.error || 'Failed to rename character', 'error');
    }
  };

  const selectedStatusRing = (value: string | null) =>
    STATUS_RING_COLORS.find((color) => color.value === value) ?? STATUS_RING_COLORS[0];

  const renderStatusRingSwatch = (value: string | null, filled = true) => (
    <span
      className={`relative inline-flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full border ${
        value ? 'border-slate-200/20' : 'border-slate-500'
      }`}
      style={{ backgroundColor: value ?? 'transparent' }}
      aria-hidden="true"
    >
      {!value && (
        <span className="absolute h-5 w-px rotate-45 bg-slate-500" />
      )}
      {!filled && value && (
        <span className="absolute inset-[3px] rounded-full bg-slate-950/70" />
      )}
    </span>
  );

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
                setOpenStatusMenuFor(null);
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
                      if (file) {
                        void handleTokenUpload(char.id, file);
                      }
                      e.currentTarget.value = '';
                    }}
                    className="hidden"
                    id={`token-${char.id}`}
                    aria-label={`Change token for ${char.name}`}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <label
                    htmlFor={`token-${char.id}`}
                    onClick={(e) => e.stopPropagation()}
                    className="absolute inset-0 bg-slate-900/80 opacity-0 group-hover:opacity-100 flex items-center justify-center rounded-full cursor-pointer transition-opacity"
                  >
                    <Upload className="w-4 h-4 text-slate-200" />
                  </label>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <input
                    type="text"
                    defaultValue={char.name}
                    aria-label={`Rename ${char.name}`}
                    className="w-full truncate rounded bg-slate-900/70 px-2 py-1 text-sm font-medium text-slate-200 border border-slate-700"
                    onClick={(e) => e.stopPropagation()}
                    onBlur={(e) => {
                      void handleRenameCharacter(char.id, e.target.value);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.currentTarget.blur();
                      }
                    }}
                  />
                  <p className="text-xs text-slate-400">
                    {char.isClaimed
                      ? `Claimed by ${char.claimedByUsername}`
                      : 'Unclaimed'}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1">
                  <div
                    ref={openStatusMenuFor === char.id ? statusMenuRef : null}
                    className="relative"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      aria-label={`Status ring color for ${char.name}`}
                      aria-expanded={openStatusMenuFor === char.id}
                      className="flex h-9 w-11 items-center justify-center gap-1 rounded-lg border border-slate-600 bg-slate-900/90 text-slate-200 transition-colors hover:border-tempest-400"
                      onClick={() =>
                        setOpenStatusMenuFor((current) => (current === char.id ? null : char.id))
                      }
                      title={`Status ring color: ${selectedStatusRing(char.statusRingColor).label}`}
                    >
                      {renderStatusRingSwatch(char.statusRingColor)}
                      <ChevronDown className="h-3 w-3 text-slate-400" />
                    </button>

                    {openStatusMenuFor === char.id && (
                      <div className="absolute right-0 top-full z-20 mt-2 w-36 rounded-xl border border-slate-700 bg-slate-950/95 p-2 shadow-xl shadow-slate-950/40 backdrop-blur">
                        <div className="grid grid-cols-4 gap-2">
                          {STATUS_RING_COLORS.map((color) => (
                            <button
                              key={color.label}
                              type="button"
                              aria-label={`${color.label} status ring`}
                              className={`flex h-8 w-8 items-center justify-center rounded-full border transition-colors ${
                                color.value === char.statusRingColor
                                  ? 'border-tempest-400 bg-slate-800'
                                  : 'border-slate-700 hover:border-slate-500 hover:bg-slate-800/70'
                              }`}
                              onClick={() => {
                                setOpenStatusMenuFor(null);
                                void updateCharacterDetails(char.id, {
                                  statusRingColor: color.value,
                                });
                              }}
                              title={color.label}
                            >
                              {renderStatusRingSwatch(color.value)}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  {char.isClaimed && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleRelease(char.id);
                      }}
                      title="Release character"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      void handleDelete(char.id);
                    }}
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
