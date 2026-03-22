import React from 'react';
import {
  PencilLine,
  Minus,
  Square as SquareIcon,
  Circle as CircleIcon,
  Triangle as TriangleIcon,
  Eraser,
  Sticker,
} from 'lucide-react';
import { DRAWING_COLOR_OPTIONS, isDrawingColor } from '../../types';
import { useMapStore } from '../../stores/mapStore';
import { useIsGM } from '../../stores/sessionStore';
import { STAMP_EMOJIS } from '../../lib/mapDecor';

const TOOL_DEFINITIONS = [
  { tool: 'free' as const, label: 'Free draw', icon: <PencilLine className="w-4 h-4" /> },
  { tool: 'line' as const, label: 'Line', icon: <Minus className="w-4 h-4" /> },
  { tool: 'square' as const, label: 'Square', icon: <SquareIcon className="w-4 h-4" /> },
  { tool: 'circle' as const, label: 'Circle', icon: <CircleIcon className="w-4 h-4" /> },
  { tool: 'triangle' as const, label: 'Triangle', icon: <TriangleIcon className="w-4 h-4" /> },
  { tool: 'emoji' as const, label: 'Emoji', icon: <Sticker className="w-4 h-4" /> },
  { tool: 'eraser' as const, label: 'Eraser', icon: <Eraser className="w-4 h-4" /> },
];

const STROKE_SIZES = [
  { label: 'Fine', value: 2 },
  { label: 'Small', value: 4 },
  { label: 'Medium', value: 8 },
  { label: 'Large', value: 12 },
];

export const DrawingTools: React.FC = () => {
  const isGM = useIsGM();
  const drawingTool = useMapStore((state) => state.drawingTool);
  const drawingColor = useMapStore((state) => state.drawingColor);
  const drawingStrokeWidth = useMapStore((state) => state.drawingStrokeWidth);
  const drawingEmoji = useMapStore((state) => state.drawingEmoji);
  const drawingEmojiScale = useMapStore((state) => state.drawingEmojiScale);
  const setDrawingTool = useMapStore((state) => state.setDrawingTool);
  const setDrawingColor = useMapStore((state) => state.setDrawingColor);
  const setDrawingStrokeWidth = useMapStore((state) => state.setDrawingStrokeWidth);
  const setDrawingEmoji = useMapStore((state) => state.setDrawingEmoji);
  const setDrawingEmojiScale = useMapStore((state) => state.setDrawingEmojiScale);
  const setFogToolMode = useMapStore((state) => state.setFogToolMode);
  const setEffectPaintMode = useMapStore((state) => state.setEffectPaintMode);

  const handleToolSelect = (tool: typeof drawingTool) => {
    if (isGM) {
      setFogToolMode(null);
    }
    setEffectPaintMode(false);
    setDrawingTool(drawingTool === tool ? null : tool);
  };

  const handleColorSelect = (color: string) => {
    if (!isDrawingColor(color)) return;
    setDrawingColor(color);
  };

  return (
    <div className="bg-slate-900/90 backdrop-blur-sm rounded-lg border border-slate-700 p-3 flex flex-col gap-3">
      <div>
        <p className="text-xs uppercase tracking-wide text-slate-400 mb-2">Draw</p>
        <div className="flex flex-wrap gap-2">
          {TOOL_DEFINITIONS.map(({ tool, label, icon }) => (
            <button
              key={tool}
              onClick={() => handleToolSelect(tool)}
              className={`flex items-center gap-1 px-2 py-1 rounded border text-xs transition-colors ${
                drawingTool === tool
                  ? 'bg-slate-700 border-tempest-400 text-slate-100'
                  : 'border-slate-700 text-slate-300 hover:text-slate-100 hover:border-tempest-500'
              }`}
              title={label}
            >
              {icon}
              {label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-xs uppercase tracking-wide text-slate-400 mb-2">Colors</p>
        <div className="flex flex-wrap gap-2">
          {DRAWING_COLOR_OPTIONS.map(({ label, value }) => (
            <button
              key={value}
              onClick={() => handleColorSelect(value)}
              className={`w-6 h-6 rounded border-2 ${
                drawingColor === value ? 'border-slate-100' : 'border-slate-700'
              }`}
              style={{ backgroundColor: value }}
              title={label}
            >
              <span className="sr-only">{label}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-xs uppercase tracking-wide text-slate-400 mb-2">Stroke</p>
        <div className="flex flex-wrap gap-2">
          {STROKE_SIZES.map(({ label, value }) => (
            <button
              key={label}
              onClick={() => setDrawingStrokeWidth(value)}
              className={`px-2 py-1 rounded border text-xs transition-colors ${
                drawingStrokeWidth === value
                  ? 'bg-slate-700 border-tempest-400 text-slate-100'
                  : 'border-slate-700 text-slate-300 hover:text-slate-100 hover:border-tempest-500'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs uppercase tracking-wide text-slate-400">Emoji Stamps</p>
          <span className="text-lg leading-none" title="Current emoji">{drawingEmoji}</span>
        </div>
        <label className="text-xs text-slate-400">Emoji scale ({drawingEmojiScale.toFixed(1)}x)</label>
        <input
          type="range"
          min={0.5}
          max={3}
          step={0.1}
          value={drawingEmojiScale}
          onChange={(event) => setDrawingEmojiScale(Number(event.target.value))}
          className="w-full"
        />
        <div className="mt-2 max-h-40 overflow-y-auto rounded border border-slate-700 p-2 grid grid-cols-10 gap-1 bg-slate-950/40">
          {STAMP_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              onClick={() => {
                setDrawingEmoji(emoji);
                if (drawingTool !== 'emoji') {
                  handleToolSelect('emoji');
                }
              }}
              className={`h-7 w-7 flex items-center justify-center rounded text-base leading-none transition-colors ${
                drawingEmoji === emoji ? 'bg-tempest-500/40' : 'hover:bg-slate-700'
              }`}
              title={`Stamp ${emoji}`}
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
