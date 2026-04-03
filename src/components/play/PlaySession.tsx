import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Map as MapIcon,
  MessageSquare,
  Dices,
  Settings,
  Users,
  Crown,
  Wifi,
  WifiOff,
  LogOut,
  SidebarClose,
  SidebarOpen,
  PencilLine,
} from 'lucide-react';
import { MapCanvas } from '../map/MapCanvas';
import { ChatPanel } from '../chat/ChatPanel';
import { DicePanel } from '../dice/DicePanel';
import { GMPanel } from '../gm/GMPanel';
import { DrawingTools } from '../map/DrawingTools';
import { InitiativePanel } from '../initiative/InitiativePanel';
import { Button } from '../shared/Button';
import { useSessionStore, useIsGM } from '../../stores/sessionStore';
import { useMapStore } from '../../stores/mapStore';
import { useSession } from '../../hooks/useSession';
import { useMap } from '../../hooks/useMap';
import { useToast } from '../shared/Toast';

type SideTab = 'chat' | 'dice' | 'initiative' | 'draw';

const PLAYER_PANEL_KEY = 'tempest-player-panel-collapsed';

export const PlaySession: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const session = useSessionStore((state) => state.session);
  const currentUser = useSessionStore((state) => state.currentUser);
  const connectionStatus = useSessionStore((state) => state.connectionStatus);
  const players = useSessionStore((state) => state.players);
  const activeMap = useMapStore((state) => state.activeMap);
  const drawingData = useMapStore((state) => state.drawingData);
  const setDrawingTool = useMapStore((state) => state.setDrawingTool);
  const isGM = useIsGM();
  const { leaveSession, claimGM, releaseGM, loadChatData, loadInitiativeData } = useSession();
  const { updateDrawingData } = useMap();
  const canUseDrawTools = isGM || Boolean(session?.allowPlayersDrawings);

  const [sideTab, setSideTab] = useState<SideTab>('chat');
  const [showGMPanel, setShowGMPanel] = useState(false);
  const [isPlayerPanelCollapsed, setIsPlayerPanelCollapsed] = useState(() => {
    const stored = localStorage.getItem(PLAYER_PANEL_KEY);
    return stored === 'true';
  });

  useEffect(() => {
    localStorage.setItem(PLAYER_PANEL_KEY, String(isPlayerPanelCollapsed));
  }, [isPlayerPanelCollapsed]);

  useEffect(() => {
    if (isGM) {
      setShowGMPanel(true);
    }
  }, [isGM]);


  useEffect(() => {
    if (sideTab === 'draw' && !canUseDrawTools) {
      setSideTab('chat');
    }
  }, [sideTab, canUseDrawTools]);

  useEffect(() => {
    if (sideTab !== 'draw') {
      setDrawingTool(null);
    }
  }, [sideTab, setDrawingTool]);

  useEffect(() => {
    if (connectionStatus === 'disconnected' || connectionStatus === 'reconnecting') {
      return;
    }

    if (!session?.id) {
      return;
    }

    if (sideTab === 'chat' || sideTab === 'dice') {
      void loadChatData(session.id);
      return;
    }

    if (!isGM && sideTab === 'initiative') {
      void loadInitiativeData(session.id);
    }
  }, [session?.id, sideTab, isGM, connectionStatus, loadChatData, loadInitiativeData]);

  if (!session || !currentUser) return null;

  const playerDrawingCount = drawingData.filter(
    (drawing) => drawing.authorRole === 'player' && drawing.authorUsername === currentUser.username
  ).length;
  const allPlayerDrawingCount = drawingData.filter((drawing) => drawing.authorRole === 'player').length;

  const handleClaimGM = async () => {
    const confirmed = confirm('Assume GM permissions for this table?');
    if (!confirmed) return;

    const result = await claimGM();
    showToast(result.success ? 'You are now the GM.' : result.error || 'Failed to claim GM', result.success ? 'success' : 'error');
  };

  const handleClearPlayerDrawings = async () => {
    if (!activeMap) return;
    const confirmed = confirm(
      isGM ? 'Clear all player drawings on this map?' : 'Clear your drawings on this map?'
    );
    if (!confirmed) return;

    const remainingDrawings = drawingData.filter((drawing) => {
      if (drawing.authorRole !== 'player') {
        return true;
      }

      if (isGM) {
        return false;
      }

      return drawing.authorUsername !== currentUser.username;
    });
    const result = await updateDrawingData(activeMap.id, remainingDrawings);
    showToast(
      result.success
        ? isGM
          ? 'Player drawings cleared.'
          : 'Your drawings cleared.'
        : result.error || 'Failed to clear drawings',
      result.success ? 'success' : 'error'
    );
  };

  return (
    <div className="tempest-shell flex h-screen flex-col">
      <header className="flex h-14 flex-shrink-0 items-center justify-between border-b border-slate-800 bg-slate-950/95 px-4">
        <div className="flex items-center gap-3">
          <h1 className="text-base font-semibold text-slate-100">{session.name}</h1>
          <span className="rounded-md border border-slate-700 bg-slate-800 px-2 py-0.5 font-mono text-xs text-slate-300">
            {session.code}
          </span>
          {activeMap && (
            <span className="flex items-center gap-1 text-sm text-slate-400">
              <MapIcon className="h-4 w-4" />
              {activeMap.name}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs ${connectionStatus === 'connected' ? 'bg-emerald-500/10 text-emerald-300' : connectionStatus === 'reconnecting' ? 'bg-amber-500/10 text-amber-300' : 'bg-red-500/10 text-red-300'}`}>
            {connectionStatus === 'connected' ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
          </span>

          <span className="inline-flex items-center gap-1 text-sm text-slate-400">
            <Users className="h-4 w-4" />
            {players.length}
          </span>

          {isGM ? (
            <button
              onClick={() => void releaseGM()}
              className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-xs text-amber-300"
              title="Release GM role"
            >
              <Crown className="h-3.5 w-3.5" /> GM
            </button>
          ) : (
            <Button variant="ghost" size="sm" onClick={handleClaimGM}>
              <Crown className="mr-1 h-4 w-4" /> Assume GM
            </Button>
          )}

          {isGM && (
            <Button variant="ghost" size="sm" onClick={() => setShowGMPanel((prev) => !prev)}>
              <Settings className="h-4 w-4" />
            </Button>
          )}

          <Button variant="ghost" size="sm" onClick={() => setIsPlayerPanelCollapsed((prev) => !prev)}>
            {isPlayerPanelCollapsed ? <SidebarOpen className="h-4 w-4" /> : <SidebarClose className="h-4 w-4" />}
          </Button>

          <Button variant="ghost" size="sm" onClick={async () => { await leaveSession(); navigate('/'); }}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {isGM && showGMPanel && (
          <aside className="w-80 flex-shrink-0 overflow-hidden border-r border-slate-800 bg-slate-900">
            <GMPanel onClose={() => setShowGMPanel(false)} />
          </aside>
        )}

        <section className="relative flex-1 overflow-hidden">
          <MapCanvas />
        </section>

        {!isPlayerPanelCollapsed && (
          <aside className="flex w-96 flex-shrink-0 flex-col border-l border-slate-800 bg-slate-900">
            <nav className="flex border-b border-slate-800 overflow-x-auto">
              <TabButton active={sideTab === 'chat'} onClick={() => setSideTab('chat')} icon={<MessageSquare className="h-4 w-4" />} label="Chat" />
              <TabButton active={sideTab === 'dice'} onClick={() => setSideTab('dice')} icon={<Dices className="h-4 w-4" />} label="Dice" />
              {!isGM && <TabButton active={sideTab === 'initiative'} onClick={() => setSideTab('initiative')} icon={<Users className="h-4 w-4" />} label="Init" />}
              {canUseDrawTools && (
                <TabButton active={sideTab === 'draw'} onClick={() => setSideTab('draw')} icon={<PencilLine className="h-4 w-4" />} label="Draw" />
              )}
            </nav>

            <div className="flex-1 overflow-hidden">
              {sideTab === 'chat' && <ChatPanel />}
              {sideTab === 'dice' && <DicePanel />}
              {!isGM && sideTab === 'initiative' && <InitiativePanel />}
              {sideTab === 'draw' && (
                <div className="flex h-full flex-col p-4">
                  <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-slate-700 bg-slate-950/60 p-4">
                    <h3 className="text-sm font-semibold text-slate-100">Drawing Tools</h3>
                    <p className="mt-1 text-xs text-slate-400">Quick annotations and planning marks.</p>
                    <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
                      <span>{isGM ? 'Player drawings' : 'Your drawings'}: {isGM ? allPlayerDrawingCount : playerDrawingCount}</span>
                      <button
                        onClick={handleClearPlayerDrawings}
                        className="rounded bg-red-500/20 px-2 py-1 text-red-300 hover:bg-red-500/30"
                        disabled={!activeMap || (isGM ? allPlayerDrawingCount === 0 : playerDrawingCount === 0)}
                      >
                        Clear
                      </button>
                    </div>
                    <div
                      data-testid="draw-tools-scroll-area"
                      className="mt-4 min-h-0 flex-1 overflow-visible [@media(max-height:900px)]:overflow-y-auto [@media(max-height:900px)]:pr-2"
                    >
                      <DrawingTools />
                    </div>
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

interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}

const TabButton: React.FC<TabButtonProps> = ({ active, onClick, icon, label }) => (
  <button
    onClick={onClick}
    className={`flex min-w-[82px] flex-1 items-center justify-center gap-1.5 border-b-2 px-3 py-2 text-xs font-medium transition-colors ${
      active
        ? 'border-tempest-400 bg-slate-800/80 text-slate-100'
        : 'border-transparent text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
    }`}
  >
    {icon}
    {label}
  </button>
);
