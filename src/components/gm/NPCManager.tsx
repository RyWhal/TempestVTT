import React, { useRef, useState } from 'react';
import {
  Plus,
  Skull,
  Trash2,
  Upload,
  Eye,
  EyeOff,
  MapPin,
  Library,
  X,
} from 'lucide-react';
import { useNPCs } from '../../hooks/useNPCs';
import { useMapStore } from '../../stores/mapStore';
import { Button } from '../shared/Button';
import { Input } from '../shared/Input';
import { useToast } from '../shared/Toast';
import { validateTokenUpload } from '../../lib/validation';
import { TOKEN_SIZE_MULTIPLIERS, type TokenSize } from '../../types';
import { GlobalAssetBrowser } from './GlobalAssetBrowser';
import type { GlobalAsset } from '../../hooks/useGlobalAssets';

const SIZE_OPTIONS: TokenSize[] = ['tiny', 'small', 'medium', 'large', 'huge', 'gargantuan'];
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
const PREVIEW_LIMIT = 4;

export const NPCManager: React.FC = () => {
  const { showToast } = useToast();
  const activeMap = useMapStore((state) => state.activeMap);
  const viewportScale = useMapStore((state) => state.viewportScale);
  const stageWidth = useMapStore((state) => state.stageWidth);
  const stageHeight = useMapStore((state) => state.stageHeight);
  const selectToken = useMapStore((state) => state.selectToken);
  const setViewportPosition = useMapStore((state) => state.setViewportPosition);
  const {
    npcTemplates,
    currentMapNPCs,
    createNPCTemplate,
    deleteNPCTemplate,
    addNPCToMap,
    toggleNPCVisibility,
    removeNPCFromMap,
    updateNPCInstanceDetails,
  } = useNPCs();

  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newSize, setNewSize] = useState<TokenSize>('medium');
  const [newTokenFile, setNewTokenFile] = useState<File | null>(null);
  const [selectedGlobalAsset, setSelectedGlobalAsset] = useState<GlobalAsset | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAssetBrowser, setShowAssetBrowser] = useState(false);
  const [activeView, setActiveView] = useState<'library' | 'active' | null>(null);
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
    setSelectedGlobalAsset(null); // Clear global asset when uploading custom
  };

  const handleSelectGlobalAsset = (asset: GlobalAsset) => {
    setSelectedGlobalAsset(asset);
    setNewTokenFile(null); // Clear file when selecting global asset
    setNewName(asset.name);
    setNewSize((asset.defaultSize as TokenSize) || 'medium');
    setShowAssetBrowser(false);
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;

    setIsSubmitting(true);
    const result = await createNPCTemplate(
      newName,
      newSize,
      newTokenFile || undefined,
      undefined,
      selectedGlobalAsset?.imageUrl
    );
    setIsSubmitting(false);

    if (result.success) {
      showToast('NPC template created', 'success');
      setIsCreating(false);
      setNewName('');
      setNewSize('medium');
      setNewTokenFile(null);
      setSelectedGlobalAsset(null);
    } else {
      showToast(result.error || 'Failed to create NPC template', 'error');
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    if (!confirm('Are you sure you want to delete this NPC template?')) return;

    const result = await deleteNPCTemplate(id);
    if (result.success) {
      showToast('NPC template deleted', 'success');
    } else {
      showToast(result.error || 'Failed to delete template', 'error');
    }
  };

  const handleAddToMap = async (templateId: string) => {
    if (!activeMap) {
      showToast('No active map', 'error');
      return;
    }

    const result = await addNPCToMap(templateId);
    if (result.success) {
      showToast('NPC added to map', 'success');
    } else {
      showToast(result.error || 'Failed to add NPC', 'error');
    }
  };

  const handleToggleVisibility = async (instanceId: string) => {
    const result = await toggleNPCVisibility(instanceId);
    if (!result.success) {
      showToast(result.error || 'Failed to toggle visibility', 'error');
    }
  };

  const handleRemoveFromMap = async (instanceId: string) => {
    const result = await removeNPCFromMap(instanceId);
    if (result.success) {
      showToast('NPC removed from map', 'success');
    } else {
      showToast(result.error || 'Failed to remove NPC', 'error');
    }
  };

  const handleRenameNPC = async (instanceId: string, displayName: string) => {
    const trimmed = displayName.trim();
    if (!trimmed) return;
    const result = await updateNPCInstanceDetails(instanceId, { displayName: trimmed });
    if (!result.success) {
      showToast(result.error || 'Failed to rename NPC', 'error');
    }
  };

  const focusToken = (x: number, y: number) => {
    setViewportPosition(stageWidth / 2 - x * viewportScale, stageHeight / 2 - y * viewportScale);
  };

  return (
    <div className="h-full overflow-y-auto p-4">
      {/* NPC Templates Section */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-slate-300">NPC Library</h3>
          {!isCreating && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsCreating(true)}
            >
              <Plus className="w-4 h-4 mr-1" />
              New
            </Button>
          )}
        </div>

        <NPCPreviewCard
          title="NPC Library"
          subtitle="Templates ready for the table"
          count={npcTemplates.length}
          emptyLabel="No templates yet"
          previewItems={npcTemplates.map((template) => ({
            id: template.id,
            name: template.name,
            tokenUrl: template.tokenUrl,
          }))}
          onClick={() => setActiveView('library')}
          ariaLabel="Open NPC library"
        />

        {/* Create form */}
        {isCreating && (
          <div className="mb-4 p-3 bg-slate-800 rounded-lg border border-slate-600">
            <div className="space-y-3">
              <Input
                placeholder="NPC name (e.g., Goblin)"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                autoFocus
              />

              <div>
                <label className="text-xs text-slate-400 block mb-1">Size</label>
                <select
                  value={newSize}
                  onChange={(e) => setNewSize(e.target.value as TokenSize)}
                  className="w-full px-2 py-1.5 bg-slate-700 border border-slate-600 rounded text-sm text-slate-200"
                >
                  {SIZE_OPTIONS.map((size) => (
                    <option key={size} value={size}>
                      {size.charAt(0).toUpperCase() + size.slice(1)} (
                      {TOKEN_SIZE_MULTIPLIERS[size]}x)
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  onChange={handleFileChange}
                  className="hidden"
                />

                {/* Show selected asset preview */}
                {selectedGlobalAsset && (
                  <div className="flex items-center gap-2 p-2 bg-slate-700 rounded">
                    <img
                      src={selectedGlobalAsset.imageUrl}
                      alt={selectedGlobalAsset.name}
                      className="w-10 h-10 rounded object-cover"
                    />
                    <span className="text-sm text-slate-200 flex-1 truncate">
                      {selectedGlobalAsset.name}
                    </span>
                    <button
                      onClick={() => setSelectedGlobalAsset(null)}
                      className="text-slate-400 hover:text-slate-200"
                    >
                      ×
                    </button>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setShowAssetBrowser(true)}
                  >
                    <Library className="w-4 h-4 mr-1" />
                    Global Library
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="w-4 h-4 mr-1" />
                    {newTokenFile ? 'Change' : 'Upload'}
                  </Button>
                </div>
                {newTokenFile && (
                  <p className="text-xs text-slate-400 truncate">{newTokenFile.name}</p>
                )}
              </div>

              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setIsCreating(false);
                    setNewName('');
                    setNewTokenFile(null);
                    setSelectedGlobalAsset(null);
                  }}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="sm"
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

      </div>

      {/* NPCs on Current Map */}
      <div>
        <NPCPreviewCard
          title="NPCs on Current Map"
          subtitle={
            activeMap ? 'Active tokens ready to manage' : 'Add or switch to a map to place NPCs'
          }
          count={activeMap ? currentMapNPCs.length : 0}
          emptyLabel={activeMap ? 'No NPCs on this map' : 'No active map'}
          previewItems={currentMapNPCs.map((npc) => ({
            id: npc.id,
            name: npc.displayName || 'NPC',
            tokenUrl: npc.tokenUrl,
          }))}
          onClick={() => {
            if (activeMap) {
              setActiveView('active');
            }
          }}
          disabled={!activeMap}
          ariaLabel="Open active NPCs"
        />
      </div>

      {activeView && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="flex max-h-[85vh] w-full max-w-5xl flex-col overflow-hidden rounded-lg border border-slate-700 bg-slate-900 shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-700 p-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-100">NPC Management</h3>
                <p className="mt-1 text-sm text-slate-400">
                  Review the table library and active map roster without squeezing the GM panel.
                </p>
              </div>
              <button
                onClick={() => setActiveView(null)}
                className="rounded p-1 text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-100"
                aria-label="Close NPC manager"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex border-b border-slate-700">
              <button
                onClick={() => setActiveView('library')}
                className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                  activeView === 'library'
                    ? 'bg-slate-800 text-slate-100'
                    : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
                }`}
              >
                NPC Library
              </button>
              <button
                onClick={() => setActiveView('active')}
                className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                  activeView === 'active'
                    ? 'bg-slate-800 text-slate-100'
                    : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
                }`}
              >
                Active NPCs
              </button>
            </div>

            <div className="overflow-y-auto p-4">
              {activeView === 'library' && (
                <>
                  {npcTemplates.length === 0 ? (
                    <p className="text-slate-500 text-sm text-center py-4">
                      No NPC templates yet
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {npcTemplates.map((template) => (
                        <div
                          key={template.id}
                          className="flex items-center gap-2 rounded border border-slate-700 bg-slate-800/50 p-2"
                        >
                          <div className="h-8 w-8 flex-shrink-0 overflow-hidden rounded bg-slate-700">
                            {template.tokenUrl ? (
                              <img
                                src={template.tokenUrl}
                                alt={template.name}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center">
                                <Skull className="h-4 w-4 text-slate-400" />
                              </div>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm text-slate-200">
                              {template.name}
                            </p>
                            <p className="text-xs capitalize text-slate-500">
                              {template.defaultSize}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleAddToMap(template.id)}
                            disabled={!activeMap}
                            title="Add to map"
                          >
                            <MapPin className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteTemplate(template.id)}
                          >
                            <Trash2 className="h-4 w-4 text-red-400" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}

              {activeView === 'active' && (
                <>
                  {!activeMap ? (
                    <p className="text-slate-500 text-sm text-center py-4">
                      No active map
                    </p>
                  ) : currentMapNPCs.length === 0 ? (
                    <p className="text-slate-500 text-sm text-center py-4">
                      No NPCs on this map
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {currentMapNPCs.map((npc) => (
                        <div
                          key={npc.id}
                          className={`
                            flex items-center gap-2 rounded border p-2 cursor-pointer
                            ${npc.isVisible ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-800/30 border-slate-700/50'}
                          `}
                          onClick={() => {
                            selectToken(npc.id, 'npc');
                            focusToken(npc.positionX, npc.positionY);
                          }}
                        >
                          <div className="h-8 w-8 flex-shrink-0 overflow-hidden rounded bg-slate-700">
                            {npc.tokenUrl ? (
                              <img
                                src={npc.tokenUrl}
                                alt={npc.displayName || 'NPC'}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center">
                                <Skull className="h-4 w-4 text-slate-400" />
                              </div>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <input
                              type="text"
                              defaultValue={npc.displayName || 'NPC'}
                              className={`w-full truncate bg-transparent text-sm focus:outline-none ${
                                npc.isVisible ? 'text-slate-200' : 'text-slate-400'
                              }`}
                              onBlur={(e) => handleRenameNPC(npc.id, e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.currentTarget.blur();
                                }
                              }}
                            />
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              void handleToggleVisibility(npc.id);
                            }}
                            title={npc.isVisible ? 'Hide from players' : 'Show to players'}
                          >
                            {npc.isVisible ? (
                              <Eye className="h-4 w-4 text-green-400" />
                            ) : (
                              <EyeOff className="h-4 w-4 text-slate-400" />
                            )}
                          </Button>
                          <select
                            value={npc.statusRingColor || 'none'}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => {
                              const value = e.target.value;
                              const selected = STATUS_RING_COLORS.find((color) =>
                                (color.value ?? 'none') === value
                              );
                              void updateNPCInstanceDetails(npc.id, {
                                statusRingColor: selected?.value ?? null,
                              });
                            }}
                            className="max-w-[84px] rounded border border-slate-600 bg-slate-900 px-1 py-0.5 text-xs text-slate-300"
                            title="Status ring color"
                          >
                            {STATUS_RING_COLORS.map((color) => (
                              <option key={color.label} value={color.value ?? 'none'}>
                                {color.label}
                              </option>
                            ))}
                          </select>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              void handleRemoveFromMap(npc.id);
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-red-400" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Global Asset Browser Modal */}
      {showAssetBrowser && (
        <GlobalAssetBrowser
          assetType="token"
          onSelect={handleSelectGlobalAsset}
          onClose={() => setShowAssetBrowser(false)}
        />
      )}
    </div>
  );
};

interface NPCPreviewItem {
  id: string;
  name: string;
  tokenUrl: string | null;
}

interface NPCPreviewCardProps {
  title: string;
  subtitle: string;
  count: number;
  emptyLabel: string;
  previewItems: NPCPreviewItem[];
  onClick: () => void;
  ariaLabel: string;
  disabled?: boolean;
}

const NPCPreviewCard: React.FC<NPCPreviewCardProps> = ({
  title,
  subtitle,
  count,
  emptyLabel,
  previewItems,
  onClick,
  ariaLabel,
  disabled = false,
}) => {
  const visibleItems = previewItems.slice(0, PREVIEW_LIMIT);
  const overflowCount = Math.max(0, previewItems.length - PREVIEW_LIMIT);

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={onClick}
      disabled={disabled}
      className={`w-full rounded-lg border border-slate-700 bg-slate-800/40 p-3 text-left transition-colors ${
        disabled
          ? 'cursor-not-allowed opacity-70'
          : 'hover:border-tempest-500 hover:bg-slate-800/70'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-200">{title}</p>
          <p className="mt-1 text-xs text-slate-400">{subtitle}</p>
        </div>
        <span className="rounded-full border border-slate-600 bg-slate-900 px-2 py-0.5 text-xs text-slate-300">
          {count}
        </span>
      </div>

      {previewItems.length === 0 ? (
        <div className="mt-3 rounded-md border border-dashed border-slate-700 bg-slate-900/40 px-3 py-4 text-center text-xs text-slate-500">
          {emptyLabel}
        </div>
      ) : (
        <div className="mt-3 flex items-center justify-between gap-3">
          <div className="flex items-center">
            {visibleItems.map((item, index) => (
              <div
                key={item.id}
                className={`relative ${index === 0 ? '' : '-ml-2'}`}
              >
                <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border-2 border-slate-900 bg-slate-700 shadow-lg shadow-slate-950/40">
                  {item.tokenUrl ? (
                    <img
                      src={item.tokenUrl}
                      alt={item.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <Skull className="h-4 w-4 text-slate-300" />
                  )}
                </div>
              </div>
            ))}
            {overflowCount > 0 && (
              <div className="-ml-2 flex h-10 w-10 items-center justify-center rounded-full border-2 border-slate-900 bg-slate-950 text-xs font-semibold text-slate-200 shadow-lg shadow-slate-950/40">
                +{overflowCount}
              </div>
            )}
          </div>
          <span className="text-xs text-slate-400">
            Click to open
          </span>
        </div>
      )}
    </button>
  );
};
