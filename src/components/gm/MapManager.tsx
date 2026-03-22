import React, { useState, useRef } from 'react';
import {
  Upload,
  Trash2,
  Settings,
  Check,
  Image,
  Library,
} from 'lucide-react';
import { useMap } from '../../hooks/useMap';
import { Button } from '../shared/Button';
import { Input } from '../shared/Input';
import { useToast } from '../shared/Toast';
import { validateMapUpload, getImageDimensions } from '../../lib/validation';
import { GlobalAssetBrowser } from './GlobalAssetBrowser';
import type { GlobalAsset } from '../../hooks/useGlobalAssets';

export const MapManager: React.FC = () => {
  const { showToast } = useToast();
  const { maps, activeMap, uploadMap, addMapFromGlobalAsset, setMapActive, updateMapSettings, deleteMap } =
    useMap();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [editingMapId, setEditingMapId] = useState<string | null>(null);
  const [showAssetBrowser, setShowAssetBrowser] = useState(false);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate
    const validation = await validateMapUpload(file);
    if (!validation.valid) {
      showToast(validation.error || 'Invalid file', 'error');
      return;
    }

    // Get dimensions
    const dimensions = await getImageDimensions(file);

    // Prompt for name
    const name = prompt('Map name:', file.name.replace(/\.[^/.]+$/, ''));
    if (!name) return;

    setIsUploading(true);
    const result = await uploadMap(file, name, dimensions.width, dimensions.height);
    setIsUploading(false);

    if (result.success) {
      showToast('Map uploaded successfully', 'success');
    } else {
      showToast(result.error || 'Failed to upload map', 'error');
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSelectGlobalAsset = async (asset: GlobalAsset) => {
    setShowAssetBrowser(false);

    if (!asset.width || !asset.height) {
      showToast('Global map asset missing dimensions', 'error');
      return;
    }

    setIsUploading(true);
    const result = await addMapFromGlobalAsset(
      asset.name,
      asset.imageUrl,
      asset.width,
      asset.height
    );
    setIsUploading(false);

    if (result.success) {
      showToast('Map added from library', 'success');
    } else {
      showToast(result.error || 'Failed to add map', 'error');
    }
  };

  const handleSetActive = async (mapId: string) => {
    const result = await setMapActive(mapId);
    if (!result.success) {
      showToast(result.error || 'Failed to switch map', 'error');
    }
  };

  const handleDelete = async (mapId: string) => {
    if (!confirm('Are you sure you want to delete this map?')) return;

    const result = await deleteMap(mapId);
    if (result.success) {
      showToast('Map deleted', 'success');
    } else {
      showToast(result.error || 'Failed to delete map', 'error');
    }
  };

  return (
    <div className="h-full overflow-y-auto p-4">
      {/* Upload and library buttons */}
      <div className="mb-4 space-y-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={handleFileSelect}
          className="hidden"
        />
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="secondary"
            onClick={() => setShowAssetBrowser(true)}
            isLoading={isUploading}
          >
            <Library className="w-4 h-4 mr-2" />
            Library
          </Button>
          <Button
            variant="primary"
            onClick={() => fileInputRef.current?.click()}
            isLoading={isUploading}
          >
            <Upload className="w-4 h-4 mr-2" />
            Upload
          </Button>
        </div>
        <p className="text-xs text-slate-500 text-center">
          Browse global library or upload custom (PNG, JPG, WEBP)
        </p>
      </div>

      {/* Map list */}
      {maps.length === 0 ? (
        <div className="text-center py-8">
          <Image className="w-12 h-12 text-slate-500 mx-auto mb-3" />
          <p className="text-slate-400">No maps yet</p>
          <p className="text-sm text-slate-500">Upload a map to get started</p>
        </div>
      ) : (
        <div className="space-y-2">
          {maps.map((map) => {
            const isActive = activeMap?.id === map.id;
            const isEditing = editingMapId === map.id;

            return (
              <div
                key={map.id}
                className={`
                  rounded-lg border transition-colors
                  ${isActive ? 'bg-slate-700/50 border-tempest-500' : 'bg-slate-800/50 border-slate-700'}
                `}
              >
                <div className="flex items-center gap-3 p-3">
                  {/* Thumbnail */}
                  <div className="w-12 h-12 rounded bg-slate-700 overflow-hidden flex-shrink-0">
                    <img
                      src={map.imageUrl}
                      alt={map.name}
                      className="w-full h-full object-cover"
                    />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-slate-200 truncate">
                      {map.name}
                    </h4>
                    <p className="text-xs text-slate-400">
                      {map.width}x{map.height}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1">
                    {isActive ? (
                      <span className="px-2 py-1 bg-green-600/20 text-green-400 rounded text-xs">
                        Active
                      </span>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSetActive(map.id)}
                      >
                        <Check className="w-4 h-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setEditingMapId(isEditing ? null : map.id)
                      }
                    >
                      <Settings className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(map.id)}
                    >
                      <Trash2 className="w-4 h-4 text-red-400" />
                    </Button>
                  </div>
                </div>

                {/* Settings panel */}
                {isEditing && (
                  <MapSettings
                    map={map}
                    onUpdate={updateMapSettings}
                    onClose={() => setEditingMapId(null)}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Global Asset Browser Modal */}
      {showAssetBrowser && (
        <GlobalAssetBrowser
          assetType="map"
          onSelect={handleSelectGlobalAsset}
          onClose={() => setShowAssetBrowser(false)}
        />
      )}
    </div>
  );
};

interface MapSettingsData {
  id: string;
  name: string;
  gridEnabled: boolean;
  gridOffsetX: number;
  gridOffsetY: number;
  gridCellSize: number;
  gridColor: string;
  fogEnabled: boolean;
  fogDefaultState: 'fogged' | 'revealed';
  showPlayerTokens: boolean;
}

interface MapSettingsProps {
  map: MapSettingsData;
  onUpdate: (
    mapId: string,
    settings: Partial<MapSettingsData>
  ) => Promise<{ success: boolean; error?: string }>;
  onClose: () => void;
}

const MapSettings: React.FC<MapSettingsProps> = ({ map, onUpdate, onClose }) => {
  const { showToast } = useToast();
  const [settings, setSettings] = useState({
    name: map.name,
    gridEnabled: map.gridEnabled,
    gridOffsetX: map.gridOffsetX,
    gridOffsetY: map.gridOffsetY,
    gridCellSize: map.gridCellSize,
    gridColor: map.gridColor,
    fogEnabled: map.fogEnabled,
    fogDefaultState: map.fogDefaultState,
    showPlayerTokens: map.showPlayerTokens,
  });

  const handleSave = async () => {
    const result = await onUpdate(map.id, settings);
    if (result.success) {
      showToast('Settings saved', 'success');
      onClose();
    } else {
      showToast(result.error || 'Failed to save settings', 'error');
    }
  };

  return (
    <div className="p-3 border-t border-slate-600 space-y-3">
      <Input
        label="Map Name"
        value={settings.name}
        onChange={(e) => setSettings((s) => ({ ...s, name: e.target.value }))}
      />

      <div className="space-y-2">
        <label className="flex items-center gap-2 text-sm text-slate-300">
          <input
            type="checkbox"
            checked={settings.gridEnabled}
            onChange={(e) =>
              setSettings((s) => ({ ...s, gridEnabled: e.target.checked }))
            }
            className="rounded border-slate-600 bg-slate-800"
          />
          Show Grid
        </label>

        {settings.gridEnabled && (
          <div className="pl-6 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <Input
                label="Cell Size (px)"
                type="number"
                value={settings.gridCellSize}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    gridCellSize: parseInt(e.target.value) || 50,
                  }))
                }
              />
              <Input
                label="Offset X"
                type="number"
                value={settings.gridOffsetX}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    gridOffsetX: parseInt(e.target.value) || 0,
                  }))
                }
              />
            </div>
            <Input
              label="Offset Y"
              type="number"
              value={settings.gridOffsetY}
              onChange={(e) =>
                setSettings((s) => ({
                  ...s,
                  gridOffsetY: parseInt(e.target.value) || 0,
                }))
              }
            />
          </div>
        )}

        <label className="flex items-center gap-2 text-sm text-slate-300">
          <input
            type="checkbox"
            checked={settings.fogEnabled}
            onChange={(e) =>
              setSettings((s) => ({ ...s, fogEnabled: e.target.checked }))
            }
            className="rounded border-slate-600 bg-slate-800"
          />
          Enable Fog of War
        </label>

        {settings.fogEnabled && (
          <div className="pl-6">
            <label className="text-xs text-slate-400">Default State</label>
            <select
              value={settings.fogDefaultState}
              onChange={(e) =>
                setSettings((s) => ({
                  ...s,
                  fogDefaultState: e.target.value as 'fogged' | 'revealed',
                }))
              }
              className="w-full mt-1 px-2 py-1 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200"
            >
              <option value="fogged">Fogged (hidden by default)</option>
              <option value="revealed">Revealed (visible by default)</option>
            </select>
          </div>
        )}

        <label className="flex items-center gap-2 text-sm text-slate-300">
          <input
            type="checkbox"
            checked={settings.showPlayerTokens}
            onChange={(e) =>
              setSettings((s) => ({ ...s, showPlayerTokens: e.target.checked }))
            }
            className="rounded border-slate-600 bg-slate-800"
          />
          Show Player Tokens
        </label>

      </div>

      <div className="flex gap-2 pt-2">
        <Button variant="ghost" onClick={onClose} className="flex-1">
          Cancel
        </Button>
        <Button variant="primary" onClick={handleSave} className="flex-1">
          Save
        </Button>
      </div>
    </div>
  );
};
