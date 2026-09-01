import React from 'react';
import {
  MousePointer,
  Hand,
  Ruler,
  Pencil,
  Eye,
  Radio,
  Swords,
  Users,
  Map,
  MessageSquare,
  Sparkles,
  Settings,
} from 'lucide-react';
import { useMapStore } from '../../stores/mapStore';
import { useIsGM } from '../../stores/sessionStore';

export type ActivePanelTab =
  | 'initiative'
  | 'tokens'
  | 'maps'
  | 'chat'
  | 'fx'
  | 'sound'
  | 'settings'
  | null;

interface LeftToolbarProps {
  activePanel: ActivePanelTab;
  onSelectPanel: (panel: ActivePanelTab) => void;
  isPanMode: boolean;
  onTogglePanMode: (enabled: boolean) => void;
  isMeasureMode?: boolean;
  onToggleMeasureMode?: (enabled: boolean) => void;
  isPingMode?: boolean;
  onTogglePingMode?: (enabled: boolean) => void;
}

export const LeftToolbar: React.FC<LeftToolbarProps> = ({
  activePanel,
  onSelectPanel,
  isPanMode,
  onTogglePanMode,
  isMeasureMode = false,
  onToggleMeasureMode,
  isPingMode = false,
  onTogglePingMode,
}) => {
  const isGM = useIsGM();
  const drawingTool = useMapStore((state) => state.drawingTool);
  const setDrawingTool = useMapStore((state) => state.setDrawingTool);
  const fogToolMode = useMapStore((state) => state.fogToolMode);
  const setFogToolMode = useMapStore((state) => state.setFogToolMode);

  const isSelectActive = !isPanMode && !drawingTool && !fogToolMode && !isMeasureMode && !isPingMode;
  const isDrawActive = Boolean(drawingTool);
  const isFogActive = Boolean(fogToolMode);

  const handleSelectPointer = () => {
    onTogglePanMode(false);
    onToggleMeasureMode?.(false);
    onTogglePingMode?.(false);
    setDrawingTool(null);
    setFogToolMode(null);
  };

  const handleTogglePan = () => {
    const nextPan = !isPanMode;
    onTogglePanMode(nextPan);
    if (nextPan) {
      onToggleMeasureMode?.(false);
      onTogglePingMode?.(false);
      setDrawingTool(null);
      setFogToolMode(null);
    }
  };

  const handleToggleMeasure = () => {
    const nextMeasure = !isMeasureMode;
    onToggleMeasureMode?.(nextMeasure);
    if (nextMeasure) {
      onTogglePanMode(false);
      onTogglePingMode?.(false);
      setDrawingTool(null);
      setFogToolMode(null);
    }
  };

  const handleTogglePing = () => {
    const nextPing = !isPingMode;
    onTogglePingMode?.(nextPing);
    if (nextPing) {
      onTogglePanMode(false);
      onToggleMeasureMode?.(false);
      setDrawingTool(null);
      setFogToolMode(null);
    }
  };

  const handleToggleDraw = () => {
    if (isDrawActive) {
      setDrawingTool(null);
    } else {
      onTogglePanMode(false);
      onToggleMeasureMode?.(false);
      onTogglePingMode?.(false);
      setFogToolMode(null);
      setDrawingTool('free');
      onSelectPanel('chat'); // Keep drawer or drawing context available
    }
  };

  const handleToggleFog = () => {
    if (!isGM) return;
    if (isFogActive) {
      setFogToolMode(null);
    } else {
      onTogglePanMode(false);
      onToggleMeasureMode?.(false);
      onTogglePingMode?.(false);
      setDrawingTool(null);
      setFogToolMode('reveal');
    }
  };

  const togglePanel = (panel: ActivePanelTab) => {
    if (activePanel === panel) {
      onSelectPanel(null);
    } else {
      onSelectPanel(panel);
    }
  };

  return (
    <div className="absolute left-3 top-16 z-30 flex flex-col items-center gap-3 py-2 px-1.5 rounded-2xl border border-slate-800/80 bg-slate-950/90 backdrop-blur-md shadow-2xl">
      {/* Top Group: Canvas Interaction Tools */}
      <div className="flex flex-col items-center gap-1.5 border-b border-slate-800/80 pb-2.5">
        <button
          onClick={handleSelectPointer}
          title="Select / Move Token"
          className={`flex h-9 w-9 items-center justify-center rounded-xl transition-all ${
            isSelectActive
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
              : 'text-slate-400 hover:bg-slate-800/80 hover:text-slate-200'
          }`}
        >
          <MousePointer className="h-4 w-4" />
        </button>

        <button
          onClick={handleTogglePan}
          title="Pan Tabletop Canvas"
          className={`flex h-9 w-9 items-center justify-center rounded-xl transition-all ${
            isPanMode
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
              : 'text-slate-400 hover:bg-slate-800/80 hover:text-slate-200'
          }`}
        >
          <Hand className="h-4 w-4" />
        </button>

        <button
          onClick={handleToggleMeasure}
          title="Ruler / Distance Measure"
          className={`flex h-9 w-9 items-center justify-center rounded-xl transition-all ${
            isMeasureMode
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
              : 'text-slate-400 hover:bg-slate-800/80 hover:text-slate-200'
          }`}
        >
          <Ruler className="h-4 w-4" />
        </button>

        <button
          onClick={handleToggleDraw}
          title="Pencil / Freehand Draw"
          className={`flex h-9 w-9 items-center justify-center rounded-xl transition-all ${
            isDrawActive
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
              : 'text-slate-400 hover:bg-slate-800/80 hover:text-slate-200'
          }`}
        >
          <Pencil className="h-4 w-4" />
        </button>

        {isGM && (
          <button
            onClick={handleToggleFog}
            title="Fog of War Tools"
            className={`flex h-9 w-9 items-center justify-center rounded-xl transition-all ${
              isFogActive
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                : 'text-slate-400 hover:bg-slate-800/80 hover:text-slate-200'
            }`}
          >
            <Eye className="h-4 w-4" />
          </button>
        )}

        <button
          onClick={handleTogglePing}
          title="Ping Location"
          className={`flex h-9 w-9 items-center justify-center rounded-xl transition-all ${
            isPingMode
              ? 'bg-rose-600 text-white shadow-lg shadow-rose-500/30'
              : 'text-slate-400 hover:bg-slate-800/80 hover:text-slate-200'
          }`}
        >
          <Radio className="h-4 w-4" />
        </button>
      </div>

      {/* Bottom Group: Side Panel Drawer Selectors */}
      <div className="flex flex-col items-center gap-1.5">
        <button
          onClick={() => togglePanel('initiative')}
          title="Combat & Initiative Tracker"
          className={`flex h-9 w-9 items-center justify-center rounded-xl transition-all ${
            activePanel === 'initiative'
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
              : 'text-slate-400 hover:bg-slate-800/80 hover:text-slate-200'
          }`}
        >
          <Swords className="h-4 w-4" />
        </button>

        <button
          onClick={() => togglePanel('tokens')}
          title="Token Hub & Character Library"
          className={`flex h-9 w-9 items-center justify-center rounded-xl transition-all ${
            activePanel === 'tokens'
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
              : 'text-slate-400 hover:bg-slate-800/80 hover:text-slate-200'
          }`}
        >
          <Users className="h-4 w-4" />
        </button>

        {isGM && (
          <button
            onClick={() => togglePanel('maps')}
            title="Maps & GM Asset Library"
            className={`flex h-9 w-9 items-center justify-center rounded-xl transition-all ${
              activePanel === 'maps'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                : 'text-slate-400 hover:bg-slate-800/80 hover:text-slate-200'
            }`}
          >
            <Map className="h-4 w-4" />
          </button>
        )}

        <button
          onClick={() => togglePanel('chat')}
          title="Chat & Dice Logs"
          className={`flex h-9 w-9 items-center justify-center rounded-xl transition-all ${
            activePanel === 'chat'
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
              : 'text-slate-400 hover:bg-slate-800/80 hover:text-slate-200'
          }`}
        >
          <MessageSquare className="h-4 w-4" />
        </button>

        <button
          onClick={() => togglePanel('fx')}
          title="Map Effects & Weather"
          className={`flex h-9 w-9 items-center justify-center rounded-xl transition-all ${
            activePanel === 'fx'
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
              : 'text-slate-400 hover:bg-slate-800/80 hover:text-slate-200'
          }`}
        >
          <Sparkles className="h-4 w-4" />
        </button>

        {isGM && (
          <button
            onClick={() => togglePanel('settings')}
            title="GM Tabletop Settings"
            className={`flex h-9 w-9 items-center justify-center rounded-xl transition-all ${
              activePanel === 'settings'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                : 'text-slate-400 hover:bg-slate-800/80 hover:text-slate-200'
            }`}
          >
            <Settings className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
};
