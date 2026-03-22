import React from 'react';
import { Eye, EyeOff, Eraser, RotateCcw, Paintbrush, Square } from 'lucide-react';
import { useMapStore, getFogBrushPixelSize } from '../../stores/mapStore';
import { useMap } from '../../hooks/useMap';
import { Button } from '../shared/Button';
import { useToast } from '../shared/Toast';

export const FogTools: React.FC = () => {
  const { showToast } = useToast();
  const activeMap = useMapStore((state) => state.activeMap);
  const fogToolMode = useMapStore((state) => state.fogToolMode);
  const fogBrushSize = useMapStore((state) => state.fogBrushSize);
  const fogToolShape = useMapStore((state) => state.fogToolShape);
  const setFogToolMode = useMapStore((state) => state.setFogToolMode);
  const setFogBrushSize = useMapStore((state) => state.setFogBrushSize);
  const setFogToolShape = useMapStore((state) => state.setFogToolShape);
  const { updateFogData } = useMap();

  if (!activeMap) {
    return (
      <div className="h-full flex items-center justify-center p-4">
        <p className="text-slate-500 text-center">
          No active map. Select or upload a map first.
        </p>
      </div>
    );
  }

  if (!activeMap.fogEnabled) {
    return (
      <div className="h-full flex items-center justify-center p-4">
        <div className="text-center">
          <EyeOff className="w-12 h-12 text-slate-500 mx-auto mb-3" />
          <p className="text-slate-400">Fog of war is disabled for this map</p>
          <p className="text-sm text-slate-500 mt-1">
            Enable it in Map Settings
          </p>
        </div>
      </div>
    );
  }

  const handleRevealAll = async () => {
    if (!confirm('Reveal entire map to players? This will clear all fog.')) return;

    // If default is fogged, we clear fog data
    // If default is revealed, we also clear fog data
    await updateFogData(activeMap.id, []);
    showToast('Fog cleared', 'success');
  };

  const handleResetFog = async () => {
    if (!confirm('Reset fog to default state?')) return;

    await updateFogData(activeMap.id, []);
    showToast('Fog reset', 'success');
  };

  const toggleTool = (mode: 'reveal' | 'hide') => {
    setFogToolMode(fogToolMode === mode ? null : mode);
  };

  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="space-y-4">
        {/* Current state */}
        <div className="bg-slate-800/50 rounded-lg p-3">
          <p className="text-sm text-slate-400">
            Default state:{' '}
            <span className="text-slate-200 capitalize">
              {activeMap.fogDefaultState}
            </span>
          </p>
          <p className="text-sm text-slate-400">
            Fog regions: {activeMap.fogData.length}
          </p>
        </div>

        {/* Tool selection */}
        <div>
          <label className="text-sm text-slate-400 mb-2 block">
            Fog Tool (click and drag on map)
          </label>
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant={fogToolMode === 'reveal' ? 'primary' : 'secondary'}
              onClick={() => toggleTool('reveal')}
              className="justify-start"
            >
              <Eye className="w-4 h-4 mr-2" />
              Reveal
            </Button>
            <Button
              variant={fogToolMode === 'hide' ? 'primary' : 'secondary'}
              onClick={() => toggleTool('hide')}
              className="justify-start"
            >
              <EyeOff className="w-4 h-4 mr-2" />
              Hide
            </Button>
          </div>

          {fogToolMode && (
            <p className="text-xs text-slate-500 mt-2">
              Click and drag on the map to {fogToolMode} areas
            </p>
          )}
        </div>

        {/* Tool shape */}
        <div>
          <label className="text-sm text-slate-400 mb-2 block">
            Tool Shape
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setFogToolShape('brush')}
              className={`
                flex items-center justify-center gap-2 p-2 rounded-lg border transition-colors
                ${
                  fogToolShape === 'brush'
                    ? 'bg-slate-700 border-tempest-500 text-slate-100'
                    : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:bg-slate-700/50'
                }
              `}
            >
              <Paintbrush className="w-4 h-4" />
              <span className="text-sm">Brush</span>
            </button>
            <button
              onClick={() => setFogToolShape('rectangle')}
              className={`
                flex items-center justify-center gap-2 p-2 rounded-lg border transition-colors
                ${
                  fogToolShape === 'rectangle'
                    ? 'bg-slate-700 border-tempest-500 text-slate-100'
                    : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:bg-slate-700/50'
                }
              `}
            >
              <Square className="w-4 h-4" />
              <span className="text-sm">Rectangle</span>
            </button>
          </div>
        </div>

        {/* Brush size (only for brush tool) */}
        {fogToolShape === 'brush' && (
          <div>
            <label className="text-sm text-slate-400 mb-2 block">
              Brush Size
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['small', 'medium', 'large'] as const).map((size) => (
                <button
                  key={size}
                  onClick={() => setFogBrushSize(size)}
                  className={`
                    flex flex-col items-center justify-center p-2 rounded-lg border transition-colors
                    ${
                      fogBrushSize === size
                        ? 'bg-slate-700 border-tempest-500 text-slate-100'
                        : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:bg-slate-700/50'
                    }
                  `}
                >
                  <div
                    className="rounded-full bg-tempest-400 mb-1"
                    style={{
                      width: size === 'small' ? 8 : size === 'medium' ? 16 : 24,
                      height: size === 'small' ? 8 : size === 'medium' ? 16 : 24,
                    }}
                  />
                  <span className="text-xs capitalize">{size}</span>
                  <span className="text-xs text-slate-500">
                    {getFogBrushPixelSize(size)}px
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Quick actions */}
        <div>
          <label className="text-sm text-slate-400 mb-2 block">
            Quick Actions
          </label>
          <div className="space-y-2">
            <Button
              variant="secondary"
              className="w-full justify-start"
              onClick={handleRevealAll}
            >
              <Eraser className="w-4 h-4 mr-2" />
              Reveal All (Clear Fog)
            </Button>
            <Button
              variant="secondary"
              className="w-full justify-start"
              onClick={handleResetFog}
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Reset Fog
            </Button>
          </div>
        </div>

        {/* Instructions */}
        <div className="bg-slate-800/30 rounded-lg p-3">
          <h4 className="text-sm font-medium text-slate-300 mb-2">
            How Fog of War Works
          </h4>
          <ul className="text-xs text-slate-400 space-y-1">
            <li>
              - Select <strong>Reveal</strong> or <strong>Hide</strong> tool
            </li>
            <li>
              - Choose <strong>Brush</strong> for freehand or <strong>Rectangle</strong> for areas
            </li>
            <li>- Click and drag on the map to paint/select</li>
            <li>- Players see solid black fog</li>
            <li>- You see semi-transparent fog</li>
            <li>
              - Default state determines initial visibility
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};
