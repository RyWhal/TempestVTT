import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Map as MapIcon,
  Users,
  Crown,
  Wifi,
  WifiOff,
  LogOut,
  ChevronDown,
  Settings,
  X,
} from 'lucide-react';
import { MapCanvas } from '../map/MapCanvas';
import { ChatPanel } from '../chat/ChatPanel';
import { DicePanel } from '../dice/DicePanel';
import { MapManager } from '../gm/MapManager';
import { GMSettings } from '../gm/GMSettings';
import { InitiativePanel } from '../initiative/InitiativePanel';
import { LeftToolbar, type ActivePanelTab } from './LeftToolbar';
import { TokenHubPanel } from './TokenHubPanel';
import { useSessionStore, useIsGM } from '../../stores/sessionStore';
import { useMapStore } from '../../stores/mapStore';
import { useSession } from '../../hooks/useSession';
import { useToast } from '../shared/Toast';

const DRAWER_WIDTH_CLASS = 'w-80 2xl:w-96';

export const PlaySession: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const session = useSessionStore((state) => state.session);
  const currentUser = useSessionStore((state) => state.currentUser);
  const connectionStatus = useSessionStore((state) => state.connectionStatus);
  const players = useSessionStore((state) => state.players);
  const maps = useMapStore((state) => state.maps);
  const activeMap = useMapStore((state) => state.activeMap);
  const setActiveMap = useMapStore((state) => state.setActiveMap);
  const isGM = useIsGM();
  const { leaveSession, claimGM, releaseGM, loadChatData, loadInitiativeData } = useSession();

  // Panel state driven by left toolbar dock
  const [activePanel, setActivePanel] = useState<ActivePanelTab>('tokens');
  const [isPanMode, setIsPanMode] = useState(false);
  const [isMeasureMode, setIsMeasureMode] = useState(false);
  const [isPingMode, setIsPingMode] = useState(false);
  const [showMapDropdown, setShowMapDropdown] = useState(false);

  useEffect(() => {
    if (connectionStatus === 'disconnected' || connectionStatus === 'reconnecting') {
      return;
    }

    if (!session?.id) {
      return;
    }

    if (activePanel === 'chat' || activePanel === 'dice') {
      void loadChatData(session.id);
    } else if (activePanel === 'initiative') {
      void loadInitiativeData(session.id);
    }
  }, [session?.id, activePanel, connectionStatus, loadChatData, loadInitiativeData]);

  if (!session || !currentUser) return null;

  const handleClaimGM = async () => {
    const confirmed = confirm('Assume GM permissions for this table?');
    if (!confirmed) return;

    const result = await claimGM();
    showToast(
      result.success ? 'You are now the GM.' : result.error || 'Failed to claim GM',
      result.success ? 'success' : 'error'
    );
  };

  return (
    <div className="tempest-shell flex h-screen w-screen flex-col overflow-hidden bg-slate-950 font-sans">
      {/* Top Floating Glassmorphic Pill Header */}
      <header className="absolute top-3 left-3 right-3 z-30 flex h-12 items-center justify-between pointer-events-none">
        {/* Left Title & Map Selector */}
        <div className="flex items-center gap-2 pointer-events-auto">
          <div className="flex items-center gap-2 rounded-2xl border border-slate-800/80 bg-slate-950/90 px-3 py-1.5 backdrop-blur-md shadow-xl">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-600 font-bold text-white text-xs shadow-md shadow-blue-500/30">
              ⚡
            </span>
            <span className="text-xs font-bold text-slate-100">{session.name}</span>
            <span className="rounded-full bg-blue-950/80 px-2 py-0.5 font-mono text-[10px] font-semibold text-blue-300 border border-blue-800/40">
              STORMLIGHT RPG
            </span>
          </div>

          {/* Active Map Dropdown Pill */}
          <div className="relative">
            <button
              onClick={() => setShowMapDropdown((prev) => !prev)}
              className="flex items-center gap-2 rounded-2xl border border-slate-800/80 bg-slate-950/90 px-3 py-1.5 text-xs text-slate-200 backdrop-blur-md shadow-xl hover:bg-slate-900"
            >
              <MapIcon className="h-3.5 w-3.5 text-blue-400" />
              <span className="font-medium truncate max-w-[120px]">
                {activeMap ? activeMap.name : 'Select Map'}
              </span>
              <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
            </button>

            {showMapDropdown && (
              <div className="absolute top-10 left-0 z-40 w-48 rounded-xl border border-slate-800 bg-slate-950/95 p-1.5 shadow-2xl backdrop-blur-xl">
                <div className="px-2 py-1 text-[10px] font-semibold uppercase text-slate-500">
                  Battlemaps
                </div>
                {maps.map((map) => (
                  <button
                    key={map.id}
                    onClick={() => {
                      setActiveMap(map);
                      setShowMapDropdown(false);
                    }}
                    className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs transition-colors ${
                      activeMap?.id === map.id
                        ? 'bg-blue-600/20 text-blue-300 font-semibold'
                        : 'text-slate-300 hover:bg-slate-900'
                    }`}
                  >
                    <span className="truncate">{map.name}</span>
                    {activeMap?.id === map.id && <span className="text-blue-400">✓</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Status Controls */}
        <div className="flex items-center gap-2 pointer-events-auto">
          <div className="flex items-center gap-2 rounded-2xl border border-slate-800/80 bg-slate-950/90 px-3 py-1.5 backdrop-blur-md shadow-xl">
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] ${
                connectionStatus === 'connected'
                  ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
                  : connectionStatus === 'reconnecting'
                  ? 'bg-amber-500/10 text-amber-300 border border-amber-500/20'
                  : 'bg-red-500/10 text-red-300 border border-red-500/20'
              }`}
            >
              {connectionStatus === 'connected' ? (
                <Wifi className="h-3 w-3" />
              ) : (
                <WifiOff className="h-3 w-3" />
              )}
            </span>

            <span className="inline-flex items-center gap-1 text-xs text-slate-400">
              <Users className="h-3.5 w-3.5" />
              {players.length}
            </span>

            {isGM ? (
              <button
                onClick={() => void releaseGM()}
                className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-xs text-amber-300 hover:bg-amber-500/20"
                title="Release GM role"
              >
                <Crown className="h-3 w-3" /> GM
              </button>
            ) : (
              <button
                onClick={handleClaimGM}
                className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-800/80 px-2 py-0.5 text-xs text-slate-300 hover:bg-slate-700"
              >
                <Crown className="h-3 w-3 text-amber-400" /> GM
              </button>
            )}

            <button
              onClick={async () => {
                await leaveSession();
                navigate('/');
              }}
              title="Leave Session"
              className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Tabletop Canvas View & Floating Left Toolbar */}
      <div className="relative flex flex-1 overflow-hidden">
        <LeftToolbar
          activePanel={activePanel}
          onSelectPanel={setActivePanel}
          isPanMode={isPanMode}
          onTogglePanMode={setIsPanMode}
          isMeasureMode={isMeasureMode}
          onToggleMeasureMode={setIsMeasureMode}
          isPingMode={isPingMode}
          onTogglePingMode={setIsPingMode}
        />

        <section className="relative flex-1 overflow-hidden">
          <MapCanvas />
        </section>

        {/* Collapsible Right Tool Context Panel */}
        {activePanel !== null && (
          <aside className={`flex ${DRAWER_WIDTH_CLASS} flex-shrink-0 flex-col border-l border-slate-800/80 bg-slate-950/95 shadow-2xl z-20`}>
            <div className="flex-1 overflow-hidden">
              {activePanel === 'tokens' && (
                <TokenHubPanel onClose={() => setActivePanel(null)} />
              )}
              {activePanel === 'initiative' && (
                <div className="h-full p-2">
                  <InitiativePanel />
                </div>
              )}
              {activePanel === 'maps' && isGM && (
                <div className="flex h-full flex-col">
                  <div className="flex items-center justify-between border-b border-slate-800 p-3">
                    <h2 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                      <MapIcon className="h-4 w-4 text-blue-400" /> Map Manager
                    </h2>
                    <button
                      onClick={() => setActivePanel(null)}
                      className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-2">
                    <MapManager />
                  </div>
                </div>
              )}
              {activePanel === 'chat' && (
                <div className="h-full overflow-hidden">
                  <ChatPanel />
                </div>
              )}
              {activePanel === 'dice' && (
                <div className="h-full overflow-hidden p-2">
                  <DicePanel />
                </div>
              )}
              {activePanel === 'settings' && isGM && (
                <div className="flex h-full flex-col">
                  <div className="flex items-center justify-between border-b border-slate-800 p-3">
                    <h2 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                      <Settings className="h-4 w-4 text-blue-400" /> GM Settings
                    </h2>
                    <button
                      onClick={() => setActivePanel(null)}
                      className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-2">
                    <GMSettings />
                  </div>
                </div>
              )}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
};
