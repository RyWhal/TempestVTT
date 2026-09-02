import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Map as MapIcon,
  Users,
  Crown,
  Wifi,
  WifiOff,
  LogOut,
  Settings,
  X,
  Volume2,
  VolumeX,
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
import { useAudioStore } from '../../stores/audioStore';
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
  const isGM = useIsGM();
  const { leaveSession, claimGM, releaseGM, loadChatData, loadInitiativeData, loadNpcTemplateData } = useSession();

  // Panel state driven by left toolbar dock
  const [activePanel, setActivePanel] = useState<ActivePanelTab>('tokens');
  const [isMeasureMode, setIsMeasureMode] = useState(false);
  const [isPingMode, setIsPingMode] = useState(false);

  useEffect(() => {
    if (connectionStatus === 'disconnected' || connectionStatus === 'reconnecting') {
      return;
    }

    if (!session?.id) {
      return;
    }

    // Load NPC templates by default or when token panel is open
    void loadNpcTemplateData?.(session.id);

    if (activePanel === 'chat' || activePanel === 'dice') {
      void loadChatData(session.id);
    } else if (activePanel === 'initiative') {
      void loadInitiativeData(session.id);
    }
  }, [session?.id, activePanel, connectionStatus, loadChatData, loadInitiativeData, loadNpcTemplateData]);

  const isMuted = useAudioStore((state) => state.isMuted);
  const toggleMute = useAudioStore((state) => state.toggleMute);

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
      <header className="absolute top-3 right-3 z-30 flex h-10 items-center justify-end pointer-events-none">
        {/* Right Status Controls */}
        <div className="flex items-center gap-2 pointer-events-auto">
          <div className="flex items-center gap-2.5 rounded-full border border-white/15 bg-slate-950/50 px-3.5 py-1.5 backdrop-blur-2xl shadow-2xl">
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
              onClick={toggleMute}
              title={isMuted ? 'Unmute Sound Effects' : 'Mute Sound Effects'}
              className={`rounded-lg p-1 transition-colors ${
                isMuted
                  ? 'text-rose-400 hover:bg-rose-500/20'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              {isMuted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
            </button>

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

      {/* Main Full-Screen Tabletop Canvas View & Floating Overlays */}
      <div className="relative flex-1 overflow-hidden">
        {/* Map Canvas - Full Edge-to-Edge Coverage */}
        <div className="absolute inset-0 z-0">
          <MapCanvas isMeasureMode={isMeasureMode} isPingMode={isPingMode} />
        </div>

        {/* Floating Left Toolbar */}
        <LeftToolbar
          activePanel={activePanel}
          onSelectPanel={setActivePanel}
          isMeasureMode={isMeasureMode}
          onToggleMeasureMode={setIsMeasureMode}
          isPingMode={isPingMode}
          onTogglePingMode={setIsPingMode}
        />

        {/* Collapsible Floating Right Liquid Glass Drawer */}
        {activePanel !== null && (
          <aside className={`absolute right-3 top-14 bottom-3 z-20 ${DRAWER_WIDTH_CLASS} flex flex-col rounded-3xl border border-white/15 bg-slate-950/50 backdrop-blur-2xl shadow-2xl overflow-hidden text-slate-100`}>
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
                  <div className="flex items-center justify-between border-b border-slate-800/80 p-3">
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
                  <div className="flex items-center justify-between border-b border-slate-800/80 p-3">
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
