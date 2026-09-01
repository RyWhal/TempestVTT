import React, { useState } from 'react';
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
  Dices,
  Settings,
  Square,
  Circle,
  Slash,
  Eraser,
} from 'lucide-react';
import { useMapStore } from '../../stores/mapStore';
import { useIsGM } from '../../stores/sessionStore';
import { DRAWING_COLOR_OPTIONS } from '../../types';
import { STAMP_EMOJIS } from '../../lib/mapDecor';

export type ActivePanelTab =
  | 'initiative'
  | 'tokens'
  | 'maps'
  | 'chat'
  | 'dice'
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

const QUICK_EMOJIS = ['🔥', '💥', '⚔️', '🛡️', '💀', '🎯', '⭐', '🌲', '🏰', '💧', '⚡', '👑', '🎒', '🩸', '✨', '🐺', '🐉', '❤️'];

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
  const drawingColor = useMapStore((state) => state.drawingColor);
  const setDrawingColor = useMapStore((state) => state.setDrawingColor);
  const drawingStrokeWidth = useMapStore((state) => state.drawingStrokeWidth);
  const setDrawingStrokeWidth = useMapStore((state) => state.setDrawingStrokeWidth);
  const drawingEmoji = useMapStore((state) => state.drawingEmoji);
  const setDrawingEmoji = useMapStore((state) => state.setDrawingEmoji);

  const fogToolMode = useMapStore((state) => state.fogToolMode);
  const setFogToolMode = useMapStore((state) => state.setFogToolMode);

  const [showDrawMenu, setShowDrawMenu] = useState(false);
  const [showFullEmojiGrid, setShowFullEmojiGrid] = useState(false);

  const isSelectActive = !isPanMode && !drawingTool && !fogToolMode && !isMeasureMode && !isPingMode;
  const isDrawActive = Boolean(drawingTool);
  const isFogActive = Boolean(fogToolMode);

  const handleSelectPointer = () => {
    onTogglePanMode(false);
    onToggleMeasureMode?.(false);
    onTogglePingMode?.(false);
    setDrawingTool(null);
    setFogToolMode(null);
    setShowDrawMenu(false);
  };

  const handleTogglePan = () => {
    const nextPan = !isPanMode;
    onTogglePanMode(nextPan);
    if (nextPan) {
      onToggleMeasureMode?.(false);
      onTogglePingMode?.(false);
      setDrawingTool(null);
      setFogToolMode(null);
      setShowDrawMenu(false);
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
      setShowDrawMenu(false);
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
      setShowDrawMenu(false);
    }
  };

  const handleToggleDraw = () => {
    if (isDrawActive && showDrawMenu) {
      setShowDrawMenu(false);
      setDrawingTool(null);
    } else {
      onTogglePanMode(false);
      onToggleMeasureMode?.(false);
      onTogglePingMode?.(false);
      setFogToolMode(null);
      setDrawingTool('free');
      setShowDrawMenu(true);
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
      setShowDrawMenu(false);
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

        {/* Pencil Button & Drawing Popover Menu */}
        <div className="relative">
          <button
            onClick={handleToggleDraw}
            title="Drawing Tools & Options"
            className={`flex h-9 w-9 items-center justify-center rounded-xl transition-all ${
              isDrawActive
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                : 'text-slate-400 hover:bg-slate-800/80 hover:text-slate-200'
            }`}
          >
            <Pencil className="h-4 w-4" />
          </button>

          {/* Floating Drawing Options Popover */}
          {showDrawMenu && (
            <div className="absolute left-12 top-0 z-50 w-72 rounded-2xl border border-slate-800/90 bg-slate-950/95 p-3.5 shadow-2xl backdrop-blur-xl text-slate-100 animate-in fade-in slide-in-from-left-2">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="text-[10px] font-bold tracking-wider uppercase text-slate-400">
                  Drawing Tool
                </span>
                <button
                  onClick={() => setShowDrawMenu(false)}
                  className="text-[11px] text-slate-500 hover:text-slate-300"
                >
                  Close
                </button>
              </div>

              {/* Shape & Emoji Tool Selectors */}
              <div className="mt-2.5 flex items-center justify-between gap-1.5 rounded-xl border border-slate-800 bg-slate-900/60 p-1">
                <button
                  onClick={() => setDrawingTool('free')}
                  title="Freehand Pencil"
                  className={`flex flex-1 items-center justify-center rounded-lg py-1.5 text-xs transition-all ${
                    drawingTool === 'free'
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                  }`}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>

                <button
                  onClick={() => setDrawingTool('line')}
                  title="Straight Line"
                  className={`flex flex-1 items-center justify-center rounded-lg py-1.5 text-xs transition-all ${
                    drawingTool === 'line'
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                  }`}
                >
                  <Slash className="h-3.5 w-3.5" />
                </button>

                <button
                  onClick={() => setDrawingTool('square')}
                  title="Rectangle / Square"
                  className={`flex flex-1 items-center justify-center rounded-lg py-1.5 text-xs transition-all ${
                    drawingTool === 'square'
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                  }`}
                >
                  <Square className="h-3.5 w-3.5" />
                </button>

                <button
                  onClick={() => setDrawingTool('circle')}
                  title="Circle"
                  className={`flex flex-1 items-center justify-center rounded-lg py-1.5 text-xs transition-all ${
                    drawingTool === 'circle'
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                  }`}
                >
                  <Circle className="h-3.5 w-3.5" />
                </button>

                <button
                  onClick={() => setDrawingTool('eraser')}
                  title="Eraser"
                  className={`flex flex-1 items-center justify-center rounded-lg py-1.5 text-xs transition-all ${
                    drawingTool === 'eraser'
                      ? 'bg-rose-600 text-white shadow-md'
                      : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                  }`}
                >
                  <Eraser className="h-3.5 w-3.5" />
                </button>

                <button
                  onClick={() => setDrawingTool('emoji')}
                  title="Emoji Stamp Tool"
                  className={`flex flex-1 items-center justify-center rounded-lg py-1.5 text-xs transition-all ${
                    drawingTool === 'emoji'
                      ? 'bg-amber-600 text-white shadow-md'
                      : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                  }`}
                >
                  <span className="text-sm leading-none">{drawingEmoji || '🔥'}</span>
                </button>
              </div>

              {/* Emoji Picker Grid when Emoji Stamp tool active */}
              {drawingTool === 'emoji' ? (
                <div className="mt-3 rounded-xl border border-amber-500/30 bg-slate-900/90 p-2 text-xs">
                  <div className="flex items-center justify-between pb-1.5 border-b border-slate-800">
                    <span className="text-[10px] font-bold text-amber-300 uppercase">
                      Select Emoji Stamp
                    </span>
                    <button
                      onClick={() => setShowFullEmojiGrid((prev) => !prev)}
                      className="text-[10px] text-blue-400 hover:text-blue-300"
                    >
                      {showFullEmojiGrid ? 'Quick View' : 'More...'}
                    </button>
                  </div>

                  <div className="mt-2 max-h-36 overflow-y-auto grid grid-cols-6 gap-1.5 text-center">
                    {(showFullEmojiGrid ? STAMP_EMOJIS : QUICK_EMOJIS).map((emoji, idx) => (
                      <button
                        key={`${emoji}-${idx}`}
                        onClick={() => {
                          setDrawingEmoji(emoji);
                          setDrawingTool('emoji');
                        }}
                        className={`rounded-lg py-1 text-base transition-transform hover:scale-125 ${
                          drawingEmoji === emoji
                            ? 'bg-amber-500/30 ring-2 ring-amber-400'
                            : 'hover:bg-slate-800'
                        }`}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <>
                  {/* Color Palette Dots */}
                  <div className="mt-3 flex items-center justify-between px-1">
                    {DRAWING_COLOR_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => setDrawingColor(opt.value)}
                        title={opt.label}
                        className={`h-5 w-5 rounded-full transition-transform ${
                          drawingColor === opt.value
                            ? 'scale-125 ring-2 ring-blue-500 ring-offset-2 ring-offset-slate-950'
                            : 'hover:scale-110 opacity-80 hover:opacity-100'
                        }`}
                        style={{ backgroundColor: opt.value }}
                      />
                    ))}
                  </div>

                  {/* Weight Slider */}
                  <div className="mt-3.5 flex items-center justify-between px-1 text-xs text-slate-300">
                    <span className="text-[11px] font-medium text-slate-400">Weight</span>
                    <input
                      type="range"
                      min="1"
                      max="20"
                      value={drawingStrokeWidth}
                      onChange={(e) => setDrawingStrokeWidth(parseInt(e.target.value, 10))}
                      className="mx-3 flex-1 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                    />
                    <span className="font-mono text-xs text-slate-200">{drawingStrokeWidth}</span>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

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
          title="Players & Token Hub"
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
          title="Chat Log"
          className={`flex h-9 w-9 items-center justify-center rounded-xl transition-all ${
            activePanel === 'chat'
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
              : 'text-slate-400 hover:bg-slate-800/80 hover:text-slate-200'
          }`}
        >
          <MessageSquare className="h-4 w-4" />
        </button>

        <button
          onClick={() => togglePanel('dice')}
          title="Dice Roller"
          className={`flex h-9 w-9 items-center justify-center rounded-xl transition-all ${
            activePanel === 'dice'
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
              : 'text-slate-400 hover:bg-slate-800/80 hover:text-slate-200'
          }`}
        >
          <Dices className="h-4 w-4" />
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
