import React, { Suspense, lazy, useEffect, useRef } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ToastProvider } from './components/shared/Toast';
import { Home } from './components/session/Home';
import { LegacyRouteAlias } from './components/session/LegacyRouteAlias';
import { useSessionStore } from './stores/sessionStore';
import { useSession } from './hooks/useSession';
import { useRealtime } from './hooks/useRealtime';
import { supabase } from './lib/supabase';

const SessionCreate = lazy(async () => {
  const module = await import('./components/session/SessionCreate');
  return { default: module.SessionCreate };
});

const SessionJoin = lazy(async () => {
  const module = await import('./components/session/SessionJoin');
  return { default: module.SessionJoin };
});

const SessionLobby = lazy(async () => {
  const module = await import('./components/session/SessionLobby');
  return { default: module.SessionLobby };
});

const PlayRoute = lazy(async () => {
  const module = await import('./components/play/PlayRoute');
  return { default: module.PlayRoute };
});

const AdminLogin = lazy(async () => {
  const module = await import('./components/admin/AdminLogin');
  return { default: module.AdminLogin };
});

const AdminDashboard = lazy(async () => {
  const module = await import('./components/admin/AdminDashboard');
  return { default: module.AdminDashboard };
});

const AssetCreate = lazy(async () => {
  const module = await import('./components/admin/AssetCreate');
  return { default: module.AssetCreate };
});

const RouteLoadingFallback: React.FC = () => (
  <main className="tempest-shell flex min-h-screen items-center justify-center px-4 py-10">
    <div className="rounded-lg border border-slate-800 bg-slate-900/70 px-4 py-3 text-sm text-slate-300">
      Loading Tempest Table...
    </div>
  </main>
);

// Protected route wrapper
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const session = useSessionStore((state) => state.session);
  const currentUser = useSessionStore((state) => state.currentUser);

  if (!session || !currentUser) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

// Main app with realtime connection
const AppContent: React.FC = () => {
  // Set up realtime subscriptions when in a session
  useRealtime();
  const { joinSession, loadSessionData } = useSession();
  const session = useSessionStore((state) => state.session);
  const currentUser = useSessionStore((state) => state.currentUser);
  const clearSession = useSessionStore((state) => state.clearSession);
  const setCurrentUser = useSessionStore((state) => state.setCurrentUser);
  const lastAttemptedRejoinKey = useRef<string | null>(null);
  const lastHydratedSessionId = useRef<string | null>(null);

  useEffect(() => {
    const attemptRejoin = async () => {
      const sessionCode = session?.code ?? null;
      const username = currentUser?.username ?? null;
      const rejoinKey =
        sessionCode && username && !session?.id
          ? `${sessionCode}:${username}`
          : null;

      if (!rejoinKey || !sessionCode || !username || lastAttemptedRejoinKey.current === rejoinKey) {
        return;
      }

      lastAttemptedRejoinKey.current = rejoinKey;
      const result = await joinSession(sessionCode, username, {
        hydrateSession: true,
      });

      if (!result.success) {
        clearSession();
        setCurrentUser(null);
      }
    };

    void attemptRejoin();
  }, [session, currentUser, joinSession, clearSession, setCurrentUser]);

  useEffect(() => {
    const hydrateSession = async () => {
      if (!session?.id || !currentUser?.username || lastHydratedSessionId.current === session.id) {
        return;
      }

      const { data: liveSession, error } = await supabase
        .from('sessions')
        .select('id')
        .eq('id', session.id)
        .maybeSingle();

      if (error) {
        console.error('Failed to validate persisted session before hydration.', error);
        return;
      }

      if (!liveSession) {
        if (session.code) {
          lastHydratedSessionId.current = null;
          await joinSession(session.code, currentUser.username, {
            hydrateSession: true,
          });
          return;
        }

        clearSession();
        setCurrentUser(null);
        return;
      }

      lastHydratedSessionId.current = session.id;
      await loadSessionData(session.id);
    };

    void hydrateSession();
  }, [session, currentUser, joinSession, loadSessionData, clearSession, setCurrentUser]);

  return (
    <Suspense fallback={<RouteLoadingFallback />}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route
          path="/create"
          element={
            <LegacyRouteAlias to="/play?mode=create">
              <SessionCreate />
            </LegacyRouteAlias>
          }
        />
        <Route
          path="/join"
          element={
            <LegacyRouteAlias to="/play?mode=join">
              <SessionJoin />
            </LegacyRouteAlias>
          }
        />
        <Route
          path="/lobby"
          element={
            <ProtectedRoute>
              <SessionLobby />
            </ProtectedRoute>
          }
        />
        <Route
          path="/play"
          element={
            <PlayRoute />
          }
        />
        {/* Admin routes */}
        <Route path="/admin" element={<AdminLogin />} />
        <Route path="/admin/dashboard" element={<AdminDashboard />} />
        <Route path="/admin/assets/new" element={<AssetCreate />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
};

const App: React.FC = () => {
  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  );
};

export default App;
