import React, { useEffect, useRef } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ToastProvider } from './components/shared/Toast';
import { Home } from './components/session/Home';
import { SessionCreate } from './components/session/SessionCreate';
import { SessionJoin } from './components/session/SessionJoin';
import { SessionLobby } from './components/session/SessionLobby';
import { LegacyRouteAlias } from './components/session/LegacyRouteAlias';
import { PlayRoute } from './components/play/PlayRoute';
import { AdminLogin } from './components/admin/AdminLogin';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { AssetCreate } from './components/admin/AssetCreate';
import { DunGENLayout } from './components/dungen/DunGENLayout';
import { DunGENCampaignView } from './components/dungen/DunGENCampaignView';
import { useSessionStore } from './stores/sessionStore';
import { useSession } from './hooks/useSession';
import { useRealtime } from './hooks/useRealtime';
import { supabase } from './lib/supabase';

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
  const location = useLocation();
  const isCampaignRoute = location.pathname.startsWith('/campaign') || location.pathname.startsWith('/DunGEN');
  // Set up realtime subscriptions when in a session
  useRealtime({ mode: isCampaignRoute ? 'campaign' : 'play' });
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
        hydrateSession: !isCampaignRoute,
      });

      if (!result.success) {
        clearSession();
        setCurrentUser(null);
      }
    };

    void attemptRejoin();
  }, [session, currentUser, joinSession, clearSession, setCurrentUser, isCampaignRoute]);

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
            hydrateSession: !isCampaignRoute,
          });
          return;
        }

        clearSession();
        setCurrentUser(null);
        return;
      }

      lastHydratedSessionId.current = session.id;
      if (isCampaignRoute) {
        return;
      }
      await loadSessionData(session.id);
    };

    void hydrateSession();
  }, [session, currentUser, joinSession, loadSessionData, clearSession, setCurrentUser, isCampaignRoute]);

  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/campaign" element={<DunGENLayout />}>
        <Route index element={<DunGENCampaignView />} />
      </Route>
      <Route
        path="/DunGEN"
        element={
          <LegacyRouteAlias to="/campaign">
            <DunGENLayout>
              <DunGENCampaignView />
            </DunGENLayout>
          </LegacyRouteAlias>
        }
      />
      <Route
        path="/DunGEN/campaign"
        element={
          <LegacyRouteAlias to="/campaign">
            <DunGENLayout>
              <DunGENCampaignView />
            </DunGENLayout>
          </LegacyRouteAlias>
        }
      />
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
