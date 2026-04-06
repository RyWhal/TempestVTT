import React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { BookOpen, Plus, Users } from 'lucide-react';
import { Button } from '../shared/Button';
import { Card } from '../shared/Card';
import { SessionCreateForm } from '../session/SessionCreateForm';
import { SessionJoinForm } from '../session/SessionJoinForm';
import { useSessionStore } from '../../stores/sessionStore';
import { useMapStore } from '../../stores/mapStore';
import { useChatStore } from '../../stores/chatStore';

type PlayEntryMode = 'overview' | 'create' | 'join';

const getModeFromSearchParams = (searchParams: URLSearchParams): PlayEntryMode => {
  const mode = searchParams.get('mode');
  if (mode === 'create' || mode === 'join') {
    return mode;
  }

  return 'overview';
};

export const PlayEntryHub: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const mode = getModeFromSearchParams(searchParams);
  const clearSession = useSessionStore((state) => state.clearSession);
  const clearMapState = useMapStore((state) => state.clearMapState);
  const clearChatState = useChatStore((state) => state.clearChatState);
  const githubReadmeUrl = 'https://github.com/RyWhal/TempestVTT/blob/main/README.md';

  const resetSessionState = () => {
    clearSession();
    clearMapState();
    clearChatState();
  };

  const handleSessionCreated = () => {
    navigate('/play', { replace: true });
  };

  const handleSessionJoined = () => {
    navigate('/play', { replace: true });
  };

  const handleOpenMode = (nextMode: Exclude<PlayEntryMode, 'overview'>) => {
    resetSessionState();
    navigate(`/play?mode=${nextMode}`);
  };

  return (
    <main className="tempest-shell flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-5xl">
        {mode === 'overview' ? (
          <Card className="p-8 lg:p-10">
            <p className="text-xs uppercase tracking-[0.2em] text-tempest-300">Tempest Table</p>
            <h1 className="mt-3 text-4xl font-semibold leading-tight md:text-5xl tempest-heading">
              One table link for every Tempest session.
            </h1>
            <p className="mt-4 max-w-2xl text-base text-slate-400">
              Create a live table for your group or join an existing one with a session code.
              Everything starts from the same VTT flow now.
            </p>

            <div className="mt-8 grid gap-4 md:grid-cols-2">
              <button
                type="button"
                onClick={() => handleOpenMode('create')}
                className="tempest-panel flex flex-col items-start gap-3 p-5 text-left transition-colors hover:border-tempest-500/50 hover:bg-slate-900"
              >
                <Plus className="h-5 w-5 text-tempest-300" />
                <div>
                  <h2 className="text-lg font-semibold text-slate-100">Start a session</h2>
                  <p className="mt-1 text-sm text-slate-400">
                    Create a classic Tempest table and jump straight into play.
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleOpenMode('join')}
                className="tempest-panel flex flex-col items-start gap-3 p-5 text-left transition-colors hover:border-tempest-500/50 hover:bg-slate-900"
              >
                <Users className="h-5 w-5 text-tempest-300" />
                <div>
                  <h2 className="text-lg font-semibold text-slate-100">Join with code</h2>
                  <p className="mt-1 text-sm text-slate-400">
                    Use a table code to rejoin an existing Tempest session as a player or GM.
                  </p>
                </div>
              </button>
            </div>

            <a
              href={githubReadmeUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-8 inline-flex items-center rounded-lg border border-slate-700 px-4 py-2.5 text-sm font-medium text-slate-200 transition-colors hover:bg-slate-800"
            >
              <BookOpen className="mr-2 h-4 w-4" />
              View README on GitHub
            </a>
          </Card>
        ) : (
          <div className="mx-auto w-full max-w-md">
            <Button variant="ghost" className="mb-4" onClick={() => navigate('/play')}>
              Back
            </Button>

            <Card>
              {mode === 'create' ? (
                <SessionCreateForm onSuccess={handleSessionCreated} />
              ) : (
                <SessionJoinForm onSuccess={handleSessionJoined} />
              )}
            </Card>
          </div>
        )}
      </div>
    </main>
  );
};
